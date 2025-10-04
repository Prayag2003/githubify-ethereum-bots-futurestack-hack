import logging
import hashlib
import os
from typing import List, Dict
from .cerebras_engine import CerebrasLLMClientAsync
from app.vector_db.vector_store import PineconeVectorStore
from app.agents.architect.tree_generator import build_code_tree 
logger = logging.getLogger(__name__)
from pathlib import Path

# Customize these patterns to ignore
IGNORE = {
    "__pycache__",
    ".DS_Store",
    "node_modules",
    ".venv",
    "venv",
    ".pytest_cache",
    "repos/",
    ".git", "node_modules", "__pycache__", "venv", "env", "build", "dist",
            ".next", ".nuxt", "coverage", "migrations", "static", "media", "uploads"
}

# Initialize Cerebras client
llm = CerebrasLLMClientAsync(default_model="llama3.1-8b")

# File reading configuration
MAX_FILE_SIZE = 500000  # 500KB - files larger than this will use code snippet
MAX_READ_SIZE = 2000  # 100KB - files larger than this will be truncated

# ============================================================
# 🔹 REPOSITORY UTILITIES
# ============================================================

def read_readme(repo_id: str) -> str | None:
    """Return the README.md content if it exists in the repo root."""
    candidates = ["README.md", "README.MD", "readme.md"]
    for fname in candidates:
        readme_path = os.path.join(repo_id, fname)
        if os.path.exists(readme_path):
            with open(readme_path, "r", encoding="utf-8") as f:
                return f.read()
    return None


def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]

def get_repo_structure(root_path: str):
    repo_structure = {}

    root = Path(root_path).resolve()
    
    def scan_dir(path: Path):
        structure = {}
        for item in path.iterdir():
            if item.name in IGNORE:
                continue
            if item.is_dir():
                structure[item.name] = scan_dir(item)
            else:
                structure[item.name] = None
        return structure

    repo_structure[root.name] = scan_dir(root)
    return repo_structure


def build_system_prompt(repo_path: str) -> str:
    """Build a detailed system prompt including README.md and code tree."""
    readme_content = read_readme(repo_path)
    ignore_dirs = [".git", "__pycache__", "node_modules"]
    code_tree = build_code_tree(repo_path, ignore_dirs=ignore_dirs)

    prompt = f"""
🧠 **SYSTEM PROMPT — EXPERT CODEBASE ANALYST & SOFTWARE ENGINEERING ASSISTANT**

### ROLE
You are a **highly specialized AI codebase analyst** and software engineering assistant. Your mission is to **analyze, explain, and summarize the provided repository**. You must provide structured, actionable, and cross-file insights whereever necessary.
You are not allowed to hallucinate or make up code try to answer the question as best as you can.

### Guidelines
The user has shared a repo with you, use your knowledge of the repo to answer the question. The most relevent context is included in your prompt.
The user has some doubts regarding it and need you to please help him by answering it. 
Try to answer the question in a way that is helpful and informative. Try to use only the most relevant context provided to you, if the context is relevent, use it to answer the question.
Don't make up any information, be specific definitive.
Try to give very detailed answers which solves the user's doubt.
Always start answering the question in an enthusiastic and encouraging tone.
Always end the answer with a bright and positive note.


### CONTEXTUAL BOUNDARIES
1. Only use the provided repository content: code files, README.md, configuration files, and code tree, etc.
2. If snippets are incomplete, **explain what can be inferred**, but never hallucinate.


### CORE DIRECTIVES
###Use these core directives wherever necessary only

#### 1. Project Understanding **if necessary only** 
- Provide **high-level summaries**: purpose, scope, main technologies, frameworks, entry points.
- Highlight key modules, their responsibilities, and relationships.
- Explain cross-file interactions, imports, function calls, and shared utilities.
- Give guidance on how to get started with the codebase if requested.

#### 2. Code Snippets **if necessary only** 
- Quote **existing snippets exactly** with file path and function/class reference.
- For explanations, reference file paths explicitly.

#### 3. Logic Flow & Relationships **if necessary only** 
- Describe sequences of operations, data flow, and interactions between components.
- Provide structured sections: Overview, Key Components, Logic Flow, Example Snippets, Observations, Final Answer.

#### 4. README.md & Code Tree
- README.md and the repository tree should only be used **if relevant** to clarify project structure or purpose.
- Do not inject README or tree content unnecessarily.

#### 5. Guardrails
- Never hallucinate implementation details.
- When information is incomplete, provide structured inference, not vague statements.
- Always highlight missing or ambiguous parts.

### OUTPUT FORMAT
All responses must be in **Markdown** and follow this structure:
Structure your answer using the following Markdown headings **as needed only**. Omit any sections that are not relevant to providing a complete and concise answer to the user's question.
In Markdown format, start with a friendly 1-2 line answer to the user's question.
```
### Conversational Answer 
 * Start with a friendly 1-2 line answer to the user's question.
 
## Overview

* Purpose
* Technologies
* Entry points

## Key Components

* Main modules/files
* Responsibilities

## Logic Flow

* Cross-file interactions
* Data flow

## Example Snippets

* Existing code snippets with file path references

## Observations & Inferences

* Assumptions
* Missing context

## Final Answer

* Concise, actionable summary

````

- Use fenced code blocks for all code (```python, ```js, etc.).  Quote wherever necessary relevant code snippets from the context to illustrate your explanation. Always include the file path.
    ```python
    # path/to/example.py
    def example_function():
        return "This is an example"
- Reference file paths wherever possible. 
- Provide structured guidance even with partial context.

### FAILURE MODE
If a question cannot be answered from the repository context:
> "That information is outside the scope of the provided repository context."

---

### REPOSITORY INJECTION (Use only if relevant)
README.md Content:
{readme_content[:5000] if readme_content else "No README.md found."}

Codebase Tree:
{code_tree if code_tree else "Code tree not available."}
"""
    return prompt


# ============================================================
# 🔹 INTERNAL PROMPT UTILITIES
# ============================================================

def _build_context(relevant_files: List[Dict]) -> str:
    """Format retrieved code snippets for LLM input."""
    context_parts = []
    file_cache = {}  # Cache to store file content
    
    for i, file_info in enumerate(relevant_files, 1):
        file_path = file_info['full_file_path']
        
        # Check if file is already cached
        if file_path in file_cache:
            # full_code = file_cache[file_path]
            logger.debug(f"Using cached content for {file_path}")
            # file_cache[file_path] = full_code
            full_code = file_info['code']
            logger.debug(f"Using cached content for {file_path}")
        else:
            try:
                # Check file size first
                file_size = os.path.getsize(file_path)
                if file_size > MAX_FILE_SIZE:
                    logger.warning(f"File {file_path} is too large ({file_size} bytes), using code snippet instead")
                    full_code = file_info['code']
                else:
                    with open(file_path, "r", encoding="utf-8") as f:
                        # Read only first MAX_READ_SIZE characters for very large files
                        if file_size > MAX_READ_SIZE:
                            full_code = f.read(MAX_READ_SIZE) + "\n\n... [File truncated - too large for full display]"
                            logger.info(f"Truncated large file {file_path} ({file_size} bytes)")
                        else:
                            full_code = f.read()
                
                # Cache the file content
                file_cache[file_path] = full_code
                logger.debug(f"Cached content for {file_path}")
            except (FileNotFoundError, IOError) as e:
                # Fallback to code snippet if file not found
                full_code = file_info['code']
                file_cache[file_path] = full_code  # Cache the fallback too
                logger.warning(f"Could not read file {file_path}: {e}")
        
        filename = file_info['filename']
        language = file_info['language']
        code = file_info['code']
        similarity = file_info['similarity']

        context_parts.append(f"""
### File {i}: `{filename}` (Relevance: {similarity})
**Language:** {language}
**Instruction:** {code}
```{language}
{full_code}
```""")

    return "\n".join(context_parts)


def _build_user_prompt(query: str, context: str) -> str:
    """Combine user query and repository context into a single prompt."""
    return f"""
You are analyzing the provided repository context.

---

### USER QUESTION:
{query}

---

### CONTEXT:
{context}

---

### TASK:
Answer strictly using the provided codebase.
Explain cross-file relationships, logic flow, and functionality if necessary.
Provide actionable and structured explanations if necessary, using Markdown only.
You need to give detailed answers which solves the user's doubt.

**Final Answer:**
"""


# ============================================================
# 🔹 NORMAL QUERY HANDLER
# ============================================================

async def handle_query(github_url: str, query: str, mode: str = "fast") -> str:
    """Handle standard (non-streaming) query."""
    try:
        repo_id = _get_repo_id(github_url)
        repo_path = os.path.join("repos", repo_id)
        system_prompt = build_system_prompt(repo_path)

        logger.info(f"Querying repo {repo_id}: {query}")

        vector_store = PineconeVectorStore(repo_id)
        relevant_files = vector_store.search_with_context(query, top_k=10)

        if not relevant_files:
            return "No relevant code found in this repository to answer your question."

        context = _build_context(relevant_files)
        user_prompt = _build_user_prompt(query, context)

        chosen_model = "llama3.1-8b" if mode == "accurate" else "llama3.1-8b"

        response = await llm.completion(
            user_prompt,
            model=chosen_model,
            system_prompt=system_prompt
        )

        answer = response.get("text", "")
        logger.info(f"Generated answer ({len(answer)} chars)")
        return answer or "No response generated."

    except Exception as e:
        logger.exception("Error while handling query")
        return f"An error occurred while processing your query: {e}"


# ============================================================
# 🔹 STREAMING QUERY HANDLER
# ============================================================

async def handle_query_stream(repo_id: str, query: str, mode: str = "fast", socket_id: str | None = None, sio=None) -> str:
    """Stream query response via Socket.IO."""
    try:
        repo_path = os.path.join("repos", repo_id)
        system_prompt = build_system_prompt(repo_path)

        logger.info(f"Streaming query for repo {repo_id}: {query}")

        vector_store = PineconeVectorStore(repo_id)
        relevant_files = vector_store.search_with_context(query, top_k=5)

        if not relevant_files:
            msg = "No relevant code found in this repository."
            if socket_id and sio is not None:
                logger.info(f"📤 Emitting query_complete to socket {socket_id}: {msg}")
                await sio.emit("query_complete", {"text": msg}, to=socket_id)
                logger.info(f"✅ Successfully emitted query_complete to socket {socket_id}")
            else:
                logger.warning(f"⚠️ Cannot emit query_complete: socket_id={socket_id}, sio={sio is not None}")
            logger.info(msg)  # log to server
            return msg

        context = _build_context(relevant_files)
        user_prompt = _build_user_prompt(query, context)
        chosen_model = "llama3.1-70b" if mode == "accurate" else "llama3.1-8b"

        full_text = ""
        stream = await llm.client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=chosen_model,
            stream=True
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            full_text += delta

            if socket_id and sio:
                await sio.emit("query_chunk", {"text": delta}, to=socket_id)

            logger.info(f"Stream chunk: {delta.strip()}")

        if socket_id and sio:
            await sio.emit("query_complete", {"text": full_text}, to=socket_id)

        logger.info("Streaming query completed successfully.")
        return full_text

    except Exception as e:
        logger.exception("Streaming query error")
        if socket_id and sio:
            await sio.emit("query_error", {"error": str(e), "repo_id": repo_id}, to=socket_id)
        return f"Error during streaming query: {e}"

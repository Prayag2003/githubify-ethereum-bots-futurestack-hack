import logging
import hashlib
from typing import List, Dict
from .cerebras_engine import CerebrasLLMClientAsync
from app.vector_db.vector_store import PineconeVectorStore

logger = logging.getLogger(__name__)

# Initialize Cerebras client
llm = CerebrasLLMClientAsync(default_model="llama3.1-8b")

def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]

def _build_context(relevant_files: List[Dict]) -> str:
    """Build formatted context from retrieved files."""
    context_parts = []
    for i, file_info in enumerate(relevant_files, 1):
        filename = file_info['filename']
        language = file_info['language']
        code = file_info['code']
        similarity = file_info['similarity']

        context_parts.append(f"""
### File {i}: `{filename}` (Relevance: {similarity})
**Language:** {language}
```{language}
{code}
```""")
    return "\n".join(context_parts)


async def handle_query(repo_id: str, query: str, mode: str = "fast") -> str:
    """
    Handle a standard (non-streaming) user query against the codebase.
    """
    try:
        repo_id = _get_repo_id(repo_id)
        logger.info(f"Querying repo {repo_id}: {query}")

        # Retrieve relevant code
        vector_store = PineconeVectorStore(repo_id)
        relevant_files = vector_store.search_with_context(query, top_k=5)

        if not relevant_files:
            return "I couldn't find any relevant code in this repository to answer your question."

        # Build context
        context = _build_context(relevant_files)

        # Choose model
        model_map = {"fast": "llama3.1-8b", "accurate": "llama3.1-70b"}
        chosen_model = model_map.get(mode, "llama3.1-8b")

        # Prompts
        system_prompt = """You are an expert code analysis assistant.
Analyze the code carefully and answer questions accurately.
Always reference specific files/functions when relevant.
If code is insufficient, explain what's missing."""

        user_prompt = f"""Based on the following code from the repository, answer this question:

**Question:** {query}

**Relevant Code Files:**
{context}

**Answer:**"""

        # Get response from Cerebras
        response = await llm.completion(
            user_prompt,
            model=chosen_model,
            system_prompt=system_prompt
        )

        answer = response["text"]
        logger.info(f"Generated answer ({len(answer)} chars)")
        return answer

    except Exception as e:
        logger.error(f"Query handling error: {e}")
        raise


async def handle_query_stream(repo_id: str, query: str, mode: str = "accurate", socket_id: str | None = None, sio=None) -> str:
    """
    Stream a user query to the client via Socket.IO and log each chunk.
    """
    try:
        repo_id = _get_repo_id(repo_id)
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
        chosen_model = "llama3.1-70b" if mode == "accurate" else "llama3.1-8b"

        system_prompt = """You are an expert code analysis assistant.
Analyze the code carefully and answer questions accurately.
Always reference specific files/functions when relevant.
If code is insufficient, explain what's missing."""

        user_prompt = f"""Based on the following code from the repository, answer this question:

**Question:** {query}

**Relevant Code Files:**
{context}

**Answer:**"""

        # Stream via Cerebras client
        full_text = ""
        stream = await llm.client.chat.completions.create(
            messages=[{"role": "system", "content": system_prompt},
                      {"role": "user", "content": user_prompt}],
            model=chosen_model,
            stream=True
        )

        async for chunk in stream:
            delta = chunk.choices[0].delta.content or ""
            full_text += delta

            # Emit to Socket.IO
            if socket_id and sio is not None:
                await sio.emit("query_chunk", {"text": delta}, to=socket_id)

            # Log chunk in FastAPI server logs
            logger.info(f"Stream chunk: {delta}")

        # Send final completion event
        if socket_id and sio is not None:
            await sio.emit("query_complete", {"text": full_text}, to=socket_id)

        logger.info("Streaming query complete.")
        return full_text

    except Exception as e:
        logger.error(f"Streaming query error: {e}")
        raise

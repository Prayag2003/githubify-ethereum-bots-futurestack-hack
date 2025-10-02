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

async def handle_query(repo_id: str, query: str, mode: str = "fast") -> str:
    """
    Handle user query against the codebase.
    
    Args:
        repo_id: Repository identifier
        query: User's question about the code
        mode: "fast" (llama3.1-8b) or "accurate" (llama3.1-70b)
    
    Returns:
        AI-generated answer based on relevant code
    """
    try:
        # Step 1: Retrieve relevant code from Pinecone
        repo_id = _get_repo_id(repo_id)
        logger.info(f"Querying repo {repo_id}: {query}")
        vector_store = PineconeVectorStore(repo_id)
        relevant_files = vector_store.search_with_context(query, top_k=5)
        
        if not relevant_files:
            return "I couldn't find any relevant code in this repository to answer your question. Please try rephrasing or ask about different aspects of the codebase."
        
        # Step 2: Build context from retrieved code
        context = _build_context(relevant_files)
        
        # Step 3: Select model based on mode
        model_map = {
            "fast": "llama3.1-8b",
            "accurate": "llama3.1-70b",
        }
        chosen_model = model_map.get(mode, "llama3.1-8b")
        
        # Step 4: Create prompt with context
        system_prompt = """You are an expert code analysis assistant. Your job is to:
1. Analyze the provided code snippets carefully
2. Answer the user's question accurately based on the code
3. Reference specific files and functions when relevant
4. Be concise but thorough
5. If the code doesn't contain enough information, say so

Always cite which file you're referring to when making claims."""

        user_prompt = f"""Based on the following code from the repository, please answer this question:

**Question:** {query}

**Relevant Code Files:**

{context}

**Instructions:**
- Analyze the code above
- Answer the question directly
- Reference specific files/functions
- If unsure, explain what's missing

**Answer:**"""

        # Step 5: Get response from Cerebras
        logger.info(f"Sending to Cerebras ({chosen_model})...")
        response = await llm.completion(
            user_prompt,
            model=chosen_model,
            system_prompt=system_prompt,
        )
        
        answer = response["text"]
        logger.info(f"Generated answer ({len(answer)} chars)")
        
        return answer
        
    except Exception as e:
        logger.error(f"Query handling error: {e}")
        raise


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
        """)
    return "\n".join(context_parts)
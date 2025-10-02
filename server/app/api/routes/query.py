from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services import query_engine
from app.utils.response import StandardResponse
import logging

router = APIRouter()
logger = logging.getLogger(__name__)


class QueryRequest(BaseModel):
    repo_id: str = Field(..., description="Repository ID to query")
    query: str = Field(..., description="Question about the codebase")
    mode: str = Field("fast", description="Query mode: 'fast' or 'accurate'")


@router.post("/")
async def query_codebase(payload: QueryRequest):
    """
    Ask a question about a codebase using AI.
    
    Example:
    POST /query
    {
        "repo_id": "abc123",
        "query": "How does error handling work in this codebase?",
        "mode": "fast"
    }
"""
    try:
        logger.info(f"Query: {payload.query} (repo: {payload.repo_id})")
        
        # Handle query with RAG
        answer = await query_engine.handle_query(
            payload.repo_id,
            payload.query,
            payload.mode
        )
        
        return StandardResponse.success(
            {
                "answer": answer,
                "repo_id": payload.repo_id,
                "mode": payload.mode
            },
            message="Query executed successfully."
        )
    except ValueError as e:
        # Example: repo_id not found
        logger.warning(f"Query failed: {e}")
        return StandardResponse.error(str(e), code=404)
    except Exception as e:
        logger.exception("Unexpected error during query execution")
        return StandardResponse.error(f"Unexpected error: {str(e)}", code=500)

from fastapi import APIRouter
from app.models.schemas import QueryRequest
from app.services import query_engine
from app.utils.response import StandardResponse
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/")
async def query_codebase(payload: QueryRequest):
    """
    Ask a question about a codebase.
    Returns standardized success or error response.
    """
    try:
        answer = await query_engine.handle_query(payload.repo_id, payload.query)
        return StandardResponse.success(
            {"answer": answer},
            message="Query executed successfully."
        )
    except ValueError as e:
        # Example: repo_id not found
        logger.warning(f"Query failed: {e}")
        return StandardResponse.error(str(e), code=404)
    except Exception as e:
        logger.exception("Unexpected error during query execution")
        return StandardResponse.error(f"Unexpected error: {str(e)}", code=500)

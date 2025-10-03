from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services import query_engine
from app.utils.response import StandardResponse
import logging
from app.services.socket_server import sio

router = APIRouter()
logger = logging.getLogger(__name__)


class QueryRequest(BaseModel):
    repo_id: str = Field(..., description="Repository ID to query")
    query: str = Field(..., description="Question about the codebase")
    mode: str = Field("fast", description="Query mode: 'fast' or 'accurate'")
    socket_id: str | None = Field(None, description="Socket.IO client ID for streaming")


from fastapi import BackgroundTasks

@router.post("/")
async def query_codebase(payload: QueryRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Query: {payload.query} (repo: {payload.repo_id})")
        print("payload socket id", payload.socket_id)

        if payload.socket_id:
            logger.info(f"Streaming enabled for socket_id: {payload.socket_id}")

            # Launch streaming in background, don't block POST
            background_tasks.add_task(
                query_engine.handle_query_stream,
                payload.repo_id,
                payload.query,
                payload.mode,
                payload.socket_id,
                sio
            )

            return StandardResponse.success(
                {"repo_id": payload.repo_id, "mode": payload.mode},
                message="Streaming started. Listen on Socket.IO for response."
            )

        # Normal blocking mode
        answer = await query_engine.handle_query(
            payload.repo_id,
            payload.query,
            payload.mode
        )

        return StandardResponse.success(
            {"answer": answer, "repo_id": payload.repo_id, "mode": payload.mode},
            message="Query executed successfully."
        )

    except ValueError as e:
        logger.warning(f"Query failed: {e}")
        return StandardResponse.error(str(e), code=404)
    except Exception as e:
        logger.exception("Unexpected error during query execution")
        return StandardResponse.error(f"Unexpected error: {str(e)}", code=500)

from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services import query_engine
from app.services.chat_streaming_service import ChatStreamingService
from app.utils.response import StandardResponse
import logging
from app.services.socket_server import sio

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize chat streaming service with simplified socket server
chat_streaming_service = ChatStreamingService(sio)


class QueryRequest(BaseModel):
    repo_id: str = Field(..., description="Repository ID to query")
    query: str = Field(..., description="Question about the codebase")
    mode: str = Field("fast", description="Query mode: 'fast' or 'accurate'")
    socket_id: str | None = Field(None, description="Socket.IO client ID for streaming")


class JoinRepoRequest(BaseModel):
    socket_id: str = Field(..., description="Socket.IO client ID")
    repo_id: str = Field(..., description="Repository ID to join")


from fastapi import BackgroundTasks

@router.post("/")
async def query_codebase(payload: QueryRequest, background_tasks: BackgroundTasks):
    try:
        logger.info(f"Query: {payload.query} (repo: {payload.repo_id})")
        print("payload socket id", payload.socket_id)

        if payload.socket_id:
            logger.info(f"Streaming enabled for socket_id: {payload.socket_id}")

            # Launch streaming in background using our new chat streaming service
            background_tasks.add_task(
                chat_streaming_service.stream_chat_response,
                payload.repo_id,
                payload.query,
                payload.mode,
                payload.socket_id
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


@router.post("/join-repo")
async def join_repository(payload: JoinRepoRequest):
    """Join a socket connection to a repository room."""
    try:
        logger.info(f"Joining socket {payload.socket_id} to repo {payload.repo_id}")
        await sio.enter_room(payload.socket_id, payload.repo_id)
        
        return StandardResponse.success(
            {"socket_id": payload.socket_id, "repo_id": payload.repo_id},
            message="Successfully joined repository room."
        )
        
    except Exception as e:
        logger.exception("Error joining repository room")
        return StandardResponse.error(f"Error joining repository: {str(e)}", code=500)


@router.post("/leave-repo")
async def leave_repository(payload: JoinRepoRequest):
    """Leave a socket connection from a repository room."""
    try:
        logger.info(f"Leaving socket {payload.socket_id} from repo {payload.repo_id}")
        await sio.leave_room(payload.socket_id, payload.repo_id)
        
        return StandardResponse.success(
            {"socket_id": payload.socket_id, "repo_id": payload.repo_id},
            message="Successfully left repository room."
        )
        
    except Exception as e:
        logger.exception("Error leaving repository room")
        return StandardResponse.error(f"Error leaving repository: {str(e)}", code=500)

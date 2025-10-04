"""
Simple chat streaming service for real-time AI responses.
"""
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class ChatStreamingService:
    """Service for streaming chat responses via Socket.IO."""
    
    def __init__(self, sio_server):
        self._sio_server = sio_server
    
    async def stream_chat_response(
        self, 
        repo_id: str, 
        query: str, 
        mode: str = "accurate",
        socket_id: Optional[str] = None
    ) -> str:
        """Stream a chat response to clients."""
        try:
            logger.info(f"Starting chat stream for repo {repo_id}: {query}")
            
            # Don't emit start event - client should send this
            # The client will send query_start when it initiates the request
            
            # Use existing query engine for streaming
            from .query_engine import handle_query_stream
            full_response = await handle_query_stream(repo_id, query, mode, socket_id, self._sio_server)
            
            # Note: query_complete is already emitted by handle_query_stream
            # No need to emit it again here to avoid duplicates
            
            return full_response
            
        except Exception as e:
            logger.error(f"Error in chat streaming: {e}")
            error_data = {"repo_id": repo_id, "error": str(e)}
            if socket_id:
                await self._sio_server.emit("query_error", error_data, to=socket_id)
            else:
                await self._sio_server.emit("query_error", error_data, room=repo_id)
            raise

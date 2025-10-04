"""
Simple Socket.IO server for real-time communication.
"""
import socketio
import logging

logger = logging.getLogger(__name__)

# Create Socket.IO server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    """Handle client connection."""
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def ping(sid, data):
    """Handle ping from client."""
    await sio.emit('pong', {'message': 'pong'}, to=sid)

@sio.event
async def join_repo(sid, data):
    """Handle joining a repository room."""
    repo_id = data.get('repo_id')
    if repo_id:
        await sio.enter_room(sid, repo_id)
        logger.info(f"Socket {sid} joined room {repo_id}")

@sio.event
async def leave_repo(sid, data):
    """Handle leaving a repository room."""
    repo_id = data.get('repo_id')
    if repo_id:
        await sio.leave_room(sid, repo_id)
        logger.info(f"Socket {sid} left room {repo_id}")

@sio.event
async def query_start(sid, data):
    """Handle query start event from client."""
    repo_id = data.get('repo_id')
    query = data.get('query')
    mode = data.get('mode')
    logger.info(f"Query started from socket {sid}: {query} (repo: {repo_id}, mode: {mode})")

# Export for use in other modules
__all__ = ["sio", "socket_app"]

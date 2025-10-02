import socketio
from fastapi import FastAPI

# Shared AsyncServer
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")
socket_app = socketio.ASGIApp(sio)

@sio.event
async def connect(sid, environ):
    print("Client connected:", sid)

@sio.event
async def disconnect(sid):
    print("Client disconnected:", sid)

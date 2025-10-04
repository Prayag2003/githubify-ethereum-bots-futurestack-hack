# Socket Service Architecture

This directory contains a clean, SOLID-compliant socket service implementation for real-time communication between the server and clients.

## Architecture Overview

The socket service follows SOLID principles and clean architecture patterns:

### SOLID Principles Applied

1. **Single Responsibility Principle (SRP)**
   - Each class has one clear responsibility
   - `SocketConnection`: Manages individual socket connections
   - `SocketRoomManager`: Manages room membership
   - `SocketEventHandler`: Handles socket events
   - `ConnectionManager`: Manages connection lifecycle

2. **Open/Closed Principle (OCP)**
   - `SocketEventHandler` can be extended for new event types without modification
   - New event handlers can be added by implementing the interface

3. **Liskov Substitution Principle (LSP)**
   - All implementations can be substituted with their interfaces
   - `ISocketService` can work with different implementations

4. **Interface Segregation Principle (ISP)**
   - Small, focused interfaces
   - `ISocketConnection`, `ISocketRoomManager`, `ISocketEventHandler`

5. **Dependency Inversion Principle (DIP)**
   - High-level modules depend on abstractions (interfaces)
   - `SocketService` depends on `ISocketRoomManager` and `ISocketEventHandler`

## File Structure

```
socket/
├── __init__.py                 # Package exports
├── interfaces.py              # All interfaces (ISP)
├── connection.py              # Individual socket connection (SRP)
├── connection_manager.py      # Connection lifecycle management (SRP)
├── room_manager.py           # Room membership management (SRP)
├── event_handler.py          # Event handling (SRP, OCP)
├── socket_service.py         # Main service (DIP)
└── README.md                 # This documentation
```

## Key Features

### Repository-Based Rooms
- Clients can join repository-specific rooms using `repo_id`
- Messages can be broadcast to all clients in a repository room
- Automatic cleanup when clients disconnect

### Event System
- **Connection Events**: `connect`, `disconnect`
- **Room Events**: `join_repo`, `leave_repo`
- **Chat Events**: `chat_start`, `chat_chunk`, `chat_complete`, `chat_error`
- **Health Check**: `ping`, `pong`

### Error Handling
- Comprehensive error handling with proper logging
- Graceful degradation when connections fail
- Automatic cleanup of orphaned connections

## Usage Examples

### Server-Side

```python
from app.services.socket import SocketService

# Initialize service
socket_service = SocketService(sio_server)

# Stream to all clients in a repository
await socket_service.stream_to_repo("repo-123", "chat_chunk", {"text": "Hello"})

# Stream to specific client
await socket_service.stream_to_client("socket-456", "chat_complete", {"text": "Done"})
```

### Client-Side

```typescript
// Join a repository room
await joinRepository("repo-123");

// Send a message (automatically streams to repository room)
await sendMessage("What does this function do?");

// Leave repository room
await leaveRepository("repo-123");
```

## API Endpoints

### POST /query/join-repo
Join a socket connection to a repository room.

```json
{
  "socket_id": "socket-123",
  "repo_id": "repo-456"
}
```

### POST /query/leave-repo
Leave a socket connection from a repository room.

```json
{
  "socket_id": "socket-123", 
  "repo_id": "repo-456"
}
```

## Testing

Run the test script to verify the implementation:

```bash
cd server
python test_socket_implementation.py
```

## Benefits

1. **Maintainable**: Clear separation of concerns
2. **Extensible**: Easy to add new event types
3. **Testable**: Each component can be tested independently
4. **Scalable**: Room-based architecture supports multiple repositories
5. **Reliable**: Comprehensive error handling and cleanup

## Integration with Chat System

The socket service integrates seamlessly with the chat streaming system:

1. Client connects and joins repository room
2. Client sends message via HTTP POST
3. Server processes message and streams response via socket
4. Client receives real-time streaming chunks
5. Automatic cleanup on disconnect

This architecture provides a robust foundation for real-time chat functionality while maintaining clean, maintainable code.

import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import repos, query, architect, tree
from app.services import socket_server

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True
)

# Set specific loggers to INFO level
logging.getLogger("app").setLevel(logging.INFO)
logging.getLogger("app.parser").setLevel(logging.INFO)
logging.getLogger("app.vector_db").setLevel(logging.INFO)

app = FastAPI(
    title="Codebase Comprehender",
    description="API for ingesting and querying codebases",
    version="0.1.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(repos.router, prefix="/repos", tags=["Repositories"])
app.include_router(query.router, prefix="/query", tags=["Queries"])
app.include_router(architect.router, prefix="/diagram", tags=["Architecture"])
app.include_router(tree.router, prefix="/tree", tags=["Architecture"])

app.mount("/socket.io", socket_server.socket_app)

@app.on_event("startup")
async def startup_event():
    """Configure logging on startup."""
    logger = logging.getLogger(__name__)
    logger.info("🚀 Starting Codebase Comprehender API...")
    logger.info("📊 Logging configured for INFO level")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Codebase Comprehender API running"}


if __name__ == "__main__":
    import uvicorn

    # Read port from environment (default: 8000)
    port = int(os.getenv("PORT", 8000))

    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=port,
        reload=True
    )

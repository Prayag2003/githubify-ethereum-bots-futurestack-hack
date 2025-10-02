import logging
from fastapi import FastAPI
from app.api.routes import repos, query, architect, tree

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    force=True  # Force reconfiguration
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

# Register routes
app.include_router(repos.router, prefix="/repos", tags=["Repositories"])
app.include_router(query.router, prefix="/query", tags=["Queries"])
app.include_router(architect.router, prefix="/diagram", tags=["Architecture"])
app.include_router(tree.router, prefix="/tree", tags=["Architecture"])

@app.on_event("startup")
async def startup_event():
    """Configure logging on startup."""
    logger = logging.getLogger(__name__)
    logger.info("🚀 Starting Codebase Comprehender API...")
    logger.info("📊 Logging configured for INFO level")

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Codebase Comprehender API running"}

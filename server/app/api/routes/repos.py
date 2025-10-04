import logging
import re
from fastapi import APIRouter
from app.models.schemas import RepoRequest
from app.services import repo_manager
from app.vector_db.vector_store import PineconeVectorStore
from app.utils.response import StandardResponse
from app.parser.ast_parser import load_codebase_as_graph_docs

router = APIRouter()
logger = logging.getLogger(__name__)

def sanitize_github_url(url: str) -> str:
    """Sanitize the GitHub URL to ensure it has https:// protocol."""
    if not url.startswith("https://"):
        return f"https://{url}"
    print("URL", url)
    return url

@router.post("/ingest")
def ingest_repo(payload: RepoRequest):
    """Clone, parse, embed, and store repository in Pinecone."""
    try:
        sanitized_url = sanitize_github_url(payload.github_url)
         # Simple regex to check for a valid GitHub URL format

        if not re.match(r"https://github\.com/[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+(\.git)?", sanitized_url):
            logger.error("❌ Invalid GitHub URL format: %s", payload.github_url)
            return StandardResponse.error(f"Invalid GitHub URL format {sanitized_url}", code=400)
        
        # Step 1: Clone repository
        logger.info("🔗 Cloning repository: %s", payload.github_url)
        repo_id = repo_manager.clone_repo(sanitized_url, token=getattr(payload, "token", None))
        logger.info("✅ Repository cloned successfully: %s", repo_id)
        
        # Step 2: Parse to chunked documents
        logger.info("📄 Starting codebase parsing for %s", repo_id)
        codebase = load_codebase_as_graph_docs(f"repos/{repo_id}")
        
        if not codebase:
            logger.warning("❌ No code files found in repository")
            return StandardResponse.error("No code files found", code=400)
        
        logger.info("📦 Found %d document chunks ready for processing", len(codebase))
        
        # Step 3: Create embeddings and store in Pinecone
        logger.info("🔮 Starting vector storage process...")
        vector_store = PineconeVectorStore(repo_id)
        result = vector_store.add_documents(codebase)
        
        if not result.get("success"):
            logger.error("❌ Vector storage failed: %s", result.get('error'))
            return StandardResponse.error(
                f"Failed to store: {result.get('error')}",
                code=500
            )
        
        # Success
        logger.info("🎉 REPOSITORY INGESTION COMPLETE!")
        logger.info("📊 FINAL RESULTS:")
        logger.info("  🆔 Repository ID: %s", repo_id)
        logger.info("  📦 Vectors stored: %d", result["count"])
        logger.info("  🗂️  Index name: %s", result["index_name"])
        logger.info("  🏷️  Namespace: %s", result.get("namespace", "default"))
        
        return StandardResponse.success(
            {
                "repo_id": repo_id,
                "status": "ingested",
                "files_processed": result["count"],
                "index_name": result["index_name"]
            },
            message=f"Successfully ingested {result['count']} document chunks"
        )
        
    except Exception as e:
        logger.exception("Ingestion error")
        return StandardResponse.error(str(e), code=500)
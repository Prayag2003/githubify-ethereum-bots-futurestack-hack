import logging
from fastapi import APIRouter
from app.models.schemas import RepoRequest
from app.services import repo_manager
from app.vector_db.vector_store import PineconeVectorStore
from app.utils.response import StandardResponse
from app.parser.ast_parser import load_codebase_as_graph_docs

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/ingest")
def ingest_repo(payload: RepoRequest):
    """Clone, parse, embed, and store repository in Pinecone."""
    try:
        # Step 1: Clone repository
        logger.info(f"Cloning: {payload.github_url}")
        repo_id = repo_manager.clone_repo(payload.github_url)
        
        # Step 2: Parse to AST documents
        logger.info(f"Parsing codebase for {repo_id}")
        codebase = load_codebase_as_graph_docs(f"repos/{repo_id}")
        
        if not codebase:
            return StandardResponse.error("No code files found", code=400)
        
        logger.info(f"Found {len(codebase)} files")
        
        # Step 3: Create embeddings and store in Pinecone
        logger.info("Creating embeddings with CodeBERT...")
        vector_store = PineconeVectorStore(repo_id)
        result = vector_store.add_documents(codebase)
        
        if not result.get("success"):
            return StandardResponse.error(
                f"Failed to store: {result.get('error')}",
                code=500
            )
        
        # Success
        return StandardResponse.success(
            {
                "repo_id": repo_id,
                "status": "ingested",
                "files_processed": result["count"],
                "index_name": result["index_name"]
            },
            message=f"Successfully ingested {result['count']} files"
        )
        
    except Exception as e:
        logger.exception("Ingestion error")
        return StandardResponse.error(str(e), code=500)
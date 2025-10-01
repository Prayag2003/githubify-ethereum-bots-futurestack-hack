from fastapi import APIRouter, HTTPException
from app.models.schemas import RepoRequest
from app.services import repo_manager
from app.utils.response import StandardResponse
import subprocess
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/ingest")
def ingest_repo(payload: RepoRequest):
    """
    Clone and parse a repository from GitHub URL.
    Returns standardized success or error response.
    """
    try:
        repo_id = repo_manager.clone_repo(payload.github_url)
        return StandardResponse.success(
            {"repo_id": repo_id, "status": "ingested"},
            message="Repository ingested successfully."
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Git clone failed: {e}")
        return StandardResponse.error(f"Failed to clone repository: {e}", code=500)
    except Exception as e:
        logger.exception("Unexpected error during repo ingestion")
        return StandardResponse.error(f"Unexpected error: {str(e)}", code=500)

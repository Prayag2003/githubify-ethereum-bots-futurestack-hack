from fastapi import APIRouter, HTTPException
from app.models.schemas import RepoRequest
from app.services import repo_manager, ast_parser
from app.utils.response import StandardResponse
import subprocess
import logging
import os
from app.parser.ast_parser import load_codebase_as_graph_docs

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/ingest")
def ingest_repo(payload: RepoRequest):
    """
    Clone, parse a repository from GitHub URL, and store AST JSON per file.
    Returns standardized success or error response.
    """
    try:
        # Step 1: Clone repo
        repo_id = repo_manager.clone_repo(payload.github_url)

        # Step 2: AST Parser
        codebase = load_codebase_as_graph_docs("repos/" + repo_id)
        # print("codebase\n", codebase)

        # Step 3: Return response
        return StandardResponse.success(
            {
                "repo_id": repo_id,
                "status": "ingested",
                # "parsed_files_count": len(parsed_files),
                # "parsed_files": parsed_files
            },
            message="Repository ingested and parsed successfully."
        )
    except subprocess.CalledProcessError as e:
        logger.error(f"Git clone failed: {e}")
        return StandardResponse.error(f"Failed to clone repository: {e}", code=500)
    except Exception as e:
        logger.exception("Unexpected error during repo ingestion")
        return StandardResponse.error(f"Unexpected error: {str(e)}", code=500)

# app/api/routes/repos.py
import logging
from fastapi import APIRouter
from app.models.schemas import RepoRequest
from app.services import repo_manager
from app.utils.response import StandardResponse
from app.agents.architect.tree_generator import build_code_tree

router = APIRouter()
logger = logging.getLogger(__name__)


ignore_dirs = [
            ".git", "node_modules", "__pycache__", "venv", "env", "build", "dist",
            ".next", ".nuxt", "coverage", "migrations", "static", "media", "uploads"
        ]

@router.post("/code-tree")
def repo_code_tree(payload: RepoRequest):
    """Return folder-wise hierarchical tree of the repo."""
    try:
        logger.info(f"Cloning: {payload.github_url}")
        repo_id = repo_manager.clone_repo(payload.github_url)
        repo_path = f"repos/{repo_id}"

        logger.info(f"Building code tree for {repo_id}")
        tree = build_code_tree(repo_path, ignore_dirs=ignore_dirs)

        return StandardResponse.success(
            {"repo_id": repo_id, "tree": tree},
            message="Code tree generated successfully"
        )

    except Exception as e:
        logger.exception("Code tree generation error")
        return StandardResponse.error(str(e), code=500)
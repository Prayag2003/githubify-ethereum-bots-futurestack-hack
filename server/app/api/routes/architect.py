import logging
import hashlib
from fastapi import APIRouter, Query
from app.agents.architect.architecture_agent import generate_mermaid_architecture
from app.utils.response import StandardResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]


def normalize_mermaid(diagram: str) -> str:
    """Clean and normalize Mermaid diagram for rendering."""
    if not diagram:
        return "graph TD\n  A[Error] --> B[Empty diagram]"

    cleaned = diagram.strip()

    # Remove code fences if they exist
    if cleaned.startswith("```mermaid"):
        cleaned = cleaned[len("```mermaid"):].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()

    # Convert escaped newlines into real ones
    cleaned = cleaned.replace("\\n", "\n")

    # Ensure it starts with "graph"
    if not cleaned.startswith("graph"):
        cleaned = "graph TD\n" + cleaned

    # Optional: remove excessive whitespace and normalize indentation
    lines = [line.rstrip() for line in cleaned.split("\n") if line.strip()]
    cleaned = "\n".join(lines)

    return cleaned


@router.get("/diagram")
async def get_architecture_diagram(repo_id: str = Query(..., description="Repository ID")):
    """
    Generate Mermaid architecture diagram for a given repository.
    """
    try:
        repo_id = _get_repo_id(repo_id)
        repo_root = f"repos/{repo_id}"
        diagram = await generate_mermaid_architecture(repo_root)
        diagram = normalize_mermaid(diagram=diagram)

        return StandardResponse.success(
            {"repo_id": repo_id, "diagram": diagram},
            message="Architecture diagram generated"
        )
    except Exception as e:
        logger.exception("Failed to generate diagram")
        return StandardResponse.error(str(e), code=500)

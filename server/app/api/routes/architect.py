import logging
import hashlib
import json
import os
import re
from fastapi import APIRouter, Query
from app.agents.architect.architecture_agent import generate_mermaid_architecture
from app.utils.response import StandardResponse

# Mermaid diagram start keywords
_MERMAID_START_KEYWORDS = [
    "graph", "flowchart", "sequenceDiagram", "classDiagram", "stateDiagram",
    "journey", "gantt", "pie", "gitgraph", "erDiagram", "mindmap", "timeline"
]

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]


def normalize_mermaid(diagram: str) -> str:
    """Robustly clean mermaid source:
      - remove triple-backtick fences (with/without language)
      - convert escaped \\n to real newlines
      - preserve existing mermaid top-level keyword (don't force 'graph' blindly)
    """
    if not diagram:
        return "graph TD\n  A[Error] --> B[Empty diagram]"

    # accept bytes
    if isinstance(diagram, bytes):
        try:
            diagram = diagram.decode("utf-8")
        except Exception:
            diagram = diagram.decode("utf-8", errors="ignore")

    text = str(diagram).strip()

    # remove leading ``` or ```lang (case-insensitive)
    fence_re = re.compile(r'^\s*```(?:\s*\w+)?\s*', flags=re.IGNORECASE)
    if fence_re.match(text):
        text = fence_re.sub("", text, count=1)
        if text.rstrip().endswith("```"):
            text = text.rstrip()[:-3].rstrip()

    text = text.replace("\\n", "\n")

    # keep intended blank lines; only trim trailing spaces per line
    lines = [line.rstrip() for line in text.splitlines()]
    text = "\n".join(lines).strip("\n")

    # If first non-empty token is not a known mermaid starter, add a default
    first = ""
    for ln in text.splitlines():
        if ln.strip():
            first = ln.strip().split()[0].lower()
            break

    if not any(first.startswith(k.lower()) for k in _MERMAID_START_KEYWORDS):
        text = "graph TD\n" + text

    return text


def save_mermaid_to_file(diagram: str, repo_id: str) -> str:
    """Save Mermaid diagram to .mmd file and return the file path."""
    # Create diagrams directory if it doesn't exist
    diagrams_dir = "diagrams"
    os.makedirs(diagrams_dir, exist_ok=True)
    
    # Create filename with repo_id
    filename = f"{repo_id}_architecture.mmd"
    filepath = os.path.join(diagrams_dir, filename)
    
    # Write diagram to file
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(diagram)
    
    logger.info(f"Mermaid diagram saved to: {filepath}")
    return filepath


def parse_and_save_json_output(json_output: str, repo_id: str = None) -> str:
    """
    Parse JSON output and save Mermaid diagram to .mmd file.
    
    Args:
        json_output: JSON string containing the API response
        repo_id: Optional repo_id, will be extracted from JSON if not provided
    
    Returns:
        File path of the saved .mmd file
    """
    try:
        # Parse JSON
        data = json.loads(json_output)
        
        # Extract repo_id and diagram
        if repo_id is None:
            repo_id = data.get("data", {}).get("repo_id", "unknown")
        
        diagram = data.get("data", {}).get("diagram", "")
        
        if not diagram:
            raise ValueError("No diagram found in JSON data")
        
        # Normalize and save
        normalized_diagram = normalize_mermaid(diagram)
        filepath = save_mermaid_to_file(normalized_diagram, repo_id)
        
        return filepath
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON: {e}")
        raise ValueError(f"Invalid JSON format: {e}")
    except Exception as e:
        logger.error(f"Failed to parse and save: {e}")
        raise


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

        # Save diagram to .mmd file
        filepath = save_mermaid_to_file(diagram, repo_id)

        return StandardResponse.success(
            {"repo_id": repo_id, "diagram": diagram, "file_path": filepath},
            message="Architecture diagram generated and saved"
        )
    except Exception as e:
        logger.exception("Failed to generate diagram")
        return StandardResponse.error(str(e), code=500)

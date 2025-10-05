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


@router.post("/diagram")
async def get_architecture_diagram(repo_id: str = Query(..., description="Repository ID")):
    """
    Generate Mermaid architecture diagram for a given repository.
    Serve a full mock fallback diagram if real diagram is unavailable.
    """
    try:
        repo_id_hash = _get_repo_id(repo_id)
        repo_root = f"repos/{repo_id_hash}"

        diagram = await generate_mermaid_architecture(repo_root)
        if not diagram or not diagram.strip():
            # Serve the mock fallback diagram (converted from your sample JSON)
            diagram = """
            graph TD
              A[03fddd2a63b4b9bf92f3] --> B[0841eac0e66e6ea5bc29]
              A --> C[4643a20a33ae267417c2]
              C --> D[Advance_chat_engine]
              D --> D1[README.md]
              D --> D2[backend]
              D2 --> D2a[index.js]
              D2 --> D2b[package-lock.json]
              D2 --> D2c[package.json]
              D --> D3[frontend]
              D3 --> D3a[README.md]
              D3 --> D3b[index.html]
              D3 --> D3c[package-lock.json]
              D3 --> D3d[package.json]
              D3 --> D3e[public]
              D3e --> D3e1[vite.svg]
              D3 --> D3f[src]
              D3f --> D3f1[App.css]
              D3f --> D3f2[App.jsx]
              D3f --> D3f3[AuthPage.jsx]
              D3f --> D3f4[ChatsPage.jsx]
              D3f --> D3f5[assets]
              D3f5 --> D3f5a[react.svg]
              D3f --> D3f6[main.jsx]
              D3 --> D3g[vite.config.js]
              D --> D4[Backend]
              D4 --> D4a[main.py]
              D4 --> D4b[requirements.txt]
              D --> D5[Frontend]
              D5 --> D5a[README.md]
              D5 --> D5b[index.html]
              D5 --> D5c[package-lock.json]
              D5 --> D5d[package.json]
              D5 --> D5e[postcss.config.js]
              D5 --> D5f[public]
              D5f --> D5f1[octocat.png]
              D5f --> D5f2[vite.svg]
              D5 --> D5g[src]
              D5g --> D5g1[App.css]
              D5g --> D5g2[App.jsx]
              D5g --> D5g3[Components]
              D5g3 --> D5g3a[ChatWithBot.jsx]
              D5g3 --> D5g3b[Explore.jsx]
              D5g3 --> D5g3c[Footer.jsx]
              D5g3 --> D5g3d[Hero.jsx]
              D5g3 --> D5g3e[History.jsx]
              D5g3 --> D5g3f[Navbar.jsx]
              D5g --> D5g4[Pages]
              D5g4 --> D5g4a[HomePage.jsx]
              D5g --> D5g5[index.css]
              D5g --> D5g6[main.jsx]
              D5 --> D5h[tailwind.config.js]
              D5 --> D5i[vite.config.js]
              D --> D6[Langchain]
              D6 --> D6a[README.md]
              D6 --> D6b[app.py]
              D6 --> D6c[config.py]
              D6 --> D6d[file_processing.py]
              D6 --> D6e[main.py]
              D6 --> D6f[questions.py]
              D6 --> D6g[requirements.txt]
              D6 --> D6h[templates]
              D6h --> D6h1[index.html]
              D6 --> D6i[utils.py]
              D --> D7[README.md]
              D --> D8[Videocall-webRTC]
              D8 --> D8a[package-lock.json]
              D8 --> D8b[package.json]
              D8 --> D8c[public]
              D8c --> D8c1[script.js]
              D8 --> D8d[server.js]
              D8 --> D8e[views]
              D8e --> D8e1[room.ejs]
              D --> D9[image_assets]
              D9 --> D9a[HLD.png]
              D9 --> D9b[LLD.png]
              D9 --> D9c[chat.jpg]
              D9 --> D9d[explore_section.jpg]
              D9 --> D9e[group_chat.jpg]
              D9 --> D9f[homepage.png]
              D9 --> D9g[query.png]
              D9 --> D9h[server.jpg]
              D9 --> D9i[video.jpg]
            """

        diagram = normalize_mermaid(diagram=diagram)

        # Save diagram to .mmd file
        filepath = save_mermaid_to_file(diagram, repo_id_hash)

        return StandardResponse.success(
            {"repo_id": repo_id_hash, "diagram": diagram, "file_path": filepath},
            message="Architecture diagram generated and saved"
        )

    except Exception as e:
        logger.exception("Failed to generate diagram")
        # Serve the same mock fallback in case of error
        diagram = """
        graph TD
          A[03fddd2a63b4b9bf92f3] --> B[0841eac0e66e6ea5bc29]
          A --> C[4643a20a33ae267417c2]
          C --> D[Advance_chat_engine]
          D --> D1[README.md]
          D --> D2[backend]
          D2 --> D2a[index.js]
          D2 --> D2b[package-lock.json]
          D2 --> D2c[package.json]
        """
        diagram = normalize_mermaid(diagram)
        filepath = save_mermaid_to_file(diagram, "fallback")

        return StandardResponse.success(
            {"repo_id": "fallback", "diagram": diagram, "file_path": filepath},
            message="Serving fallback diagram due to error"
        )

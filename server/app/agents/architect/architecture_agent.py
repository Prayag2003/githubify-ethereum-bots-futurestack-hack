import asyncio
import logging
from app.agents.mermaid.mermaid_generator import MermaidArchitectureGenerator
from app.agents.architect.tree_generator import build_code_tree

logger = logging.getLogger(__name__)

async def generate_mermaid_architecture(repo_root: str) -> str:
    """
    Generate a Mermaid architecture diagram for a repository.
    """
    ignore_dirs = [
        ".git", "node_modules", "__pycache__", "venv", "env",
        "build", "dist", ".next", ".nuxt", "coverage",
        "migrations", "static", "media", "uploads"
    ]

    # Step 1: Build the folder tree
    tree = build_code_tree(repo_root, ignore_dirs)

    # Step 2: Initialize generator with Cerebras LLM
    generator = MermaidArchitectureGenerator(model="llama3.3-70b")

    # Step 3: Generate diagram (iterative refinement)
    diagram = await generator.generate_diagram(repo_root, tree)

    return diagram

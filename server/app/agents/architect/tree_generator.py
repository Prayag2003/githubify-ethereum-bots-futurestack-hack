from app.services.cerebras_engine import CerebrasLLMClientAsync

import os
from typing import Dict, List

def build_code_tree(root_path: str, ignore_dirs: List[str]) -> Dict:
    """
    Recursively build a folder-wise hierarchical tree.
    Returns dict with {name, type, children, ext}
    """
    if ignore_dirs is None:
        ignore_dirs = [
            ".git", "node_modules", "__pycache__", "venv", "env", "build", "dist",
            ".next", ".nuxt", "coverage", "migrations", "static", "media", "uploads"
        ]

    tree = {"name": os.path.basename(root_path), "type": "folder", "children": []}
    
    try:
        entries = sorted(os.listdir(root_path))
    except Exception:
        return tree  # fallback if inaccessible

    for entry in entries:
        if entry in ignore_dirs or entry.startswith("."):
            continue
        
        full_path = os.path.join(root_path, entry)
        if os.path.isdir(full_path):
            tree["children"].append(build_code_tree(full_path, ignore_dirs))
        else:
            tree["children"].append({
                "name": entry,
                "type": "file",
                "ext": entry.rsplit(".", 1)[-1] if "." in entry else "",
            })
    
    return tree


def tree_to_text(tree: dict, indent: int = 0) -> str:
    """
    Convert folder-wise tree to indented text for LLM prompt.
    """
    spacer = "  " * indent
    text = f"{spacer}- {tree['name']} ({tree['type']})\n"
    for child in tree.get("children", []):
        text += tree_to_text(child, indent + 1)
    return text

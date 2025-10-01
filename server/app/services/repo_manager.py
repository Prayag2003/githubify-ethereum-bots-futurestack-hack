import os
import hashlib
import subprocess

BASE_DIR = "repos"

def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]

def clone_repo(github_url: str) -> str:
    """Clone repo from GitHub and return stable repo_id."""
    repo_id = _get_repo_id(github_url)
    repo_path = os.path.join(BASE_DIR, repo_id)

    if not os.path.exists(repo_path):
        os.makedirs(repo_path, exist_ok=True)
        subprocess.run(["git", "clone", github_url, repo_path], check=True)
        # TODO: Trigger parsing + indexing
    else:
        print(f"Repo already cloned at {repo_path}")

    return repo_id

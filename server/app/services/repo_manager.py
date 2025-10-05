import os
import hashlib
import subprocess
import requests
from typing import Optional

BASE_DIR = "repos"

def _get_repo_id(github_url: str, length: int = 20) -> str:
    """Generate deterministic repo ID from GitHub URL using SHA256."""
    sha = hashlib.sha256(github_url.encode("utf-8")).hexdigest()
    return sha[:length]

def clone_repo(github_url: str, token: Optional[str] = None) -> tuple[str, bool]:
    repo_id = _get_repo_id(github_url)
    repo_path = os.path.join(BASE_DIR, repo_id)

    if not os.path.exists(repo_path):
        os.makedirs(repo_path, exist_ok=True)
        print(f"Cloning fresh repo into {repo_path}...")

        repo_api_url = github_url.replace("https://github.com/", "https://api.github.com/repos/")
        headers = {'Authorization': f'token {token}'} if token else {}
        response = requests.get(repo_api_url, headers=headers)
        response.raise_for_status()

        clone_url = github_url
        if token:
            clone_url = github_url.replace("https://", f"https://oauth2:{token}@")

        subprocess.run(["git", "clone", clone_url, repo_path], check=True)
        print("Repository cloned successfully.")
        return repo_id, False  # False = not already cloned
    else:
        print(f"Repo already cloned at {repo_path}")
        return repo_id, True   # True = already cloned

import os
import uuid
import subprocess

BASE_DIR = "repos"

def clone_repo(github_url: str) -> str:
    """Clone repo from GitHub and return repo_id."""
    repo_id = str(uuid.uuid4())
    repo_path = os.path.join(BASE_DIR, repo_id)
    os.makedirs(repo_path, exist_ok=True)

    # Clone repo
    subprocess.run(["git", "clone", github_url, repo_path], check=True)

    # TODO: Trigger parsing + indexing
    return repo_id

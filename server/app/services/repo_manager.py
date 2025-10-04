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

def clone_repo(github_url: str, token: Optional[str] = None) -> str:
    """Clone repo from GitHub and return stable repo_id."""
    repo_id = _get_repo_id(github_url)
    repo_path = os.path.join(BASE_DIR, repo_id)

    if not os.path.exists(repo_path):
        os.makedirs(repo_path, exist_ok=True)
        
        # Validate repository existence via API call first
        repo_api_url = github_url.replace("https://github.com/", "https://api.github.com/repos/")
        headers = {'Authorization': f'token {token}'} if token else {}
        response = requests.get(repo_api_url, headers=headers)
        
        if response.status_code == 404:
            raise ValueError(f"Repository not found or invalid: {github_url}")
        if response.status_code == 401:
            raise ValueError("Authentication failed. Check your token and permissions.")
            
        try:
            # Construct the git clone command
            clone_url = github_url
            if token:
                # Embed the token into the URL for authentication
                parsed_url = github_url.replace("https://", f"https://oauth2:{token}@")
                clone_url = parsed_url

            subprocess.run(["git", "clone", clone_url, repo_path], check=True)
            print("Repository cloned successfully.")
        except subprocess.CalledProcessError as e:
            # Handle git clone specific errors (e.g., failed authentication)
            if "Authentication failed" in str(e):
                 raise ValueError("Authentication failed for private repository. Is the token correct?")
            raise e
    else:
        repo_id = ""
        print(f"Repo already cloned at {repo_path}")

    return repo_id
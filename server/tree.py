from pathlib import Path

# Customize these patterns to ignore
IGNORE = {
    "__pycache__",
    ".DS_Store",
    "node_modules",
    ".venv",
    "venv",
    ".pytest_cache",
    "repos/"
}

def get_repo_structure(root_path: str):
    repo_structure = {}

    root = Path(root_path).resolve()
    
    def scan_dir(path: Path):
        structure = {}
        for item in path.iterdir():
            if item.name in IGNORE:
                continue
            if item.is_dir():
                structure[item.name] = scan_dir(item)
            else:
                structure[item.name] = None
        return structure

    repo_structure[root.name] = scan_dir(root)
    return repo_structure

def print_structure(structure, indent=0):
    for name, sub in structure.items():
        print(" " * indent + name)
        if isinstance(sub, dict):
            print_structure(sub, indent + 4)

if __name__ == "__main__":
    root_path = "."  # current directory
    repo = get_repo_structure(root_path)
    print_structure(repo)

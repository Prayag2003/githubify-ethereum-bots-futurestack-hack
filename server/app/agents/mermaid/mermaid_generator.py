import os
import logging
from typing import List, Dict
from app.services.cerebras_engine import CerebrasLLMClientAsync

logger = logging.getLogger(__name__)


class MermaidArchitectureGenerator:
    """Generate architecture diagrams iteratively using Cerebras LLMs."""

    def __init__(self, model: str = "llama3.1-70b"):
        """
        Initialize with Cerebras model.
        Options: llama3.1-8b, llama3.1-70b, llama3.3-70b, qwen2.5-coder-32b-instruct
        """
        self.llm = CerebrasLLMClientAsync(default_model=model)
        self.model = model

    async def generate_diagram(
        self,
        repo_root: str,
        tree_structure: Dict,
        batch_size: int = 10,
    ) -> str:
        """
        Generate Mermaid architecture diagram iteratively.

        Args:
            repo_root: Path to repository
            tree_structure: Folder tree structure (from build_code_tree)
            batch_size: Number of files to process per iteration
        """
        # Collect all repo files
        all_files = self._collect_files(repo_root, tree_structure)
        logger.info(f"Found {len(all_files)} files to process")

        # Read README if present
        readme_content = self._read_readme(repo_root)

        # Initial diagram generation with first batch
        current_mermaid = await self._generate_initial_diagram(
            tree_structure,
            readme_content,
            all_files[:batch_size],
        )
        logger.info("Initial diagram generated")

        # Iterative refinement with remaining batches
        for i in range(batch_size, len(all_files), batch_size):
            batch = all_files[i:i + batch_size]
            logger.info(
                f"Refining with batch {i//batch_size + 1}/"
                f"{(len(all_files)-1)//batch_size + 1}"
            )

            current_mermaid = await self._refine_diagram(
                current_mermaid,
                batch,
            )

        logger.info("Final diagram generated")
        return current_mermaid

    # -------------------------------
    # Helpers
    # -------------------------------
    def _collect_files(self, repo_root: str, tree: Dict) -> List[Dict]:
        """Collect all files with their content from folder tree."""
        files = []

        def traverse(node: Dict, path: str = ""):
            current_path = os.path.join(path, node['name'])

            if node['type'] == 'file':
                full_path = os.path.join(repo_root, current_path)
                content = self._read_file_safe(full_path)
                files.append({
                    "path": current_path,
                    "name": node['name'],
                    "ext": node.get('ext', ''),
                    "content": content,
                })
            elif node['type'] == 'folder':
                for child in node.get("children", []):
                    traverse(child, current_path)

        traverse(tree)
        return files

    def _read_file_safe(self, filepath: str, max_size: int = 5000) -> str:
        """Safely read file content (truncate if too big)."""
        try:
            with open(filepath, "r", encoding="utf8", errors="ignore") as f:
                content = f.read(max_size)
                return content if len(content) < max_size else content + "..."
        except Exception:
            return ""

    def _read_readme(self, repo_root: str) -> str:
        """Read README file if present."""
        for name in ["README.md", "readme.md", "README", "Readme.md"]:
            path = os.path.join(repo_root, name)
            if os.path.exists(path):
                return self._read_file_safe(path, 3000)
        return "No README found"

    def _tree_to_text(self, tree: dict, indent: int = 0) -> str:
        """Convert folder tree dict to indented text (for prompt context)."""
        spacer = "  " * indent
        text = f"{spacer}- {tree['name']} ({tree['type']})\n"
        for child in tree.get("children", []):
            text += self._tree_to_text(child, indent + 1)
        return text

    # -------------------------------
    # LLM-powered steps
    # -------------------------------
    async def _generate_initial_diagram(
        self,
        tree: Dict,
        readme: str,
        initial_files: List[Dict],
    ) -> str:
        """Generate initial Mermaid diagram from tree + readme + some files."""
        system_prompt = """You are an expert software architect. Generate Mermaid JS architecture diagrams.
Your diagrams should:
- Use proper Mermaid syntax (graph TD, flowchart, or C4 diagrams)
- Show high-level architecture and key components
- Include modules, services, and their relationships
- Be clear and well-organized
- Use meaningful node names and labels

CRITICAL: Output ONLY the Mermaid code block. No explanations, just the diagram."""

        files_summary = "\n".join([
            f"- {f['path']} ({f['ext']}): {f['content'][:200]}"
            for f in initial_files
        ])

        tree_text = self._tree_to_text(tree)

        prompt = f"""Create a Mermaid architecture diagram for this codebase.

**README:**
{readme[:2000]}

**Folder Structure:**
{tree_text[:1500]}

**Initial Files (showing {len(initial_files)} files):**
{files_summary}

Generate a comprehensive Mermaid diagram showing:
1. Main modules and components
2. Folder organization
3. Key relationships between components
4. Entry points and APIs

Output ONLY the Mermaid code (start with ```mermaid and end with ```):"""

        response = await self.llm.completion(prompt, system_prompt=system_prompt)
        return self._extract_mermaid(response["text"])

    def _extract_mermaid(self, text: str) -> str:
        """Extract Mermaid code block from LLM response."""
        if not text:
            return "graph TD\n  A[Error] --> B[No response]"
        if "```mermaid" in text:
            parts = text.split("```mermaid", 1)[-1].split("```", 1)
            return parts[0].strip() if parts[0].strip() else "graph TD\n  A[Empty] --> B[No diagram]"
        return text.strip() if text.strip() else "graph TD\n  A[Empty] --> B[No diagram]"

    async def _refine_diagram(
        self, 
        current_mermaid: str, 
        file_batch: List[Dict]
    ) -> str:
        """Refine existing diagram with a new batch of files."""
        system_prompt = """You are an expert at refining architecture diagrams. 
Given an existing Mermaid diagram and new files, update the diagram to include relevant new components.

Rules:
- Preserve the existing diagram structure
- Add new nodes/relationships only if they represent significant components
- Maintain consistency with existing naming
- Keep the diagram clean and not cluttered
- Output ONLY the updated Mermaid code"""

        files_summary = "\n".join([
            f"- {f['path']}: {f['content'][:300]}"
            for f in file_batch
        ])

        prompt = f"""Update the architecture diagram with these new files.

**Current Diagram:**
```mermaid
{current_mermaid}```
New Files:
{files_summary}

Update the diagram and return ONLY the Mermaid code block."""
        try:
            response = await self.llm.completion(prompt, system_prompt=system_prompt)
            new_mermaid = self._extract_mermaid(response.get("text", ""))
            if new_mermaid:
                return new_mermaid
            # fallback to old diagram if extraction failed
            return current_mermaid
        except Exception as e:
            logger.error(f"Refinement failed: {e}")
            # fallback to old diagram if error occurs
            return current_mermaid
import os
import json
from tree_sitter import Language, Parser
import tree_sitter_python as ts_python
import tree_sitter_javascript as ts_javascript
import tree_sitter_typescript as ts_typescript
import tree_sitter_java as ts_java
import tree_sitter_go as ts_go
import tree_sitter_c as ts_c
import tree_sitter_cpp as ts_cpp
import tree_sitter_rust as ts_rust
import tree_sitter_ruby as ts_ruby
import tree_sitter_php as ts_php
import tree_sitter_swift as ts_swift
from typing import List, Dict

from langchain.docstore.document import Document
from langchain.embeddings.base import Embeddings
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_chroma import Chroma

# from config import (
#     PERSISTENT_CODEGRAPH_VECTORSTORE_PATH,
#     VECTOR_SEARCH_THRESHOLD,
#     TOP_K,
#     CODEBASE_PATH,
# )

# Map file extensions to language names
EXT_TO_LANG = {
    "py": "python",
    "js": "javascript",
    "jsx": "javascript",  # JSX uses JavaScript parser
    "ts": "typescript",
    "tsx": "typescript",  # TSX uses TypeScript parser
    "java": "java",
    "go": "go",
    "c": "c",
    "cpp": "cpp",
    "cc": "cpp",
    "cxx": "cpp",
    "rs": "rust",
    "rb": "ruby",
    "php": "php",
    "swift": "swift",
}

# Map language names to their tree-sitter modules
LANG_MODULES = {
    "python": ts_python,
    "javascript": ts_javascript,
    "typescript": ts_typescript,
    "java": ts_java,
    "go": ts_go,
    "c": ts_c,
    "cpp": ts_cpp,
    "rust": ts_rust,
    "ruby": ts_ruby,
    "php": ts_php,
    "swift": ts_swift,
}

# Cache of loaded Language objects
LANGUAGES: Dict[str, Language] = {}

from tree_sitter import Language, Parser

# Cache of loaded Language objects
LANGUAGES: Dict[str, Language] = {}

def get_language(ext: str) -> Language:
    """Get or create a Language object for the given file extension."""
    lang_name = EXT_TO_LANG.get(ext)
    if not lang_name:
        raise ValueError(f"No grammar for .{ext}")

    module = LANG_MODULES.get(lang_name)
    if not module:
        raise ValueError(f"Module for {lang_name!r} not available")

    if ext not in LANGUAGES:
        try:
            # In the latest tree-sitter, Language() takes only the PyCapsule
            LANGUAGES[ext] = Language(module.language())
        except Exception as e:
            raise ValueError(f"Failed to load language {lang_name}: {e}")

    return LANGUAGES[ext]


def build_graph(code: str, lang: Language) -> Dict:
    """Build AST graph from code using tree-sitter."""
    try:
        # Pass language to Parser constructor
        parser = Parser(lang)
        tree = parser.parse(code.encode("utf8"))
        nodes, edges = [], []

        def visit(n, parent_id=None):
            nid = len(nodes)
            nodes.append({
                "id": nid,
                "type": n.type,
                "start": n.start_point,
                "end": n.end_point,
                "text": code[n.start_byte:n.end_byte] if n.start_byte < len(code.encode('utf8')) else ""
            })
            if parent_id is not None:
                edges.append({"from": parent_id, "to": nid})
            for c in n.children:
                visit(c, nid)

        visit(tree.root_node)
        return {"nodes": nodes, "edges": edges}
    except Exception as e:
        print(f"Error building graph: {e}")
        import traceback
        traceback.print_exc()
        return {"nodes": [{"id": 0, "type": "error", "start": [0, 0], "end": [0, 0], "text": ""}], "edges": []}


def load_codebase_as_graph_docs(repo_root) -> List[Document]:
    """Load codebase files and convert to graph documents."""
    docs: List[Document] = []
    # repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    
    print(f"Scanning codebase from: {repo_root}")
    
    # Directories to skip
    skip_dirs = {
        'node_modules', '.git', '__pycache__', '.pytest_cache', 
        'venv', 'env', 'build', 'dist', '.next', '.nuxt',
        'coverage', '.coverage', 'htmlcov', '.tox', '.eggs',
        'migrations', 'static', 'media', 'uploads'
    }
    
    # File patterns to skip
    skip_files = {
        '.gitignore', '.env', '.env.local', '.env.development',
        '.env.production', 'package-lock.json', 'yarn.lock',
        'poetry.lock', 'requirements.txt', 'setup.py', 'Dockerfile'
    }
    
    file_count = 0
    for root, dirs, files in os.walk(repo_root):
        # Skip certain directories
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.')]
        
        for fn in files:
            # Skip hidden files and certain file types
            if fn.startswith('.') or fn in skip_files:
                continue
            
            parts = fn.rsplit(".", 1)
            if len(parts) != 2:
                continue
            ext = parts[1].lower()
            
            # Skip if extension not supported
            if ext not in EXT_TO_LANG:
                continue
                
            full_path = os.path.join(root, fn)
            
            try:
                lang = get_language(ext)
                
                with open(full_path, 'r', encoding="utf8", errors='ignore') as f:
                    src = f.read()
                
                # Skip empty files or very small files
                if not src.strip() or len(src) < 10:
                    continue
                
                # Skip very large files (>100KB)
                if len(src) > 100000:
                    print(f"Skipping large file: {fn} ({len(src)} bytes)")
                    continue
                    
                graph = build_graph(src, lang)
                
                # Skip if graph couldn't be built properly
                if not graph.get("nodes") or len(graph["nodes"]) < 2:
                    continue
                
                metadata = {
                    "filename": os.path.relpath(full_path, repo_root),
                    "language": ext,
                    "full_code": src,
                    "file_size": len(src),
                    "node_count": len(graph["nodes"])
                }
                
                docs.append(Document(page_content=json.dumps(graph), metadata=metadata))
                file_count += 1
                print(f"Processed: {metadata['filename']} ({metadata['language']}, {metadata['node_count']} nodes)")
                
            except Exception as e:
                print(f"Error processing {fn}: {e}")
                continue

    print(f"Successfully processed {file_count} code files")
    return docs


# class CodeGraphEnhancementLoop:
#     def __init__(
#         self,
#         embedding_model: Embeddings,
#         llm: ChatGoogleGenerativeAI,
#         persist_dir: str = PERSISTENT_CODEGRAPH_VECTORSTORE_PATH,
#     ):
#         self.embedding_model = embedding_model
#         self.llm = llm
        
#         try:
#             os.makedirs(persist_dir, exist_ok=True)
#             print("Testing embedding model...")
#             test_embedding = embedding_model.embed_query("test")
#             print(f"Embedding test successful, dimension: {len(test_embedding)}")

#             # Load or build vectorstore
#             self._initialize_vectorstore(persist_dir)
                
#         except Exception as e:
#             print(f"Error initializing CodeGraphEnhancementLoop: {e}")
#             raise

#     def _initialize_vectorstore(self, persist_dir: str):
#         """Initialize or load the vectorstore."""
#         # Always try to load existing first
#         try:
#             if os.path.exists(persist_dir) and os.listdir(persist_dir):
#                 print("Attempting to load existing code-graph vectorstore...")
#                 self.vs = Chroma(
#                     persist_directory=persist_dir,
#                     embedding_function=self.embedding_model,
#                 )
                
#                 # Check if vectorstore has documents
#                 try:
#                     collection = self.vs._collection
#                     doc_count = collection.count()
#                     if doc_count > 0:
#                         print(f"Loaded existing vectorstore with {doc_count} documents")
#                         return
#                     else:
#                         print("Existing vectorstore is empty, rebuilding...")
#                 except:
#                     print("Could not check existing vectorstore, rebuilding...")
#         except Exception as e:
#             print(f"Could not load existing vectorstore: {e}")
        
#         # Build new vectorstore
#         self._rebuild_vectorstore(persist_dir)

#     def _rebuild_vectorstore(self, persist_dir: str):
#         """Rebuild the vectorstore from scratch."""
#         repo_root = ""
#         docs = load_codebase_as_graph_docs(repo_root)
#         if not docs:
#             # Don't fail completely, just warn
#             print("WARNING: No code files found to index. Creating empty vectorstore.")
#             # Create a dummy document so vectorstore can be created
#             dummy_doc = Document(
#                 page_content=json.dumps({"nodes": [], "edges": []}),
#                 metadata={"filename": "dummy.py", "language": "py", "full_code": "# No code files found"}
#             )
#             docs = [dummy_doc]
        
#         print(f"Creating vectorstore with {len(docs)} documents...")
        
#         # Clear existing directory
#         if os.path.exists(persist_dir):
#             import shutil
#             shutil.rmtree(persist_dir)
#             os.makedirs(persist_dir)
        
#         self.vs = Chroma.from_documents(
#             documents=docs,
#             embedding=self.embedding_model,
#             persist_directory=persist_dir,
#         )
#         print("Vectorstore created successfully")

#     def run(self, query: str) -> str:
        # """Run the enhancement loop with the given query."""
        # try:
        #     print(f"[CodeGraph] Running query: {query}")
            
        #     # Check if vectorstore is available
        #     if not hasattr(self, 'vs') or self.vs is None:
        #         return json.dumps({"error": "Vectorstore not initialized"})
            
        #     # 1) embed & retrieve
        #     hits = self.vs.similarity_search_with_score(query=query, k=TOP_K)
        #     print(f"[CodeGraph] Found {len(hits)} initial hits")
            
        #     if not hits:
        #         return json.dumps({"error": "No documents found in vectorstore"})
            
        #     # Apply threshold filter
        #     filtered = [(d, s) for d, s in hits if s >= VECTOR_SEARCH_THRESHOLD]
        #     print(f"[CodeGraph] {len(filtered)} hits passed threshold {VECTOR_SEARCH_THRESHOLD}")
            
        #     if not filtered:
        #         # Lower threshold and try again
        #         lower_threshold = VECTOR_SEARCH_THRESHOLD * 0.5
        #         filtered = [(d, s) for d, s in hits if s >= lower_threshold]
        #         print(f"[CodeGraph] {len(filtered)} hits passed lower threshold {lower_threshold}")
                
        #         if not filtered:
        #             return json.dumps({"error": f"No code-graph docs passed threshold {VECTOR_SEARCH_THRESHOLD}"})
            
        #     top_docs = [d for d, _ in filtered]

        #     # 2) build prompt
        #     parts = ["### Code-Graph Analysis Context"]
        #     for i, doc in enumerate(top_docs, 1):
        #         m = doc.metadata
                
        #         # Skip dummy documents
        #         if m.get('filename') == 'dummy.py':
        #             continue
                    
        #         parts += [
        #             f"**File {i}:** `{m['filename']}` ({m.get('language', 'unknown')})",
        #             f"- **File Size:** {m.get('file_size', 0)} bytes",
        #             f"- **AST Nodes:** {m.get('node_count', 0)}",
        #             "- **AST Graph (JSON)**:",
        #             "```json",
        #             doc.page_content[:2000] + "..." if len(doc.page_content) > 2000 else doc.page_content,
        #             "```",
        #             "- **Source Code**:",
        #             f"```{m.get('language', 'text')}",
        #             m.get("full_code", "")[:3000] + "..." if len(m.get("full_code", "")) > 3000 else m.get("full_code", ""),
        #             "```",
        #             ""
        #         ]

        #     parts.append(
        #         f"### User Query:\n{query}\n\n"
        #         "Based on the code analysis above, provide a comprehensive solution. "
        #         "Return **exactly one** JSON object with the following structure:\n"
        #         "```json\n"
        #         "{\n"
        #         '  "filename": "path/to/file.ext",\n'
        #         '  "changes": "Complete fixed code or specific changes needed",\n'
        #         '  "explanation": "Detailed explanation of the issue and solution"\n'
        #         "}\n"
        #         "```\n"
        #         "Make sure the JSON is valid and properly formatted."
        #     )
            
        #     prompt = "\n".join(parts)
            
        #     # Limit prompt size
        #     if len(prompt) > 8000:
        #         prompt = prompt[:8000] + "\n\n[Content truncated due to length]"
            
        #     print(f"[CodeGraph] Sending prompt to LLM (length: {len(prompt)})")
        #     resp = self.llm.invoke(prompt)
        #     result = getattr(resp, "content", str(resp))
            
        #     print(f"[CodeGraph] LLM response length: {len(result)}")
        #     return result
            
        # except Exception as e:
        #     print(f"[CodeGraph] Error in run(): {e}")
        #     import traceback
        #     traceback.print_exc()
        #     return json.dumps({"error": f"Internal error: {str(e)}"})
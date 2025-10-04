import os
import logging
from typing import List

from langchain.docstore.document import Document

# Import tools from tools directory
from .tools.indexing_tool import index_repository
from .tools.chunking import FixedSizeChunker, SemanticChunker
from .tools.ast_chunker import ASTChunker

logger = logging.getLogger(__name__)

# from config import (
#     PERSISTENT_CODEGRAPH_VECTORSTORE_PATH,
#     VECTOR_SEARCH_THRESHOLD,
#     TOP_K,
#     CODEBASE_PATH,
# )

# =============================================================================
# OLD TREE-SITTER IMPLEMENTATION - COMMENTED OUT
# =============================================================================

# # Map file extensions to language names
# EXT_TO_LANG = {
#     "py": "python",
#     "js": "javascript",
#     "jsx": "javascript",  # JSX uses JavaScript parser
#     "ts": "typescript",
#     "tsx": "typescript",  # TSX uses TypeScript parser
#     "java": "java",
#     "go": "go",
#     "c": "c",
#     "cpp": "cpp",
#     "cc": "cpp",
#     "cxx": "cpp",
#     "rs": "rust",
#     "rb": "ruby",
#     "php": "php",
#     "swift": "swift",
# }

# # Map language names to their tree-sitter modules
# LANG_MODULES = {
#     "python": ts_python,
#     "javascript": ts_javascript,
#     "typescript": ts_typescript,
#     "java": ts_java,
#     "go": ts_go,
#     "c": ts_c,
#     "cpp": ts_cpp,
#     "rust": ts_rust,
#     "ruby": ts_ruby,
#     "php": ts_php,
#     "swift": ts_swift,
# }

# # Cache of loaded Language objects
# LANGUAGES: Dict[str, Language] = {}

# from tree_sitter import Language, Parser

# # Cache of loaded Language objects
# LANGUAGES: Dict[str, Language] = {}

# def get_language(ext: str) -> Language:
#     """Get or create a Language object for the given file extension."""
#     lang_name = EXT_TO_LANG.get(ext)
#     if not lang_name:
#         raise ValueError(f"No grammar for .{ext}")

#     module = LANG_MODULES.get(lang_name)
#     if not module:
#         raise ValueError(f"Module for {lang_name!r} not available")

#     if ext not in LANGUAGES:
#         try:
#             # In the latest tree-sitter, Language() takes only the PyCapsule
#             LANGUAGES[ext] = Language(module.language())
#         except Exception as e:
#             raise ValueError(f"Failed to load language {lang_name}: {e}")
#     return LANGUAGES[ext]


# def build_graph(code: str, lang: Language) -> Dict:
#     """Build AST graph from code using tree-sitter."""
#     try:
#         # Pass language to Parser constructor
#         parser = Parser(lang)
#         tree = parser.parse(code.encode("utf8"))
#         nodes, edges = [], []

#         def visit(n, parent_id=None):
#             nid = len(nodes)
#             nodes.append({
#                 "id": nid,
#                 "type": n.type,
#                 "start": n.start_point,
#                 "end": n.end_point,
#                 "text": code[n.start_byte:n.end_byte] if n.start_byte < len(code.encode('utf8')) else ""
#             })
#             if parent_id is not None:
#                 edges.append({"from": parent_id, "to": nid})
#             for c in n.children:
#                 visit(c, nid)

#         visit(tree.root_node)
#         return {"nodes": nodes, "edges": edges}
#     except Exception as e:
#         print(f"Error building graph: {e}")
#         import traceback
#         traceback.print_exc()
#         return {"nodes": [{"id": 0, "type": "error", "start": [0, 0], "end": [0, 0], "text": ""}], "edges": []}


# =============================================================================
# NEW TOOL-BASED IMPLEMENTATION
# =============================================================================

def load_codebase_as_chunked_docs(repo_root: str) -> List[Document]:
    """
    Load codebase files and convert to chunked documents using the tools.
    This replaces the old AST-based approach with semantic and fixed-size chunking.
    
    Args:
        repo_root: Path to the repository root
        
    Returns:
        List of Document objects with chunked content
    """
    logger.info("🚀 Starting codebase processing from: %s", repo_root)
    logger.info("🔧 Logging test - this should be visible!")
    
    if not os.path.exists(repo_root):
        logger.error("❌ Repository path does not exist: %s", repo_root)
        return []
    
    docs: List[Document] = []
    fixed_chunker = FixedSizeChunker(chunk_size=1000, overlap=200)
    semantic_chunker = SemanticChunker()
    ast_chunker = ASTChunker()
    
    # Initialize statistics
    total_files = 0
    processed_files = 0
    skipped_files = 0
    total_fixed_chunks = 0
    total_semantic_chunks = 0
    total_ast_chunks = 0
    total_chunks = 0
    
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
        'poetry.lock', 'Pipfile.lock', 'yarn-error.log'
    }
    
    # Supported file extensions (from indexing_tool.py)
    supported_extensions = {
        '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
        '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r',
        '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
        '.sql', '.sh', '.bash', '.zsh', '.ps1', '.dockerfile', '.tf', '.hcl',
        '.proto', '.graphql', '.vue', '.svelte', '.astro'
    }
    
    for root, dirs, files in os.walk(repo_root):
        # Skip certain directories
        dirs[:] = [d for d in dirs if d not in skip_dirs and not d.startswith('.')]
        
        for filename in files:
            total_files += 1
            
            # Skip hidden files and certain file types
            if filename.startswith('.') or filename in skip_files:
                logger.debug("⏭️  Skipping hidden/system file: %s", filename)
                skipped_files += 1
                continue
            
            file_path = os.path.join(root, filename)
            relative_path = os.path.relpath(file_path, repo_root)
            
            # Get file extension
            _, ext = os.path.splitext(filename)
            
            # Skip if extension not supported
            if ext.lower() not in supported_extensions:
                logger.debug("⏭️  Skipping unsupported file type: %s (%s)", filename, ext)
                skipped_files += 1
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                
                # Skip empty files
                if not content.strip():
                    logger.debug("⏭️  Skipping empty file: %s", relative_path)
                    skipped_files += 1
                    continue
                
                # Skip very large files (>500KB)
                if len(content) > 500000:
                    logger.warning("⏭️  Skipping large file: %s (%d bytes)", relative_path, len(content))
                    skipped_files += 1
                    continue
                
                # Create base metadata (matching old format for compatibility)
                base_metadata = {
                    "filename": relative_path,
                    "language": ext.lstrip('.'),  # Remove dot for language field
                    "file_extension": ext,
                    "file_size": len(content),
                    "full_code": content,  # Store full code for vector store compatibility
                    "repo_root": repo_root
                }
                
                logger.info("📄 Processing file: %s (%s, %d bytes)", relative_path, ext, len(content))
                
                # FIXED-SIZE CHUNKING
                logger.info("  🔧 Creating fixed-size chunks for %s", relative_path)
                # fixed_chunks = fixed_chunker.chunk(content)
                # for i, chunk in enumerate(fixed_chunks):
                #     chunk_metadata = {
                #         **base_metadata,
                #         'chunk_type': 'fixed',
                #         'chunk_index': i,
                #         'total_chunks': len(fixed_chunks),
                #         'chunk_size': len(chunk)
                #     }
                #     docs.append(Document(page_content=chunk, metadata=chunk_metadata))
                #     total_fixed_chunks += 1
                
                # # SEMANTIC CHUNKING
                
                logger.info("  🧠 Creating semantic chunks for %s", relative_path)
                # semantic_chunks = semantic_chunker.chunk(content, ext)
                # for i, chunk in enumerate(semantic_chunks):
                #     chunk_metadata = {
                #         **base_metadata,
                #         'chunk_type': 'semantic',
                #         'chunk_index': i,
                #         'total_chunks': len(semantic_chunks),
                #         'chunk_size': len(chunk)
                #     }
                #     docs.append(Document(page_content=chunk, metadata=chunk_metadata))
                #     total_semantic_chunks += 1
                
                # AST CHUNKING
                logger.info("  🌳 Creating AST chunks for %s", relative_path)
                ast_chunks = ast_chunker.chunk(content, ext)
                for i, chunk in enumerate(ast_chunks):
                    chunk_metadata = {
                        **base_metadata,
                        'chunk_type': 'ast',
                        'chunk_index': i,
                        'total_chunks': len(ast_chunks),
                        'chunk_size': len(chunk)
                    }
                    docs.append(Document(page_content=chunk, metadata=chunk_metadata))
                    total_ast_chunks += 1
                semantic_chunks = []
                # ast_chunks = []
                fixed_chunks = []
                
                # Calculate file totals
                file_fixed = len(fixed_chunks)
                file_semantic = len(semantic_chunks)
                file_ast = len(ast_chunks)
                file_total = file_fixed + file_semantic + file_ast
                total_chunks += file_total
                processed_files += 1
                
                logger.info("✅ Processed: %s | Fixed: %d | Semantic: %d | AST: %d | Total: %d", 
                           relative_path, file_fixed, file_semantic, file_ast, file_total)
                
            except (OSError, IOError, UnicodeDecodeError) as e:
                logger.error("❌ Error processing %s: %s", relative_path, e)
                skipped_files += 1
                continue
            except Exception as e:
                logger.error("❌ Unexpected error processing %s: %s", relative_path, e)
                skipped_files += 1
                continue

    # Final summary
    logger.info("🎉 PROCESSING COMPLETE!")
    logger.info("📊 SUMMARY STATISTICS:")
    logger.info("  📁 Total files found: %d", total_files)
    logger.info("  ✅ Files processed: %d", processed_files)
    logger.info("  ⏭️  Files skipped: %d", skipped_files)
    logger.info("  🔧 Fixed-size chunks: %d", total_fixed_chunks)
    logger.info("  🧠 Semantic chunks: %d", total_semantic_chunks)
    logger.info("  🌳 AST chunks: %d", total_ast_chunks)
    logger.info("  📦 Total chunks created: %d", total_chunks)
    logger.info("  📈 Average chunks per file: %.2f", total_chunks / processed_files if processed_files > 0 else 0)
    
    return docs


def index_repository_with_tools(repo_path: str) -> List[Document]:
    """
    Index a repository using the indexing tool.
    This is a wrapper around the indexing_tool.index_repository function.
    
    Args:
        repo_path: Path to the repository to index
        
    Returns:
        List of Document objects ready for vector storage
    """
    try:
        logger.info("Starting repository indexing: %s", repo_path)
        docs = index_repository(repo_path)
        logger.info("Indexing completed. Created %d documents", len(docs))
        return docs
    except Exception as e:
        logger.error("Error indexing repository: %s", e)
        raise


# =============================================================================
# BACKWARD COMPATIBILITY - Keep old function name but use new implementation
# =============================================================================

def load_codebase_as_graph_docs(repo_root: str) -> List[Document]:
    """
    Backward compatibility wrapper for load_codebase_as_chunked_docs.
    This maintains the same interface but uses the new chunking approach.
    """
    return load_codebase_as_chunked_docs(repo_root)


# =============================================================================
# OLD CODEGRAPH ENHANCEMENT LOOP - COMMENTED OUT
# =============================================================================

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
#         """Run the enhancement loop with the given query."""
#         try:
#             print(f"[CodeGraph] Running query: {query}")
            
#             # Check if vectorstore is available
#             if not hasattr(self, 'vs') or self.vs is None:
#                 return json.dumps({"error": "Vectorstore not initialized"})
            
#             # 1) embed & retrieve
#             hits = self.vs.similarity_search_with_score(query=query, k=TOP_K)
#             print(f"[CodeGraph] Found {len(hits)} initial hits")
            
#             if not hits:
#                 return json.dumps({"error": "No documents found in vectorstore"})
            
#             # Apply threshold filter
#             filtered = [(d, s) for d, s in hits if s >= VECTOR_SEARCH_THRESHOLD]
#             print(f"[CodeGraph] {len(filtered)} hits passed threshold {VECTOR_SEARCH_THRESHOLD}")
            
#             if not filtered:
#                 # Lower threshold and try again
#                 lower_threshold = VECTOR_SEARCH_THRESHOLD * 0.5
#                 filtered = [(d, s) for d, s in hits if s >= lower_threshold]
#                 print(f"[CodeGraph] {len(filtered)} hits passed lower threshold {lower_threshold}")
                
#                 if not filtered:
#                     return json.dumps({"error": f"No code-graph docs passed threshold {VECTOR_SEARCH_THRESHOLD}"})
            
#             top_docs = [d for d, _ in filtered]

#             # 2) build prompt
#             parts = ["### Code-Graph Analysis Context"]
#             for i, doc in enumerate(top_docs, 1):
#                 m = doc.metadata
                
#                 # Skip dummy documents
#                 if m.get('filename') == 'dummy.py':
#                     continue
                    
#                 parts += [
#                     f"**File {i}:** `{m['filename']}` ({m.get('language', 'unknown')})",
#                     f"- **File Size:** {m.get('file_size', 0)} bytes",
#                     f"- **AST Nodes:** {m.get('node_count', 0)}",
#                     "- **AST Graph (JSON)**:",
#                     "```json",
#                     doc.page_content[:2000] + "..." if len(doc.page_content) > 2000 else doc.page_content,
#                     "```",
#                     "- **Source Code**:",
#                     f"```{m.get('language', 'text')}",
#                     m.get("full_code", "")[:3000] + "..." if len(m.get("full_code", "")) > 3000 else m.get("full_code", ""),
#                     "```",
#                     ""
#                 ]

#             parts.append(
#                 f"### User Query:\n{query}\n\n"
#                 "Based on the code analysis above, provide a comprehensive solution. "
#                 "Return **exactly one** JSON object with the following structure:\n"
#                 "```json\n"
#                 "{\n"
#                 '  "filename": "path/to/file.ext",\n'
#                 '  "changes": "Complete fixed code or specific changes needed",\n'
#                 '  "explanation": "Detailed explanation of the issue and solution"\n'
#                 "}\n"
#                 "```\n"
#                 "Make sure the JSON is valid and properly formatted."
#             )
            
#             prompt = "\n".join(parts)
            
#             # Limit prompt size
#             if len(prompt) > 8000:
#                 prompt = prompt[:8000] + "\n\n[Content truncated due to length]"
            
#             print(f"[CodeGraph] Sending prompt to LLM (length: {len(prompt)})")
#             resp = self.llm.invoke(prompt)
#             result = getattr(resp, "content", str(resp))
            
#             print(f"[CodeGraph] LLM response length: {len(result)}")
#             return result
            
#         except Exception as e:
#             print(f"[CodeGraph] Error in run(): {e}")
#             import traceback
#             traceback.print_exc()
#             return json.dumps({"error": f"Internal error: {str(e)}"})
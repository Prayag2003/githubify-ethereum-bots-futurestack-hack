import os
import logging
from typing import List
import hashlib
from langchain.docstore.document import Document
from .chunking import FixedSizeChunker, SemanticChunker
from .ast_chunker import ASTChunker

logger = logging.getLogger(__name__)

# Supported file extensions
SUPPORTED_EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', '.java', '.cpp', '.c', '.h', '.hpp',
    '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.scala', '.r',
    '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.scss',
    '.sql', '.sh', '.bash', '.zsh', '.ps1', '.dockerfile', '.tf', '.hcl',
    '.proto', '.graphql', '.vue', '.svelte', '.astro'
}

def index_repository(repo_path: str) -> List[Document]:
    """
    Indexes a repository by chunking files both with fixed-size and semantic chunking.
    Returns the chunked documents for further processing.
    
    Args:
        repo_path: Path to the cloned repository
    
    Returns:
        List[Document]: Chunked documents ready for vector storage
    """
    try:
        logger.info("🚀 Starting repository indexing: %s", repo_path)
        
        fixed_chunker = FixedSizeChunker(chunk_size=1000, overlap=200)
        semantic_chunker = SemanticChunker()
        ast_chunker = ASTChunker()
        
        docs: List[Document] = []
        stats = {
            'total_files': 0,
            'indexed_files': 0,
            'skipped_files': 0,
            'fixed_chunks': 0,
            'semantic_chunks': 0,
            'ast_chunks': 0,
            'errors': []
        }
        
        logger.info("📊 Chunking configuration:")
        logger.info("  🔧 Fixed-size: 1000 chars, 200 overlap")
        logger.info("  🧠 Semantic: Language-aware structure chunking")
        logger.info("  🌳 AST: Advanced syntax tree chunking for 17 languages")
        
        # Get repository name
        repo_name = os.path.basename(repo_path)
        
        # Walk through repository
        for root, dirs, files in os.walk(repo_path):
            # Skip .git directory and common ignore patterns
            dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', '__pycache__', 
                                                     'venv', 'env', '.venv', 'dist', 'build'}]
            
            for file in files:
                stats['total_files'] += 1
                file_path = os.path.join(root, file)
                relative_path = os.path.relpath(file_path, repo_path)
                
                # Get file extension
                _, ext = os.path.splitext(file)
                
                # Check if file should be indexed
                if ext.lower() not in SUPPORTED_EXTENSIONS:
                    logger.debug("⏭️  Skipping unsupported file: %s (%s)", relative_path, ext)
                    stats['skipped_files'] += 1
                    continue
                
                try:
                    # Read file content
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()
                    
                    if not content.strip():
                        logger.debug("⏭️  Skipping empty file: %s", relative_path)
                        stats['skipped_files'] += 1
                        continue
                    
                    # Get file hash for unique identification
                    file_hash = hashlib.md5(content.encode()).hexdigest()
                    
                    # Common metadata for all chunks
                    base_metadata = {
                        'repo_name': repo_name,
                        'file_path': relative_path,
                        'absolute_path': file_path,
                        'file_extension': ext,
                        'file_size': len(content),
                        'file_hash': file_hash
                    }
                    
                    logger.info("📄 Processing file: %s (%s, %d bytes)", relative_path, ext, len(content))
                    
                    # FIXED-SIZE CHUNKING
                    logger.info("  🔧 Creating fixed-size chunks...")
                    fixed_chunks = fixed_chunker.chunk(content)
                    for i, chunk in enumerate(fixed_chunks):
                        chunk_metadata = {
                            **base_metadata,
                            'chunk_type': 'fixed',
                            'chunk_index': i,
                            'total_chunks': len(fixed_chunks),
                            'chunk_size': len(chunk)
                        }
                        docs.append(Document(page_content=chunk, metadata=chunk_metadata))
                        stats['fixed_chunks'] += 1
                    
                    logger.info("  🔧 Created %d fixed-size chunks", len(fixed_chunks))
                    
                    # SEMANTIC CHUNKING
                    logger.info("  🧠 Creating semantic chunks...")
                    semantic_chunks = semantic_chunker.chunk(content, ext)
                    for i, chunk in enumerate(semantic_chunks):
                        chunk_metadata = {
                            **base_metadata,
                            'chunk_type': 'semantic',
                            'chunk_index': i,
                            'total_chunks': len(semantic_chunks),
                            'chunk_size': len(chunk)
                        }
                        docs.append(Document(page_content=chunk, metadata=chunk_metadata))
                        stats['semantic_chunks'] += 1
                    
                    logger.info("  🧠 Created %d semantic chunks", len(semantic_chunks))
                    
                    # AST CHUNKING
                    logger.info("  🌳 Creating AST chunks...")
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
                        stats['ast_chunks'] += 1
                    
                    logger.info("  🌳 Created %d AST chunks", len(ast_chunks))
                    
                    # File summary
                    file_fixed = len(fixed_chunks)
                    file_semantic = len(semantic_chunks)
                    file_ast = len(ast_chunks)
                    file_total = file_fixed + file_semantic + file_ast
                    
                    stats['indexed_files'] += 1
                    logger.info("✅ Indexed: %s | Fixed: %d | Semantic: %d | AST: %d | Total: %d", 
                               relative_path, file_fixed, file_semantic, file_ast, file_total)
                
                except Exception as e:
                    error_msg = f"Error processing {relative_path}: {str(e)}"
                    logger.error(error_msg, exc_info=True)
                    stats['errors'].append(error_msg)
        
        # Final summary
        total_chunks = stats['fixed_chunks'] + stats['semantic_chunks'] + stats['ast_chunks']
        logger.info("🎉 INDEXING COMPLETE!")
        logger.info("📊 FINAL STATISTICS:")
        logger.info("  📁 Total files found: %d", stats['total_files'])
        logger.info("  ✅ Files indexed: %d", stats['indexed_files'])
        logger.info("  ⏭️  Files skipped: %d", stats['skipped_files'])
        logger.info("  🔧 Fixed-size chunks: %d", stats['fixed_chunks'])
        logger.info("  🧠 Semantic chunks: %d", stats['semantic_chunks'])
        logger.info("  🌳 AST chunks: %d", stats['ast_chunks'])
        logger.info("  📦 Total chunks created: %d", total_chunks)
        logger.info("  📈 Average chunks per file: %.2f", total_chunks / stats['indexed_files'] if stats['indexed_files'] > 0 else 0)
        if stats['errors']:
            logger.warning("  ⚠️  Errors encountered: %d", len(stats['errors']))
        
        logger.info("📦 Created %d total document chunks ready for vector storage", len(docs))
        return docs
    
    except Exception as e:
        logger.error("Error indexing repository: %s", str(e), exc_info=True)
        raise Exception(f"Failed to index repository: {str(e)}") from e
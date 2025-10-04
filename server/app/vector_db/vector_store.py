import os
import logging
import hashlib
from typing import List, Dict
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
from langchain.docstore.document import Document

logger = logging.getLogger(__name__)

class PineconeVectorStore:
    """Manages Pinecone vector store for code embeddings using CodeBERT with load balancing across multiple indexes."""
    
    # Load balancing configuration
    AVAILABLE_INDEXES = [
        "code-repositories-1",
        "code-repositories-2", 
        "code-repositories-3",
        "code-repositories-4"
    ]
    
    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        self.namespace = f"repo-{repo_id}"  # Use namespace for repo separation
        self.index_name = self._select_index()  # Load balance across available indexes
        
        # Initialize Pinecone
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY not found in environment")
        
        logger.info("🚀 Initializing Pinecone with load balancing...")
        logger.info("🔧 Vector store logging test - this should be visible!")
        self.pc = Pinecone(api_key=api_key)
        
        # Load CodeBERT model for code embeddings
        logger.info("🔮 Loading CodeBERT embedding model...")
        self.embedding_model = SentenceTransformer("huggingface/CodeBERTa-small-v1")
        self.dimension = 768

        self._setup_index()
    
    def _select_index(self) -> str:
        """Select an index using consistent hashing for load balancing."""
        repo_hash = int(hashlib.md5(self.repo_id.encode()).hexdigest(), 16)
        index_index = repo_hash % len(self.AVAILABLE_INDEXES)
        selected_index = self.AVAILABLE_INDEXES[index_index]
        logger.info("🎯 Load balancing: Repository '%s' assigned to index '%s' (hash: %d)", 
                   self.repo_id, selected_index, repo_hash)
        return selected_index
    
    def _get_index_stats(self) -> Dict:
        """Get statistics about all available indexes."""
        try:
            existing_indexes = self.pc.list_indexes()
            index_stats = {}
            for idx in existing_indexes:
                if idx.name in self.AVAILABLE_INDEXES:
                    try:
                        index_obj = self.pc.Index(idx.name)
                        stats = index_obj.describe_index_stats()
                        index_stats[idx.name] = {
                            'total_vector_count': stats.get('total_vector_count', 0),
                            'namespaces': len(stats.get('namespaces', {})),
                            'dimension': stats.get('dimension', 0)
                        }
                    except Exception as e:
                        logger.warning("Could not get stats for index %s: %s", idx.name, e)
                        index_stats[idx.name] = {'error': str(e)}
            return index_stats
        except Exception as e:
            logger.error("Error getting index stats: %s", e)
            return {}
    
    def _check_and_fix_dimension(self):
        """Check if existing index has correct dimension and fix if needed."""
        try:
            index_stats = self.index.describe_index_stats()
            index_dimension = index_stats.get('dimension', 0)
            logger.info("🔍 Checking index dimension compatibility...")
            logger.info("  📊 Model dimension: %d", self.dimension)
            logger.info("  📊 Index dimension: %d", index_dimension)
            if self.dimension != index_dimension:
                logger.error("❌ DIMENSION MISMATCH DETECTED!")
                logger.info("🗑️  Deleting incompatible index: %s", self.index_name)
                self.pc.delete_index(self.index_name)
                import time; time.sleep(2)
                logger.info("🏗️  Creating new index with correct dimension: %d", self.dimension)
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric='cosine',
                    spec=ServerlessSpec(
                        cloud='aws',
                        region=os.getenv('PINECONE_ENVIRONMENT', 'us-east-1')
                    )
                )
                logger.info("✅ Successfully recreated index: %s (dimension: %d)", self.index_name, self.dimension)
            else:
                logger.info("✅ Dimension compatibility confirmed!")
        except Exception as e:
            logger.warning("⚠️  Could not check dimension compatibility: %s", e)
    
    def _setup_index(self):
        """Create or connect to Pinecone index with load balancing."""
        existing = [idx.name for idx in self.pc.list_indexes()]
        if self.index_name not in existing:
            logger.info("🏗️  Selected index '%s' does not exist. Creating it...", self.index_name)
            try:
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric='cosine',
                    spec=ServerlessSpec(
                        cloud='aws',
                        region=os.getenv('PINECONE_ENVIRONMENT', 'us-east-1')
                    )
                )
                logger.info("✅ Successfully created index: %s (dimension: %d)", self.index_name, self.dimension)
            except Exception as e:
                logger.error("❌ Failed to create index %s: %s", self.index_name, e)
                raise
        else:
            logger.info("✅ Using existing index: %s", self.index_name)
        self.index = self.pc.Index(self.index_name)
        if self.index_name in existing:
            self._check_and_fix_dimension()
        logger.info("🎯 Load balancing configuration:")
        logger.info("  📊 Selected index: %s", self.index_name)
        logger.info("  🏷️  Namespace: %s", self.namespace)
        logger.info("  🔄 Available indexes: %s", self.AVAILABLE_INDEXES)
        stats = self._get_index_stats()
        if stats:
            logger.info("📈 Index statistics:")
            for idx_name, stat in stats.items():
                if 'error' not in stat:
                    logger.info("  %s: %d vectors, %d namespaces", 
                               idx_name, stat['total_vector_count'], stat['namespaces'])
    
    def _extract_code_context(self, doc: Document) -> str:
        """Extract meaningful context from chunked content for embedding."""
        metadata = doc.metadata
        filename = metadata.get('filename', '')
        language = metadata.get('language', '')
        code = metadata.get('full_code', '')
        chunk_type = metadata.get('chunk_type', 'unknown')
        chunk_content = doc.page_content
        context = f"""
File: {filename}
Language: {language}
Chunk Type: {chunk_type}
Chunk Content:
{chunk_content[:2000]}
Full Code Context:
{code[:1000]}
        """.strip()
        return context
    
    def add_documents(self, documents: List[Document]) -> Dict:
        """Create embeddings and store in Pinecone. Always include README first."""
        if not documents:
            logger.warning("❌ No documents provided for vector storage")
            return {"success": False, "error": "No documents", "count": 0}

        # Prioritize README files
        readme_docs = [doc for doc in documents if 'readme' in doc.metadata.get('filename', '').lower()]
        other_docs = [doc for doc in documents if doc not in readme_docs]
        documents = readme_docs + other_docs

        logger.info("🚀 Starting vector storage process for %d documents (README prioritized)", len(documents))
        vectors = []
        for idx, doc in enumerate(documents):
            try:
                text = self._extract_code_context(doc)
                embedding = self.embedding_model.encode(
                    text,
                    convert_to_numpy=False,
                    show_progress_bar=False
                ).tolist()
                metadata = {
                    "filename": doc.metadata.get('filename', ''),
                    "language": doc.metadata.get('language', ''),
                    "file_size": doc.metadata.get('file_size', 0),
                    "chunk_type": doc.metadata.get('chunk_type', 'unknown'),
                    "chunk_index": doc.metadata.get('chunk_index', 0),
                    "total_chunks": doc.metadata.get('total_chunks', 1),
                    "chunk_size": doc.metadata.get('chunk_size', 0),
                    "repo_id": self.repo_id,
                    "code_snippet": doc.page_content[:2000],
                    "is_readme": 'true' if 'readme' in doc.metadata.get('filename', '').lower() else 'false'
                }
                vector_id = f"{self.repo_id}_{idx}_{metadata['filename'].replace('/', '_')}"
                vectors.append({
                    "id": vector_id,
                    "values": embedding,
                    "metadata": metadata
                })
            except Exception as e:
                logger.error("❌ Error processing document %d: %s", idx, e)
                continue

        if not vectors:
            logger.error("❌ No vectors created for storage")
            return {"success": False, "error": "No vectors created", "count": 0}

        # Upload in batches
        logger.info("📤 Uploading %d vectors to Pinecone...", len(vectors))
        batch_size = 100
        total_batches = (len(vectors) + batch_size - 1) // batch_size
        try:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                batch_num = i // batch_size + 1
                logger.info("  📤 Uploading batch %d/%d (%d vectors)", batch_num, total_batches, len(batch))
                self.index.upsert(vectors=batch, namespace=self.namespace)
                logger.info("  ✅ Batch %d/%d uploaded successfully", batch_num, total_batches)
            logger.info("🎉 VECTOR STORAGE COMPLETE!")
            return {"success": True, "count": len(vectors), "index_name": self.index_name, "namespace": self.namespace}
        except Exception as e:
            logger.error("❌ Upload error: %s", e)
            return {"success": False, "error": str(e), "count": 0}
    
    def search_with_context(self, query: str, top_k: int = 5) -> List[Dict]:
        """Search for similar code and return with full context (README first)."""
        try:
            logger.info("Searching for: %s", query)
            query_embedding = self.embedding_model.encode(
                query,
                convert_to_numpy=False,
                show_progress_bar=False
            ).tolist()
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                namespace=self.namespace,
                include_metadata=True
            )
            matches = results.get('matches', [])
            formatted_results = []
            for match in matches:
                metadata = match.get('metadata', {})
                formatted_results.append({
                    'filename': metadata.get('filename', 'unknown'),
                    'language': metadata.get('language', 'unknown'),
                    'code': metadata.get('code_snippet', ''),
                    'similarity': round(match.get('score', 0), 4),
                    'is_readme': metadata.get('is_readme', 'false')
                })
            # Sort README first
            formatted_results.sort(key=lambda x: 0 if x['is_readme'] == 'true' else 1)
            logger.info("Found %d relevant files", len(formatted_results))
            return formatted_results
        except Exception as e:
            logger.error("Search error: %s", e)
            return []

    def get_load_balancing_info(self) -> Dict:
        """Get information about load balancing across indexes."""
        stats = self._get_index_stats()
        return {
            "repo_id": self.repo_id,
            "assigned_index": self.index_name,
            "namespace": self.namespace,
            "available_indexes": self.AVAILABLE_INDEXES,
            "index_statistics": stats,
            "load_balancing_method": "consistent_hashing"
        }

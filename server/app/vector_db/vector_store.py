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
        self.embedding_model = SentenceTransformer('microsoft/codebert-base') #500MB 
        self.dimension = 768  # CodeBERT dimension
        
        self._setup_index()
    
    def _select_index(self) -> str:
        """Select an index using consistent hashing for load balancing."""
        # Use repo_id hash to consistently assign the same repo to the same index
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
            # Get the actual dimension of the selected index
            index_stats = self.index.describe_index_stats()
            index_dimension = index_stats.get('dimension', 0)
            
            logger.info("🔍 Checking index dimension compatibility...")
            logger.info("  📊 Model dimension: %d", self.dimension)
            logger.info("  📊 Index dimension: %d", index_dimension)
            
            if self.dimension != index_dimension:
                logger.error("❌ DIMENSION MISMATCH DETECTED!")
                logger.error("  Model produces %d-dimensional vectors", self.dimension)
                logger.error("  Index expects %d-dimensional vectors", index_dimension)
                
                # Delete the incompatible index and create a new one
                logger.info("🗑️  Deleting incompatible index: %s", self.index_name)
                self.pc.delete_index(self.index_name)
                
                # Wait a moment for deletion to complete
                import time
                time.sleep(2)
                
                # Create new index with correct dimension
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
        
        # Check if the selected index exists
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
        
        # Connect to the index
        self.index = self.pc.Index(self.index_name)
        
        # Check if the existing index has the correct dimension (after connecting)
        if self.index_name in existing:
            self._check_and_fix_dimension()
        
        # Log load balancing info
        logger.info("🎯 Load balancing configuration:")
        logger.info("  📊 Selected index: %s", self.index_name)
        logger.info("  🏷️  Namespace: %s", self.namespace)
        logger.info("  🔄 Available indexes: %s", self.AVAILABLE_INDEXES)
        
        # Show index statistics
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
        
        # Get the chunk content (this is now the actual code content, not JSON)
        chunk_content = doc.page_content
        
        # Create structured embedding text
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
        """Create embeddings and store in Pinecone."""
        if not documents:
            logger.warning("❌ No documents provided for vector storage")
            return {"success": False, "error": "No documents", "count": 0}
        
        logger.info("🚀 Starting vector storage process for %d documents", len(documents))
        
        # Analyze document types
        chunk_types = {}
        total_size = 0
        for doc in documents:
            chunk_type = doc.metadata.get('chunk_type', 'unknown')
            chunk_types[chunk_type] = chunk_types.get(chunk_type, 0) + 1
            total_size += len(doc.page_content)
        
        logger.info("📊 Document analysis:")
        for chunk_type, count in chunk_types.items():
            logger.info("  %s chunks: %d", chunk_type.upper(), count)
        logger.info("  Total content size: %d bytes", total_size)
        
        vectors = []
        
        logger.info("🔮 Generating embeddings with CodeBERT...")
        for idx, doc in enumerate(documents):
            try:
                # Extract context for embedding
                text = self._extract_code_context(doc)
                
                # Generate embedding
                embedding = self.embedding_model.encode(
                    text,
                    convert_to_numpy=False,
                    show_progress_bar=False
                ).tolist()
                
                # Prepare metadata (Pinecone limit: 40KB)
                metadata = {
                    "filename": doc.metadata.get('filename', ''),
                    "language": doc.metadata.get('language', ''),
                    "file_size": doc.metadata.get('file_size', 0),
                    "chunk_type": doc.metadata.get('chunk_type', 'unknown'),
                    "chunk_index": doc.metadata.get('chunk_index', 0),
                    "total_chunks": doc.metadata.get('total_chunks', 1),
                    "chunk_size": doc.metadata.get('chunk_size', 0),
                    "repo_id": self.repo_id,
                    "code_snippet": doc.page_content[:2000]  # Use chunk content instead of full_code
                }
                
                # Create vector ID
                vector_id = f"{self.repo_id}_{idx}_{metadata['filename'].replace('/', '_')}"
                
                vectors.append({
                    "id": vector_id,
                    "values": embedding,
                    "metadata": metadata
                })
                
                if (idx + 1) % 10 == 0:
                    logger.info("  🔮 Embedded %d/%d documents", idx + 1, len(documents))
                    
            except Exception as e:
                logger.error("❌ Error processing document %d: %s", idx, e)
                continue
        
        if not vectors:
            logger.error("❌ No vectors created for storage")
            return {"success": False, "error": "No vectors created", "count": 0}
        
        # Upload to Pinecone in batches
        logger.info("📤 Uploading %d vectors to Pinecone...", len(vectors))
        logger.info("  Index: %s", self.index_name)
        logger.info("  Namespace: %s", self.namespace)
        batch_size = 100
        total_batches = (len(vectors) + batch_size - 1) // batch_size
        
        try:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                batch_num = i//batch_size + 1
                logger.info("  📤 Uploading batch %d/%d (%d vectors)", batch_num, total_batches, len(batch))
                self.index.upsert(vectors=batch, namespace=self.namespace)
                logger.info("  ✅ Batch %d/%d uploaded successfully", batch_num, total_batches)
            
            logger.info("🎉 VECTOR STORAGE COMPLETE!")
            logger.info("📊 STORAGE STATISTICS:")
            logger.info("  📦 Total vectors stored: %d", len(vectors))
            logger.info("  🗂️  Index name: %s", self.index_name)
            logger.info("  🏷️  Namespace: %s", self.namespace)
            logger.info("  📈 Average vector size: %d dimensions", len(vectors[0]['values']) if vectors else 0)
            
            # Show updated index statistics
            stats = self._get_index_stats()
            if self.index_name in stats and 'error' not in stats[self.index_name]:
                current_stats = stats[self.index_name]
                logger.info("  📊 Index '%s' now has %d total vectors across %d namespaces", 
                           self.index_name, current_stats['total_vector_count'], current_stats['namespaces'])
            
            return {
                "success": True,
                "count": len(vectors),
                "index_name": self.index_name,
                "namespace": self.namespace
            }
            
        except Exception as e:
            logger.error("❌ Upload error: %s", e)
            return {"success": False, "error": str(e), "count": 0}
    
    # Add this method to the PineconeVectorStore class

    def search_with_context(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Search for similar code and return with full context.
        Returns list of dicts with filename, code, similarity score.
        """
        try:
            logger.info("Searching for: %s", query)
            
            # Generate query embedding
            query_embedding = self.embedding_model.encode(
                query,
                convert_to_numpy=False,
                show_progress_bar=False
            ).tolist()
            
            # Query Pinecone
            results = self.index.query(
                vector=query_embedding,
                top_k=top_k,
                namespace=self.namespace,
                include_metadata=True
            )
            
            matches = results.get('matches', [])
            
            # Format results with context
            formatted_results = []
            for match in matches:
                metadata = match.get('metadata', {})
                formatted_results.append({
                    'filename': metadata.get('filename', 'unknown'),
                    'language': metadata.get('language', 'unknown'),
                    'code': metadata.get('code_snippet', ''),
                    'similarity': round(match.get('score', 0), 4),
                    'file_size': metadata.get('file_size', 0)
                })
            
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

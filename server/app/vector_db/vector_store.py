import os
import json
import logging
from typing import List, Dict
from pinecone import Pinecone, ServerlessSpec
from sentence_transformers import SentenceTransformer
from langchain.docstore.document import Document

logger = logging.getLogger(__name__)

class PineconeVectorStore:
    """Manages Pinecone vector store for code embeddings using CodeBERT."""
    
    def __init__(self, repo_id: str):
        self.repo_id = repo_id
        self.index_name = f"code-repo-{repo_id}".lower()[:45]  # Pinecone name limits
        
        # Initialize Pinecone
        api_key = os.getenv("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY not found in environment")
        
        logger.info("Initializing Pinecone...")
        self.pc = Pinecone(api_key=api_key)
        
        # Load CodeBERT model for code embeddings
        logger.info("Loading CodeBERT embedding model...")
        self.embedding_model = SentenceTransformer('microsoft/codebert-base')
        self.dimension = 768  # CodeBERT dimension
        
        self._setup_index()
    
    def _setup_index(self):
        """Create or connect to Pinecone index."""
        existing = [idx.name for idx in self.pc.list_indexes()]
        
        if self.index_name not in existing:
            logger.info(f"Creating Pinecone index: {self.index_name}")
            self.pc.create_index(
                name=self.index_name,
                dimension=self.dimension,
                metric='cosine',
                spec=ServerlessSpec(
                    cloud='aws',
                    region=os.getenv('PINECONE_ENVIRONMENT', 'us-east-1')
                )
            )
        
        self.index = self.pc.Index(self.index_name)
        logger.info(f"Connected to index: {self.index_name}")
    
    def _extract_code_context(self, doc: Document) -> str:
        """Extract meaningful context from AST for embedding."""
        metadata = doc.metadata
        filename = metadata.get('filename', '')
        language = metadata.get('language', '')
        code = metadata.get('full_code', '')
        
        try:
            ast_data = json.loads(doc.page_content)
            nodes = ast_data.get('nodes', [])
            
            # Extract important code elements
            important_types = {
                'function_declaration', 'function_definition', 'method_declaration',
                'class_declaration', 'class_definition', 'identifier'
            }
            
            identifiers = []
            for node in nodes:
                if node.get('type') in important_types:
                    text = node.get('text', '').strip()
                    if 3 < len(text) < 100:
                        identifiers.append(text)
            
            # Create structured embedding text
            context = f"""
File: {filename}
Language: {language}
Functions/Classes: {' '.join(identifiers[:20])}
Code:
{code[:3000]}
            """.strip()
            
            return context
            
        except Exception as e:
            logger.warning(f"Error parsing AST for {filename}: {e}")
            return f"File: {filename}\nLanguage: {language}\nCode:\n{code[:3000]}"
    
    def add_documents(self, documents: List[Document]) -> Dict:
        """Create embeddings and store in Pinecone."""
        if not documents:
            return {"success": False, "error": "No documents", "count": 0}
        
        logger.info(f"Processing {len(documents)} documents...")
        vectors = []
        
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
                    "node_count": doc.metadata.get('node_count', 0),
                    "repo_id": self.repo_id,
                    "code_snippet": doc.metadata.get('full_code', '')[:2000]
                }
                
                # Create vector ID
                vector_id = f"{self.repo_id}_{idx}_{metadata['filename'].replace('/', '_')}"
                
                vectors.append({
                    "id": vector_id,
                    "values": embedding,
                    "metadata": metadata
                })
                
                if (idx + 1) % 10 == 0:
                    logger.info(f"Embedded {idx + 1}/{len(documents)}")
                    
            except Exception as e:
                logger.error(f"Error processing document {idx}: {e}")
                continue
        
        if not vectors:
            return {"success": False, "error": "No vectors created", "count": 0}
        
        # Upload to Pinecone in batches
        logger.info(f"Uploading {len(vectors)} vectors...")
        batch_size = 100
        
        try:
            for i in range(0, len(vectors), batch_size):
                batch = vectors[i:i + batch_size]
                self.index.upsert(vectors=batch, namespace=self.repo_id)
                logger.info(f"Uploaded batch {i//batch_size + 1}")
            
            return {
                "success": True,
                "count": len(vectors),
                "index_name": self.index_name,
                "namespace": self.repo_id
            }
            
        except Exception as e:
            logger.error(f"Upload error: {e}")
            return {"success": False, "error": str(e), "count": 0}
    
    # Add this method to the PineconeVectorStore class

    def search_with_context(self, query: str, top_k: int = 5) -> List[Dict]:
        """
        Search for similar code and return with full context.
        Returns list of dicts with filename, code, similarity score.
        """
        try:
            logger.info(f"Searching for: {query}")
            
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
                namespace=self.repo_id,
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
            
            logger.info(f"Found {len(formatted_results)} relevant files")
            return formatted_results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []

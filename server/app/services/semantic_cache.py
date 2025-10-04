import numpy as np
from sentence_transformers import SentenceTransformer
from typing import List, Dict, Tuple, Optional
import logging
from dataclasses import dataclass
import json
import time

logger = logging.getLogger(__name__)

@dataclass
class SemanticCacheEntry:
    query_embedding: List[float]
    original_query: str
    answer: str
    relevant_files: List[Dict]
    timestamp: float
    similarity_threshold: float = 0.85

class SemanticQueryCache:
    """
    Advanced semantic caching that finds similar queries and reuses context.
    Uses sentence transformers to find semantically similar queries.
    """
    
    def __init__(self):
        # Use a lightweight model for semantic similarity
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.cache_entries: List[SemanticCacheEntry] = []
        self.max_cache_size = 1000
    
    def _get_query_embedding(self, query: str) -> List[float]:
        """Get embedding for query."""
        return self.embedding_model.encode(query).tolist()
    
    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
    
    def find_similar_query(
        self, 
        query: str, 
        threshold: float = 0.85
    ) -> Optional[SemanticCacheEntry]:
        """
        Find semantically similar cached query.
        Returns the most similar entry if above threshold.
        """
        query_embedding = self._get_query_embedding(query)
        
        best_match = None
        best_similarity = 0.0
        
        for entry in self.cache_entries:
            similarity = self._cosine_similarity(query_embedding, entry.query_embedding)
            
            if similarity > threshold and similarity > best_similarity:
                best_similarity = similarity
                best_match = entry
        
        if best_match:
            logger.info(f"🔍 Found similar query (similarity: {best_similarity:.3f}): {best_match.original_query[:50]}...")
        
        return best_match
    
    def add_query(
        self, 
        query: str, 
        answer: str, 
        relevant_files: List[Dict],
        similarity_threshold: float = 0.85
    ) -> None:
        """Add new query to semantic cache."""
        query_embedding = self._get_query_embedding(query)
        
        entry = SemanticCacheEntry(
            query_embedding=query_embedding,
            original_query=query,
            answer=answer,
            relevant_files=relevant_files,
            timestamp=time.time(),
            similarity_threshold=similarity_threshold
        )
        
        self.cache_entries.append(entry)
        
        # Maintain cache size
        if len(self.cache_entries) > self.max_cache_size:
            # Remove oldest entries
            self.cache_entries.sort(key=lambda x: x.timestamp)
            self.cache_entries = self.cache_entries[-self.max_cache_size:]
        
        logger.info(f"💾 Added query to semantic cache: {query[:50]}...")
    
    def get_incremental_context_from_similar(
        self, 
        query: str, 
        new_files: List[Dict]
    ) -> Tuple[List[Dict], str, float]:
        """
        Find similar query and return incremental context.
        Returns (files_to_send, cached_context, similarity_score)
        """
        similar_entry = self.find_similar_query(query)
        
        if not similar_entry:
            return new_files, "", 0.0
        
        # Check which files from similar query are in new files
        similar_files = {f['filename']: f for f in similar_entry.relevant_files}
        files_to_send = []
        cached_files = []
        
        for file_info in new_files:
            filename = file_info['filename']
            if filename in similar_files:
                cached_files.append(similar_files[filename])
            else:
                files_to_send.append(file_info)
        
        # Build context from cached files
        cached_context = ""
        if cached_files:
            cached_context = self._build_context_from_files(cached_files)
            logger.info(f"🔄 Semantic cache: {len(cached_files)} files reused, {len(files_to_send)} new")
        
        similarity_score = self._cosine_similarity(
            self._get_query_embedding(query),
            similar_entry.query_embedding
        )
        
        return files_to_send, cached_context, similarity_score
    
    def _build_context_from_files(self, files: List[Dict]) -> str:
        """Build context string from file data."""
        context_parts = []
        for file_data in files:
            filename = file_data.get('filename', 'unknown')
            code = file_data.get('code', '')
            language = file_data.get('language', '')
            
            context_parts.append(f"=== {filename} ({language}) ===")
            context_parts.append(code)
            context_parts.append("")
        
        return "\n".join(context_parts)
    
    def get_cache_stats(self) -> Dict:
        """Get semantic cache statistics."""
        return {
            'total_entries': len(self.cache_entries),
            'max_size': self.max_cache_size,
            'oldest_entry': min([e.timestamp for e in self.cache_entries]) if self.cache_entries else 0,
            'newest_entry': max([e.timestamp for e in self.cache_entries]) if self.cache_entries else 0
        }

# Global semantic cache instance
semantic_cache = SemanticQueryCache()


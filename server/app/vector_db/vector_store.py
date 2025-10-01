# server/app/services/vector_store.py
import os
from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec

load_dotenv()

class PineconeVectorStore:
    """
    Wrapper for Pinecone vector DB.
    Stores and queries embeddings for codebase comprehension.
    """

    def __init__(self, index_name: str = "codebase-index", dimension: int = 1536, metric: str = "cosine"):
        api_key = os.environ.get("PINECONE_API_KEY")
        if not api_key:
            raise ValueError("PINECONE_API_KEY environment variable is required")

        self.pc = Pinecone(api_key=api_key)
        self.index_name = index_name

        # Create index if it doesn’t exist
        if index_name not in [i["name"] for i in self.pc.list_indexes()]:
            self.pc.create_index(
                name=index_name,
                dimension=dimension,
                metric=metric,
                spec=ServerlessSpec(cloud="aws", region="us-east-1")
            )

        self.index = self.pc.Index(index_name)

    def upsert(self, repo_id: str, embeddings: list[tuple[str, list[float], dict]]):
        """
        Upsert embeddings into Pinecone.
        embeddings: List of (id, vector, metadata)
        """
        self.index.upsert(vectors=embeddings, namespace=repo_id)

    def query(self, repo_id: str, vector: list[float], top_k: int = 5) -> list[dict]:
        """
        Query Pinecone index by vector.
        Returns top_k matches with metadata.
        """
        result = self.index.query(
            namespace=repo_id,
            vector=vector,
            top_k=top_k,
            include_metadata=True
        )
        return result["matches"]

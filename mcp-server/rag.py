
import chromadb
from sentence_transformers import SentenceTransformer
import logging

CHROMA_PATH = "chroma_db"

class RAGEngine:
    def __init__(self):
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
        self.collection = self.chroma_client.get_or_create_collection(name="industrial_audit_norms")
        
    def query_norms(self, query_text: str, n_results=5):
        """Query the vector database for relevant norms"""
        query_embedding = self.embedding_model.encode([query_text]).tolist()
        
        results = self.collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        formatted_results = []
        if results['documents']:
            for i, doc in enumerate(results['documents'][0]):
                meta = results['metadatas'][0][i]
                formatted_results.append(f"[{meta['source'].upper()}] {doc} (File: {meta.get('file', 'N/A')})")
                
        return "\n\n".join(formatted_results)

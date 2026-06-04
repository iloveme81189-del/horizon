import os
import uuid
import datetime
import json
from langchain_core.documents import Document
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_pinecone import PineconeVectorStore

class NotebookStore:
    def __init__(self):
        gemini_key = os.getenv("GEMINI_API_KEY")
        if not gemini_key:
            raise Exception("GEMINI_API_KEY is not set. Cannot initialize embeddings.")
            
        # Cloud embedding model (Dimension: 768)
        self.embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key=gemini_key)
        self.index_name = os.getenv("PINECONE_INDEX_NAME", "horizon-memory")
        
        # Pinecone handles its own API key via the PINECONE_API_KEY environment variable.
        # If the key isn't set, this will fail gracefully during instantiation.
        try:
            self.vectorstore = PineconeVectorStore(
                index_name=self.index_name,
                embedding=self.embeddings
            )
            self.connected = True
        except Exception as e:
            print(f"Failed to connect to Pinecone: {e}")
            self.connected = False

    async def save_interaction(self, task_id: str, model: str, messages: list, response: str, usage: dict):
        if not getattr(self, 'connected', False):
            return
            
        timestamp = datetime.datetime.utcnow().isoformat()
        metadata = {
            "task_id": task_id,
            "model": model,
            "messages": json.dumps(messages),
            "usage_total": usage.get("total_tokens", 0),
            "timestamp": timestamp,
            "id": str(uuid.uuid4()),
        }
        
        doc = Document(
            page_content=response,
            metadata=metadata,
        )
        try:
            await self.vectorstore.aadd_documents([doc])
        except Exception as e:
            print(f"Failed to add document to Pinecone: {e}")

    def search(self, query: str, k: int = 5):
        if not getattr(self, 'connected', False):
            return []
            
        results = self.vectorstore.similarity_search(query, k=k)
        return [
            {
                "content": r.page_content,
                "metadata": r.metadata,
            }
            for r in results
        ]

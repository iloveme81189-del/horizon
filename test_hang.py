import os
from langchain_google_genai import GoogleGenerativeAIEmbeddings

try:
    print("Initializing embeddings with bad key...")
    embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001", google_api_key="FERNET:badkey")
    print("Calling embed_documents...")
    result = embeddings.embed_documents(["hello world"])
    print("Success:", result[:5])
except Exception as e:
    print("Caught exception:", e)

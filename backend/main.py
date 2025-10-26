from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
from file_processor import extract_text
from embeddings import create_embeddings, search_document
from rag import query_with_rag

app = FastAPI(title="Pythagorean API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage
documents = {}
collections = {}  # NEW: Store collections of documents


class SearchRequest(BaseModel):
    link_id: str
    question: str


class QueryRequest(BaseModel):
    link_id: str  # Can now be either doc_id OR collection_id
    question: str
    conversation_history: Optional[List[dict]] = []


@app.get("/")
async def root():
    return {"message": "Pythagorean API is running!"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "documents_count": len(documents),
        "collections_count": len(collections)
    }


# NEW: Create a collection endpoint
@app.post("/collection/create")
async def create_collection():
    """
    Create a new collection for grouping multiple documents
    """
    collection_id = str(uuid.uuid4())[:8]
    collections[collection_id] = {
        "id": collection_id,
        "documents": [],
        "created_at": "now"
    }
    return {
        "collection_id": collection_id,
        "message": "Collection created"
    }


# UPDATED: Upload to collection
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    collection_id: Optional[str] = None
):
    """
    Upload a file - optionally to a collection
    """
    try:
        doc_id = str(uuid.uuid4())[:8]
        
        # Save file temporarily
        temp_path = f"/tmp/{doc_id}_{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract text
        extracted_text, file_type = extract_text(temp_path)
        os.remove(temp_path)
        
        # Create embeddings
        embedding_info = create_embeddings(doc_id, extracted_text)
        
        # Store metadata
        documents[doc_id] = {
            "id": doc_id,
            "filename": file.filename,
            "file_type": file_type,
            "chunks": embedding_info["chunks_created"],
            "collection_id": collection_id  # NEW: Link to collection
        }
        
        # If part of collection, add to collection
        if collection_id and collection_id in collections:
            collections[collection_id]["documents"].append(doc_id)
        
        return {
            "link_id": doc_id,
            "collection_id": collection_id,
            "filename": file.filename,
            "file_type": file_type,
            "chunks_created": embedding_info["chunks_created"],
            "shareable_url": f"http://localhost:3000/chat/{collection_id or doc_id}",
            "message": "File processed and ready for questions!"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search")
async def search(request: SearchRequest):
    if request.link_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    
    results = search_document(request.link_id, request.question, n_results=3)
    
    return {
        "link_id": request.link_id,
        "question": request.question,
        "results": results
    }


@app.post("/query")
async def query(request: QueryRequest):
    """
    Query can now handle both single documents AND collections
    """
    # Check if it's a collection
    if request.link_id in collections:
        return await query_collection(request)
    
    # Otherwise, treat as single document
    if request.link_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        answer, sources = query_with_rag(
            request.link_id,
            request.question,
            request.conversation_history
        )
        
        return {
            "answer": answer,
            "sources": sources,
            "link_id": request.link_id,
            "type": "document"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying document: {str(e)}")


# NEW: Query a collection of documents
async def query_collection(request: QueryRequest):
    """
    Query across multiple documents in a collection
    """
    collection = collections[request.link_id]
    doc_ids = collection["documents"]
    
    if not doc_ids:
        raise HTTPException(status_code=400, detail="Collection is empty")
    
    try:
        # We'll create a new function to handle multi-doc queries
        from rag import query_multiple_documents
        
        answer, sources = query_multiple_documents(
            doc_ids,
            request.question,
            request.conversation_history
        )
        
        return {
            "answer": answer,
            "sources": sources,
            "link_id": request.link_id,
            "type": "collection",
            "document_count": len(doc_ids)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying collection: {str(e)}")


# NEW: Get collection info
@app.get("/collection/{collection_id}")
async def get_collection(collection_id: str):
    """
    Get information about a collection
    """
    if collection_id not in collections:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    collection = collections[collection_id]
    
    # Get document details
    docs = []
    for doc_id in collection["documents"]:
        if doc_id in documents:
            docs.append(documents[doc_id])
    
    return {
        "id": collection_id,
        "document_count": len(docs),
        "documents": docs,
        "created_at": collection["created_at"]
    }


@app.get("/document/{link_id}")
async def get_document(link_id: str):
    if link_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    return documents[link_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
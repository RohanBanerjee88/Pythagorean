from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
from file_processor import extract_text
from embeddings import create_embeddings, search_document
from rag import query_with_rag  # NEW!

app = FastAPI(title="Pythagorean API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

documents = {}


class SearchRequest(BaseModel):
    link_id: str
    question: str


# NEW: Query request model with conversation history
class QueryRequest(BaseModel):
    link_id: str
    question: str
    conversation_history: Optional[List[dict]] = []


@app.get("/")
async def root():
    return {"message": "Pythagorean API is running!"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "documents_count": len(documents)}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    try:
        doc_id = str(uuid.uuid4())[:8]
        
        temp_path = f"/tmp/{doc_id}_{file.filename}"
        with open(temp_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        extracted_text, file_type = extract_text(temp_path)
        os.remove(temp_path)
        
        embedding_info = create_embeddings(doc_id, extracted_text)
        
        documents[doc_id] = {
            "id": doc_id,
            "filename": file.filename,
            "file_type": file_type,
            "chunks": embedding_info["chunks_created"]
        }
        
        return {
            "link_id": doc_id,
            "filename": file.filename,
            "file_type": file_type,
            "chunks_created": embedding_info["chunks_created"],
            "shareable_url": f"http://localhost:3000/chat/{doc_id}",  # For later!
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


# NEW: The main query endpoint with Claude!
@app.post("/query")
async def query(request: QueryRequest):
    """
    Ask a question about a document - Claude will answer using RAG!
    """
    if request.link_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        # Use RAG to get the answer
        answer, sources = query_with_rag(
            request.link_id,
            request.question,
            request.conversation_history
        )
        
        return {
            "answer": answer,
            "sources": sources,
            "link_id": request.link_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying document: {str(e)}")


@app.get("/document/{link_id}")
async def get_document(link_id: str):
    if link_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    return documents[link_id]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
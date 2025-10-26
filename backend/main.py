from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uuid
import os
from datetime import datetime
from file_processor import extract_text
from embeddings import create_embeddings, search_document
from rag import query_with_rag, query_multiple_documents

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
collections = {}
conversations = {}  # NEW: Store conversation history
reactions = {}      # NEW: Store reactions to messages
comments = {}       # NEW: Store comments on messages


# ==================== MODELS ====================

class SearchRequest(BaseModel):
    link_id: str
    question: str


class QueryRequest(BaseModel):
    link_id: str
    question: str
    conversation_history: Optional[List[dict]] = []
    conversation_id: Optional[str] = None  # NEW: Track conversations


class ReactionRequest(BaseModel):
    conversation_id: str
    message_index: int
    reaction: str  # e.g., "👍", "👎", "💡", "❓", "🔥"


class CommentRequest(BaseModel):
    conversation_id: str
    message_index: int
    comment_text: str
    user_name: Optional[str] = "Anonymous"


# ==================== EXISTING ENDPOINTS ====================

@app.get("/")
async def root():
    return {"message": "Pythagorean API is running!"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "documents_count": len(documents),
        "collections_count": len(collections),
        "conversations_count": len(conversations)
    }


@app.post("/collection/create")
async def create_collection():
    collection_id = str(uuid.uuid4())[:8]
    collections[collection_id] = {
        "id": collection_id,
        "documents": [],
        "created_at": datetime.now().isoformat()
    }
    return {
        "collection_id": collection_id,
        "message": "Collection created"
    }


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    collection_id: Optional[str] = None
):
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
            "chunks": embedding_info["chunks_created"],
            "collection_id": collection_id
        }
        
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
    Also creates/updates conversation history
    """
    # Create or get conversation ID
    if not request.conversation_id:
        conversation_id = str(uuid.uuid4())[:12]
    else:
        conversation_id = request.conversation_id
    
    # Check if it's a collection
    if request.link_id in collections:
        result = await query_collection(request)
    elif request.link_id in documents:
        try:
            answer, sources = query_with_rag(
                request.link_id,
                request.question,
                request.conversation_history
            )
            
            result = {
                "answer": answer,
                "sources": sources,
                "link_id": request.link_id,
                "type": "document"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error querying document: {str(e)}")
    else:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Store conversation
    if conversation_id not in conversations:
        conversations[conversation_id] = {
            "id": conversation_id,
            "link_id": request.link_id,
            "messages": [],
            "created_at": datetime.now().isoformat()
        }
    
    # Add user message and AI response
    conversations[conversation_id]["messages"].append({
        "role": "user",
        "content": request.question,
        "timestamp": datetime.now().isoformat()
    })
    
    conversations[conversation_id]["messages"].append({
        "role": "assistant",
        "content": result["answer"],
        "sources": result.get("sources", []),
        "timestamp": datetime.now().isoformat()
    })
    
    # Add conversation_id to result
    result["conversation_id"] = conversation_id
    
    return result


async def query_collection(request: QueryRequest):
    collection = collections[request.link_id]
    doc_ids = collection["documents"]
    
    if not doc_ids:
        raise HTTPException(status_code=400, detail="Collection is empty")
    
    try:
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


@app.get("/collection/{collection_id}")
async def get_collection(collection_id: str):
    if collection_id not in collections:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    collection = collections[collection_id]
    
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


# ==================== NEW: COLLABORATION ENDPOINTS ====================

@app.post("/reaction/add")
async def add_reaction(request: ReactionRequest):
    """
    Add a reaction to a specific message
    """
    if request.conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Create reaction key
    reaction_key = f"{request.conversation_id}_{request.message_index}"
    
    if reaction_key not in reactions:
        reactions[reaction_key] = {}
    
    # Add or update reaction count
    if request.reaction not in reactions[reaction_key]:
        reactions[reaction_key][request.reaction] = 0
    
    reactions[reaction_key][request.reaction] += 1
    
    return {
        "conversation_id": request.conversation_id,
        "message_index": request.message_index,
        "reactions": reactions[reaction_key]
    }


@app.get("/reaction/{conversation_id}/{message_index}")
async def get_reactions(conversation_id: str, message_index: int):
    """
    Get all reactions for a specific message
    """
    reaction_key = f"{conversation_id}_{message_index}"
    
    return {
        "conversation_id": conversation_id,
        "message_index": message_index,
        "reactions": reactions.get(reaction_key, {})
    }


@app.post("/comment/add")
async def add_comment(request: CommentRequest):
    """
    Add a comment to a specific message
    """
    if request.conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    comment_key = f"{request.conversation_id}_{request.message_index}"
    
    if comment_key not in comments:
        comments[comment_key] = []
    
    comment = {
        "id": str(uuid.uuid4())[:8],
        "text": request.comment_text,
        "user_name": request.user_name,
        "timestamp": datetime.now().isoformat()
    }
    
    comments[comment_key].append(comment)
    
    return {
        "conversation_id": request.conversation_id,
        "message_index": request.message_index,
        "comment": comment,
        "total_comments": len(comments[comment_key])
    }


@app.get("/comment/{conversation_id}/{message_index}")
async def get_comments(conversation_id: str, message_index: int):
    """
    Get all comments for a specific message
    """
    comment_key = f"{conversation_id}_{message_index}"
    
    return {
        "conversation_id": conversation_id,
        "message_index": message_index,
        "comments": comments.get(comment_key, [])
    }


@app.get("/conversation/{conversation_id}")
async def get_conversation(conversation_id: str):
    """
    Get full conversation with all messages, reactions, and comments
    """
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    conversation = conversations[conversation_id]
    
    # Attach reactions and comments to each message
    enriched_messages = []
    for idx, message in enumerate(conversation["messages"]):
        reaction_key = f"{conversation_id}_{idx}"
        comment_key = f"{conversation_id}_{idx}"
        
        enriched_messages.append({
            **message,
            "index": idx,
            "reactions": reactions.get(reaction_key, {}),
            "comments": comments.get(comment_key, [])
        })
    
    return {
        **conversation,
        "messages": enriched_messages
    }


@app.get("/conversation/{conversation_id}/share")
async def get_shareable_link(conversation_id: str):
    """
    Generate a shareable link for a conversation
    """
    if conversation_id not in conversations:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {
        "conversation_id": conversation_id,
        "shareable_url": f"http://localhost:3000/conversation/{conversation_id}",
        "message": "Share this link to let others view this conversation"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


@app.get("/document/{link_id}/activity")
async def get_document_activity(link_id: str):
    """
    Get ALL conversations, reactions, and comments for a document/collection
    This is what the SENDER sees - all activity on their shared document
    """
    # Check if document or collection exists
    if link_id not in documents and link_id not in collections:
        raise HTTPException(status_code=404, detail="Document/Collection not found")
    
    # Find all conversations for this document
    doc_conversations = []
    for conv_id, conv_data in conversations.items():
        if conv_data["link_id"] == link_id:
            # Enrich with reactions and comments
            enriched_messages = []
            for idx, message in enumerate(conv_data["messages"]):
                reaction_key = f"{conv_id}_{idx}"
                comment_key = f"{conv_id}_{idx}"
                
                enriched_messages.append({
                    **message,
                    "index": idx,
                    "reactions": reactions.get(reaction_key, {}),
                    "comments": comments.get(comment_key, [])
                })
            
            doc_conversations.append({
                "conversation_id": conv_id,
                "created_at": conv_data["created_at"],
                "messages": enriched_messages,
                "message_count": len(conv_data["messages"])
            })
    
    # Sort by most recent first
    doc_conversations.sort(key=lambda x: x["created_at"], reverse=True)
    
    # Calculate statistics
    total_reactions = sum(
        sum(r.values()) 
        for r in reactions.values() 
        if any(conv["conversation_id"] in r_key for conv in doc_conversations for r_key in [list(reactions.keys())])
    )
    
    total_comments = sum(
        len(c) 
        for c in comments.values()
        if any(conv["conversation_id"] in c_key for conv in doc_conversations for c_key in [list(comments.keys())])
    )
    
    return {
        "link_id": link_id,
        "total_conversations": len(doc_conversations),
        "total_reactions": total_reactions,
        "total_comments": total_comments,
        "conversations": doc_conversations
    }
import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer
from typing import List, Dict

# Initialize ChromaDB client (persistent storage)
chroma_client = chromadb.PersistentClient(
    path="./chroma_db",
    settings=Settings(anonymized_telemetry=False)
)

# Initialize embedding model (this converts text to vectors)
# Using a small, fast model - perfect for our MVP
embedding_model = SentenceTransformer('all-MiniLM-L6-v2')


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """
    Split text into overlapping chunks
    
    Why overlap? So we don't cut important context in half!
    Example: "The capital of France is Paris" shouldn't be split between chunks
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to break at a sentence boundary (. or newline)
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            
            # Only use the break point if it's not too far back
            if break_point > chunk_size * 0.5:
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap  # Overlap so we don't lose context
    
    # Filter out tiny chunks
    return [c for c in chunks if len(c.strip()) > 50]


def create_embeddings(doc_id: str, text: str) -> Dict:
    """
    Main function: Takes text, chunks it, creates embeddings, stores in ChromaDB
    
    Returns info about what was created
    """
    # Step 1: Chunk the text
    chunks = chunk_text(text)
    print(f"Created {len(chunks)} chunks from document")
    
    # Step 2: Create embeddings for each chunk
    # This is where the AI magic happens - converting text to vectors!
    print("Creating embeddings... (this might take a few seconds)")
    embeddings = embedding_model.encode(chunks).tolist()
    print(f"Created {len(embeddings)} embeddings")
    
    # Step 3: Store in ChromaDB
    # Each document gets its own collection
    collection = chroma_client.get_or_create_collection(
        name=f"doc_{doc_id}",
        metadata={"hnsw:space": "cosine"}  # Use cosine similarity for search
    )
    
    # Add chunks with their embeddings
    collection.add(
        embeddings=embeddings,
        documents=chunks,
        ids=[f"{doc_id}_chunk_{i}" for i in range(len(chunks))],
        metadatas=[{"chunk_index": i, "doc_id": doc_id} for i in range(len(chunks))]
    )
    
    print(f"Stored {len(chunks)} chunks in ChromaDB")
    
    return {
        "chunks_created": len(chunks),
        "first_chunk_preview": chunks[0][:100] + "..." if chunks else "",
        "embedding_dimensions": len(embeddings[0]) if embeddings else 0
    }


def search_document(doc_id: str, query: str, n_results: int = 5) -> List[Dict]:
    """
    Search for relevant chunks in a document
    
    This is the magic: converting a question to a vector and finding similar chunks!
    """
    try:
        # Get the collection for this document
        collection = chroma_client.get_collection(name=f"doc_{doc_id}")
        
        # Convert query to embedding
        query_embedding = embedding_model.encode([query]).tolist()
        
        # Search! ChromaDB finds the most similar chunks
        results = collection.query(
            query_embeddings=query_embedding,
            n_results=n_results
        )
        
        # Format results nicely
        chunks = []
        if results['documents'] and len(results['documents'][0]) > 0:
            for i, doc in enumerate(results['documents'][0]):
                chunks.append({
                    "text": doc,
                    "metadata": results['metadatas'][0][i],
                    "similarity_score": 1 - results['distances'][0][i]  # Convert distance to similarity
                })
        
        return chunks
        
    except Exception as e:
        print(f"Search error: {e}")
        return []
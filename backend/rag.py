from anthropic import Anthropic
import os
from dotenv import load_dotenv
from typing import List, Tuple, Dict
from embeddings import search_document

# Load environment variables
load_dotenv()

# Initialize Anthropic client
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))


def query_with_rag(doc_id: str, question: str, conversation_history: List[Dict] = None) -> Tuple[str, List[str]]:
    """
    RAG Pipeline: Retrieval-Augmented Generation
    
    1. Retrieve relevant chunks from the document
    2. Send them to Claude with the question
    3. Claude generates an answer based on the context
    
    Returns: (answer, source_chunks)
    """
    
    # Step 1: RETRIEVE - Get relevant chunks using vector search
    print(f"Searching for relevant chunks for: {question}")
    chunks = search_document(doc_id, question, n_results=5)
    
    if not chunks:
        return "I couldn't find any relevant information in the document to answer your question.", []
    
    print(f"Found {len(chunks)} relevant chunks")
    
    # Step 2: BUILD CONTEXT - Format chunks for Claude
    context = "\n\n".join([
        f"[Source {i+1}]:\n{chunk['text']}"
        for i, chunk in enumerate(chunks)
    ])
    
    # Step 3: BUILD PROMPT - Create the prompt for Claude
    system_prompt = """You are a helpful AI assistant that answers questions based on the provided document context.

Rules:
- Answer ONLY based on the context provided
- If the context doesn't contain the answer, say so clearly
- Cite your sources (e.g., "According to Source 1...")
- Be concise but complete
- If you're not sure, say so"""

    user_message = f"""DOCUMENT CONTEXT:
{context}

USER QUESTION: {question}

Please answer the question based only on the context above."""

    # Step 4: BUILD MESSAGES - Include conversation history if provided
    messages = []
    
    if conversation_history:
        # Add previous conversation (last 5 messages to save tokens)
        for msg in conversation_history[-5:]:
            messages.append({
                "role": msg.get("role", "user"),
                "content": msg.get("content", "")
            })
    
    # Add current question
    messages.append({
        "role": "user",
        "content": user_message
    })
    
    # Step 5: GENERATE - Ask Claude!
    print("Asking Claude...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=system_prompt,
        messages=messages
    )
    
    # Extract the answer
    answer = response.content[0].text
    
    # Extract source texts for reference
    sources = [chunk['text'][:200] + "..." for chunk in chunks[:3]]
    
    print("Got answer from Claude!")
    return answer, sources


def test_rag():
    """
    Simple test function to verify RAG is working
    """
    # This is just for testing - you can delete this later
    test_question = "What is this document about?"
    answer, sources = query_with_rag("test_doc", test_question)
    print(f"Question: {test_question}")
    print(f"Answer: {answer}")
    print(f"Sources: {sources}")
# Pythagorean
**Dropbox that thinks — AI memory for every file.**

Pythangorean transforms static files into living, conversational AI memories. Upload any document, generate a secure shareable link, and let others interact with your file through an intelligent chat interface. Recipients can query, summarize, and extract insights—no need to read the whole file!

## Features

- Upload files via desktop app or API
- Files are converted to semantic embeddings (E5, Chroma)
- Share a unique, secure link to chat with your file
- Natural language Q&A, instant summarization, and data extraction
- Secure memory layer for persistent conversation and insights
- Embed the chat interface anywhere via iframe

## Tech Stack

- **Desktop App:** Electron 
- **Embeddings:** Microsoft E5 (or other open-source models)
- **Vector DB:** Chroma
- **API + Backend:** FastAPI (Python)
- **Frontend:** React 

## Getting Started

1. Clone this repo:
   ```bash
   git clone https://github.com/yourusername/pythangorean.git
   ```
2. Install dependencies for backend and frontend.
3. Start the backend server:
   ```bash
   cd backend
   pip install -r requirements.txt
   uvicorn main:app --reload
   ```
4. Run the desktop app or frontend:
   ```bash
   cd frontend
   npm install
   npm start
   ```
5. Upload files, generate links, and test conversational memory!

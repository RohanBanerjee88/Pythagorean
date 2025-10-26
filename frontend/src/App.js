import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = 'http://localhost:8000';

function App() {
  // Mode: 'landing', 'upload', or 'chat'
  const [mode, setMode] = useState('landing');
  
  // Chat mode state
  const [linkId, setLinkId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [docInfo, setDocInfo] = useState(null);
  
  // Upload mode state
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  
  // Auto-scroll in chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // ==================== UPLOAD MODE ====================
  
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setError('');
    }
  };
  
  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setError('');
    
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      setUploadResult(response.data);
      setUploading(false);
      
    } catch (error) {
      setError('Upload failed: ' + (error.response?.data?.detail || error.message));
      setUploading(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };
  
  // ==================== CHAT MODE ====================
  
  const fetchDocumentInfo = async () => {
    try {
      const response = await axios.get(`${API_BASE}/document/${linkId}`);
      setDocInfo(response.data);
      setError('');
      
      setMessages([{
        role: 'assistant',
        content: `Hi! I'm ready to answer questions about **${response.data.filename}**. What would you like to know?`
      }]);
    } catch (error) {
      setError('Document not found. Please check your link ID.');
      setMessages([]);
    }
  };
  
  const sendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || isLoading) return;
    
    const userMessage = inputMessage.trim();
    setInputMessage('');
    
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.post(`${API_BASE}/query`, {
        link_id: linkId,
        question: userMessage,
        conversation_history: newMessages.slice(-10)
      });
      
      setMessages([...newMessages, {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources
      }]);
      
    } catch (error) {
      setError('Error getting response: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsLoading(false);
    }
  };
  
  const startChat = () => {
    if (linkId.trim()) {
      fetchDocumentInfo();
      setMode('chat');
    }
  };
  
  // ==================== RENDER ====================
  
  // Landing Page
  if (mode === 'landing') {
    return (
      <div className="app-container">
        <div className="landing-screen">
          <h1>🔺 Pythagorean</h1>
          <p className="tagline">Turn files into AI conversations</p>
          
          <div className="action-buttons">
            <button 
              className="action-btn upload-btn"
              onClick={() => setMode('upload')}
            >
              📤 Upload & Share
              <span>Upload a file and get a shareable link</span>
            </button>
            
            <button 
              className="action-btn chat-btn"
              onClick={() => setMode('chat')}
            >
              💬 Chat with Document
              <span>Have a link? Start chatting</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Upload Mode
  if (mode === 'upload') {
    return (
      <div className="app-container">
        <div className="upload-screen">
          <button className="back-btn" onClick={() => setMode('landing')}>
            ← Back
          </button>
          
          <h1>📤 Upload Document</h1>
          <p>Upload a file to create a shareable AI chat link</p>
          
          {!uploadResult ? (
            <div className="upload-area">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls"
                className="file-input"
                id="file-input"
              />
              <label htmlFor="file-input" className="file-label">
                {selectedFile ? (
                  <div className="file-selected">
                    <span className="file-icon">📄</span>
                    <span className="file-name">{selectedFile.name}</span>
                    <span className="file-size">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ) : (
                  <div className="file-placeholder">
                    <span className="upload-icon">☁️</span>
                    <span>Click to select a file</span>
                    <span className="file-types">PDF, Word, Excel, Text</span>
                  </div>
                )}
              </label>
              
              {selectedFile && (
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="upload-button"
                >
                  {uploading ? 'Processing...' : 'Upload & Generate Link'}
                </button>
              )}
              
              {error && <div className="error">{error}</div>}
            </div>
          ) : (
            <div className="upload-success">
              <div className="success-icon">✅</div>
              <h2>File Processed Successfully!</h2>
              
              <div className="result-box">
                <div className="result-item">
                  <label>📎 Shareable Link ID</label>
                  <div className="result-value">
                    <code>{uploadResult.link_id}</code>
                    <button 
                      onClick={() => copyToClipboard(uploadResult.link_id)}
                      className="copy-btn"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                
                <div className="result-item">
                  <label>📊 File Details</label>
                  <div className="file-details">
                    <p><strong>Filename:</strong> {uploadResult.filename}</p>
                    <p><strong>Type:</strong> {uploadResult.file_type}</p>
                    <p><strong>Chunks:</strong> {uploadResult.chunks_created}</p>
                  </div>
                </div>
              </div>
              
              <div className="action-buttons-row">
                <button 
                  className="primary-btn"
                  onClick={() => {
                    setLinkId(uploadResult.link_id);
                    setMode('chat');
                  }}
                >
                  💬 Chat with this document
                </button>
                
                <button 
                  className="secondary-btn"
                  onClick={() => {
                    setUploadResult(null);
                    setSelectedFile(null);
                  }}
                >
                  📤 Upload another file
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  
  // Chat Mode
  if (mode === 'chat') {
    // If no linkId entered yet, show input
    if (!docInfo) {
      return (
        <div className="app-container">
          <div className="chat-setup-screen">
            <button className="back-btn" onClick={() => setMode('landing')}>
              ← Back
            </button>
            
            <h1>💬 Chat with Document</h1>
            <p>Enter the link ID of the document you want to chat with</p>
            
            <div className="link-input-area">
              <input
                type="text"
                value={linkId}
                onChange={(e) => setLinkId(e.target.value)}
                placeholder="Enter link ID (e.g., abc12345)"
                className="link-input"
                onKeyPress={(e) => e.key === 'Enter' && startChat()}
              />
              <button onClick={startChat} className="start-chat-btn">
                Start Chatting →
              </button>
            </div>
            
            {error && <div className="error">{error}</div>}
          </div>
        </div>
      );
    }
    
    // Chat interface
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <button className="back-btn-header" onClick={() => {
              setMode('landing');
              setDocInfo(null);
              setMessages([]);
              setLinkId('');
            }}>
              ←
            </button>
            <div>
              <h1>🔺 Pythagorean</h1>
              <p className="doc-name">{docInfo.filename}</p>
            </div>
          </div>
        </header>
        
        <div className="chat-container">
          <div className="messages-container">
            {messages.map((msg, idx) => (
              <div key={idx} className={`message ${msg.role}`}>
                <div className="message-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                  
                  {msg.sources && msg.sources.length > 0 && (
                    <details className="sources">
                      <summary>📚 View sources</summary>
                      <div className="sources-content">
                        {msg.sources.map((source, i) => (
                          <div key={i} className="source-item">
                            <strong>Source {i + 1}:</strong>
                            <p>{source}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message assistant">
                <div className="message-content typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            
            {error && <div className="error-message">{error}</div>}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendMessage} className="input-container">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask a question about this document..."
              disabled={isLoading}
              className="message-input"
            />
            <button 
              type="submit" 
              disabled={isLoading || !inputMessage.trim()} 
              className="send-button"
            >
              {isLoading ? '...' : '→'}
            </button>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
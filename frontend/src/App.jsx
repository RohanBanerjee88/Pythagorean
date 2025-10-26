import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './App.css';
import logo from './pythalogo.png';
import sendImg from './sendingpyth.png';
import receiveImg from './receivingpyth.png';
import searchingimg from './pythsearching.png';

const API_BASE = 'http://localhost:8000';

const REACTIONS = ['👍', '👎', '💡', '❓', '🔥'];

function App() {
  const [view, setView] = useState('home');
  
  // Sender state
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);

  // View activity state
  const [viewActivityLinkId, setViewActivityLinkId] = useState('');
  const [documentActivity, setDocumentActivity] = useState(null);
  
  // Receiver state
  const [linkId, setLinkId] = useState('');
  const [docInfo, setDocInfo] = useState(null);
  const [isCollection, setIsCollection] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(null);
  
  // Collaboration state
  const [messageReactions, setMessageReactions] = useState({});
  const [messageComments, setMessageComments] = useState({});
  const [activeCommentBox, setActiveCommentBox] = useState(null);
  const [commentInput, setCommentInput] = useState('');
  const [userName, setUserName] = useState('Anonymous');
  
  const messagesEndRef = useRef(null);
  
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // ==================== SENDER FUNCTIONS ====================
  
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files]);
      setError('');
    }
  };
  
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };
  
  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    setUploading(true);
    setError('');
    setUploadProgress([]);
    
    try {
      let collectionId = null;
      const uploadedDocs = [];
      
      if (selectedFiles.length > 1) {
        const collectionResponse = await axios.post(`${API_BASE}/collection/create`);
        collectionId = collectionResponse.data.collection_id;
        setUploadProgress(prev => [...prev, '✓ Collection created']);
      }
      
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(prev => [...prev, `↑ ${file.name}...`]);
        
        const formData = new FormData();
        formData.append('file', file);
        
        const url = collectionId 
          ? `${API_BASE}/upload?collection_id=${collectionId}`
          : `${API_BASE}/upload`;
        
        const response = await axios.post(url, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        
        uploadedDocs.push(response.data);
        setUploadProgress(prev => [...prev, `✓ ${file.name}`]);
      }
      
      setUploadResult({
        link_id: collectionId || uploadedDocs[0].link_id,
        documents: uploadedDocs,
        is_collection: selectedFiles.length > 1
      });
      
      setUploading(false);
      
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
      setUploading(false);
    }
  };
  
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setError('✓ Copied to clipboard');
    setTimeout(() => setError(''), 2000);
  };
  
  const resetSender = () => {
    setSelectedFiles([]);
    setUploadProgress([]);
    setUploadResult(null);
    setView('home');
  };
  
  // ==================== RECEIVER FUNCTIONS ====================
  
  const fetchDocumentInfo = async () => {
    if (!linkId.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      try {
        const response = await axios.get(`${API_BASE}/collection/${linkId}`);
        setDocInfo(response.data);
        setIsCollection(true);
        
        const fileNames = response.data.documents.map(d => d.filename).join(', ');
        setMessages([{
          role: 'assistant',
          content: `Connected to **${response.data.document_count} documents**: ${fileNames}\n\nWhat would you like to know?`
        }]);
        setView('chat');
      } catch {
        const response = await axios.get(`${API_BASE}/document/${linkId}`);
        setDocInfo(response.data);
        setIsCollection(false);
        
        setMessages([{
          role: 'assistant',
          content: `Connected to **${response.data.filename}**\n\nWhat would you like to know?`
        }]);
        setView('chat');
      }
    } catch (error) {
      setError('Document not found. Check your link ID.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const resetReceiver = () => {
    setLinkId('');
    setDocInfo(null);
    setMessages([]);
    setIsCollection(false);
    setConversationId(null);
    setMessageReactions({});
    setMessageComments({});
    setView('home');
  };

  // ==================== VIEW ACTIVITY FUNCTION ====================

  const loadDocumentActivity = async () => {
    if (!viewActivityLinkId.trim()) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const response = await axios.get(`${API_BASE}/document/${viewActivityLinkId}/activity`);
      setDocumentActivity(response.data);
      
      // Also load the document info
      try {
        const docResponse = await axios.get(`${API_BASE}/document/${viewActivityLinkId}`);
        setDocInfo(docResponse.data);
        setIsCollection(false);
      } catch {
        const collResponse = await axios.get(`${API_BASE}/collection/${viewActivityLinkId}`);
        setDocInfo(collResponse.data);
        setIsCollection(true);
      }
      
      setView('view-activity');
    } catch (error) {
      setError('Document not found or no activity yet. Check your link ID.');
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==================== CHAT FUNCTIONS ====================
  
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
        conversation_history: newMessages.slice(-10),
        conversation_id: conversationId
      });
      
      // Store conversation ID
      if (response.data.conversation_id) {
        setConversationId(response.data.conversation_id);
      }
      
      setMessages([...newMessages, {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources
      }]);
      
    } catch (error) {
      setError(error.response?.data?.detail || error.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  // ==================== COLLABORATION FUNCTIONS ====================
  
  const addReaction = async (messageIndex, reaction) => {
    if (!conversationId) return;
    
    try {
      const response = await axios.post(`${API_BASE}/reaction/add`, {
        conversation_id: conversationId,
        message_index: messageIndex,
        reaction: reaction
      });
      
      setMessageReactions(prev => ({
        ...prev,
        [messageIndex]: response.data.reactions
      }));
      
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };
  
  const fetchReactions = async (messageIndex) => {
    if (!conversationId) return;
    
    try {
      const response = await axios.get(
        `${API_BASE}/reaction/${conversationId}/${messageIndex}`
      );
      
      setMessageReactions(prev => ({
        ...prev,
        [messageIndex]: response.data.reactions
      }));
      
    } catch (error) {
      console.error('Error fetching reactions:', error);
    }
  };
  
  const addComment = async (messageIndex) => {
    if (!conversationId || !commentInput.trim()) return;
    
    try {
      const response = await axios.post(`${API_BASE}/comment/add`, {
        conversation_id: conversationId,
        message_index: messageIndex,
        comment_text: commentInput.trim(),
        user_name: userName
      });
      
      // Update comments
      setMessageComments(prev => ({
        ...prev,
        [messageIndex]: [
          ...(prev[messageIndex] || []),
          response.data.comment
        ]
      }));
      
      setCommentInput('');
      setActiveCommentBox(null);
      
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };
  
  const fetchComments = async (messageIndex) => {
    if (!conversationId) return;
    
    try {
      const response = await axios.get(
        `${API_BASE}/comment/${conversationId}/${messageIndex}`
      );
      
      setMessageComments(prev => ({
        ...prev,
        [messageIndex]: response.data.comments
      }));
      
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };
  
  const toggleCommentBox = (messageIndex) => {
    if (activeCommentBox === messageIndex) {
      setActiveCommentBox(null);
    } else {
      setActiveCommentBox(messageIndex);
      fetchComments(messageIndex);
    }
  };
  
  const copyConversationLink = () => {
    if (!conversationId) return;
    
    const link = `${window.location.origin}/conversation/${conversationId}`;
    copyToClipboard(link);
  };
  
  // Load reactions and comments when conversation starts
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      messages.forEach((_, idx) => {
        fetchReactions(idx);
        fetchComments(idx);
      });
    }
  }, [conversationId, messages.length]);
  
  // ==================== RENDER ====================
  
  return (
    <div className="app">
      {/* Logo */}
      <div className={`logo-container ${view !== 'home' ? 'minimized' : ''}`}>
        <div className="logo">
          <img className="logo-image" src={logo} alt="pythagoras" />
        </div>
        {view === 'home' && (
          <>
            <h1 className="app-name">Pythagorean</h1>
            <h2 className="tagline">AI memory for everything you share.</h2>
          </>
        )}
      </div>
      
      {/* Home View */}
      {view === 'home' && (
        <div className="cards-container">
          <div className="card" onClick={() => setView('sender')}>
            <div className="card-content">
              <div className="card-text">
                <div className="card-title">SENDER</div>
                <div className="card-description">
                  Upload & send files
                </div>
              </div>
              <div className="card-image">
                <img src={sendImg} alt="Send" />
              </div>
            </div>
          </div>
          
          <div className="card" onClick={() => setView('receiver')}>
            <div className="card-content">
              <div className="card-text">
                <div className="card-title">RECEIVER</div>
                <div className="card-description">
                  Receive doc knowledge, converse with it, visualize it
                </div>
              </div>
              <div className="card-image">
                <img src={receiveImg} alt="Receive" />
              </div>
            </div>
          </div>
          
          {/* View Activity Card - Using receiver image temporarily */}
          <div className="card card-full-width" onClick={() => setView('view-activity-input')}>
            <div className="card-content">
              <div className="card-text">
                <div className="card-title">VIEW ACTIVITY</div>
                <div className="card-description">
                  See all conversations, reactions, and comments on your shared documents
                </div>
              </div>
              <div className="card-image">
                <img src={searchingimg} alt="Activity" />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Sender View */}
      {view === 'sender' && !uploadResult && (
        <div className="content-box">
          <button className="back-btn" onClick={() => setView('home')}>← BACK</button>
          
          <h2 className="section-title">SENDER</h2>
          
          <input
            type="file"
            id="file-input"
            multiple
            onChange={handleFileSelect}
            accept=".pdf,.docx,.doc,.txt,.md,.xlsx,.xls"
            style={{ display: 'none' }}
          />
          
          {selectedFiles.length === 0 ? (
            <label htmlFor="file-input" className="upload-box">
              <div className="upload-icon">+</div>
              <div>SELECT FILES</div>
            </label>
          ) : (
            <div className="files-container">
              {selectedFiles.map((file, i) => (
                <div key={i} className="file-row">
                  <span className="file-name">{file.name}</span>
                  <button onClick={() => removeFile(i)} className="remove-btn">×</button>
                </div>
              ))}
              
              <label htmlFor="file-input" className="add-more-link">+ ADD MORE</label>
              
              <button 
                onClick={handleUpload}
                disabled={uploading}
                className="action-btn"
              >
                {uploading ? 'UPLOADING...' : `UPLOAD ${selectedFiles.length} FILE${selectedFiles.length > 1 ? 'S' : ''}`}
              </button>
            </div>
          )}
          
          {uploadProgress.length > 0 && (
            <div className="progress-box">
              {uploadProgress.map((msg, i) => (
                <div key={i} className="progress-line">{msg}</div>
              ))}
            </div>
          )}
          
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
      
      {/* Sender Result View */}
      {view === 'sender' && uploadResult && (
        <div className="content-box">
          <h2 className="section-title">READY TO SHARE</h2>
          
          <div className="result-item">
            <div className="result-label">LINK ID</div>
            <div className="result-value-box">
              <code>{uploadResult.link_id}</code>
              <button onClick={() => copyToClipboard(uploadResult.link_id)} className="copy-link">
                COPY
              </button>
            </div>
          </div>
          
          <div className="result-item">
            <div className="result-label">DOCUMENTS ({uploadResult.documents.length})</div>
            <div className="docs-list">
              {uploadResult.documents.map((doc, i) => (
                <div key={i} className="doc-row">
                  {doc.filename} — {doc.chunks_created} chunks
                </div>
              ))}
            </div>
          </div>
          
          <button onClick={resetSender} className="action-btn">
            UPLOAD MORE
          </button>
          
          {error && <div className="success-text">{error}</div>}
        </div>
      )}
      
      {/* Receiver View */}
      {view === 'receiver' && (
        <div className="content-box">
          <button className="back-btn" onClick={() => setView('home')}>← BACK</button>
          
          <h2 className="section-title">RECEIVER</h2>
          
          <div className="input-group">
            <input
              type="text"
              value={linkId}
              onChange={(e) => setLinkId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchDocumentInfo()}
              placeholder="ENTER LINK ID"
              className="link-input"
            />
            <button 
              onClick={fetchDocumentInfo}
              disabled={isLoading || !linkId.trim()}
              className="action-btn"
            >
              {isLoading ? 'CONNECTING...' : 'CONNECT'}
            </button>
          </div>
          
          {error && <div className="error-text">{error}</div>}
        </div>
      )}

      {/* View Activity Input */}
      {view === 'view-activity-input' && (
        <div className="content-box">
          <button className="back-btn" onClick={() => setView('home')}>← BACK</button>
          
          <h2 className="section-title">VIEW ACTIVITY</h2>
          <p className="section-description">
            Enter your document link ID to see all conversations, reactions, and comments
          </p>
          
          <div className="input-group">
            <input
              type="text"
              value={viewActivityLinkId}
              onChange={(e) => setViewActivityLinkId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadDocumentActivity()}
              placeholder="ENTER DOCUMENT LINK ID"
              className="link-input"
            />
            <button 
              onClick={loadDocumentActivity}
              disabled={isLoading || !viewActivityLinkId.trim()}
              className="action-btn"
            >
              {isLoading ? 'LOADING...' : 'VIEW ACTIVITY'}
            </button>
          </div>
          
          {error && <div className="error-text">{error}</div>}
        </div>
      )}

      {/* View Activity Display */}
      {view === 'view-activity' && documentActivity && (
        <div className="activity-layout">
          <div className="activity-header">
            <button className="back-btn" onClick={() => {
              setView('home');
              setDocumentActivity(null);
              setViewActivityLinkId('');
            }}>← BACK</button>
            <div className="activity-title">
              <div className="activity-doc-name">
                {isCollection 
                  ? `${docInfo.document_count} Documents`
                  : docInfo.filename
                }
              </div>
              <div className="activity-link-id">ID: {documentActivity.link_id}</div>
            </div>
          </div>
          
          {/* Statistics Bar */}
          <div className="activity-stats">
            <div className="stat-item">
              <div className="stat-value">{documentActivity.total_conversations}</div>
              <div className="stat-label">Conversations</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{documentActivity.total_reactions}</div>
              <div className="stat-label">Reactions</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{documentActivity.total_comments}</div>
              <div className="stat-label">Comments</div>
            </div>
          </div>
          
          {/* All Conversations */}
          <div className="activity-content">
            {documentActivity.conversations.length === 0 ? (
              <div className="no-activity">
                <div className="no-activity-icon">📭</div>
                <div className="no-activity-text">No activity yet</div>
                <div className="no-activity-subtext">
                  Share your link ID and conversations will appear here
                </div>
              </div>
            ) : (
              documentActivity.conversations.map((conversation, convIdx) => (
                <div key={convIdx} className="conversation-card">
                  <div className="conversation-card-header">
                    <div className="conversation-card-title">
                      Conversation {convIdx + 1}
                    </div>
                    <div className="conversation-card-meta">
                      {conversation.message_count} messages • {new Date(conversation.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  
                  <div className="conversation-messages">
                    {conversation.messages.map((msg, msgIdx) => (
                      <div key={msgIdx} className="activity-msg">
                        <div className="activity-msg-role">
                          {msg.role === 'user' ? '👤 USER' : '🤖 AI'}
                        </div>
                        <div className="activity-msg-content">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        
                        {/* Show Reactions */}
                        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                          <div className="activity-reactions">
                            {Object.entries(msg.reactions).map(([reaction, count]) => (
                              <div key={reaction} className="activity-reaction-item">
                                {reaction} {count}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Show Comments */}
                        {msg.comments && msg.comments.length > 0 && (
                          <div className="activity-comments">
                            {msg.comments.map((comment, cIdx) => (
                              <div key={cIdx} className="activity-comment">
                                <span className="activity-comment-author">{comment.user_name}:</span>
                                <span className="activity-comment-text">{comment.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      
      {/* Chat View */}
      {view === 'chat' && (
        <div className="chat-layout">
          <div className="chat-header">
            <button className="back-btn" onClick={resetReceiver}>← DISCONNECT</button>
            <div className="chat-title">
              {isCollection 
                ? `${docInfo.document_count} DOCUMENTS`
                : docInfo.filename.toUpperCase()
              }
            </div>
            {conversationId && (
              <div className="conversation-id-display">
                <span className="conversation-id-label">LINK ID:</span>
                <code className="conversation-id-code">{linkId}</code>
                <button className="share-conversation-btn" onClick={() => copyToClipboard(linkId)}>
                  📋 COPY
                </button>
              </div>
            )}
          </div>
          
          <div className="messages-area">
            {messages.map((msg, idx) => (
              <div key={idx} className={`msg ${msg.role}`}>
                <div className="msg-content">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                
                {/* Reactions & Comments - Only for assistant messages */}
                {msg.role === 'assistant' && idx > 0 && conversationId && (
                  <div className="collaboration-bar">
                    {/* Reactions */}
                    <div className="reactions-container">
                      {REACTIONS.map(reaction => (
                        <button
                          key={reaction}
                          className="reaction-btn"
                          onClick={() => addReaction(idx, reaction)}
                        >
                          {reaction}
                          {messageReactions[idx]?.[reaction] > 0 && (
                            <span className="reaction-count">
                              {messageReactions[idx][reaction]}
                            </span>
                          )}
                        </button>
                      ))}
                      
                      <button 
                        className="comment-toggle-btn"
                        onClick={() => toggleCommentBox(idx)}
                      >
                        💬 {messageComments[idx]?.length || 0}
                      </button>
                    </div>
                    
                    {/* Comment Box */}
                    {activeCommentBox === idx && (
                      <div className="comment-section">
                        <div className="comment-input-box">
                          <input
                            type="text"
                            value={commentInput}
                            onChange={(e) => setCommentInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addComment(idx)}
                            placeholder="Add a comment..."
                            className="comment-input"
                          />
                          <button 
                            onClick={() => addComment(idx)}
                            className="comment-submit-btn"
                          >
                            POST
                          </button>
                        </div>
                        
                        {/* Existing Comments */}
                        <div className="comments-list">
                          {messageComments[idx]?.map((comment, cIdx) => (
                            <div key={cIdx} className="comment-item">
                              <div className="comment-author">{comment.user_name}</div>
                              <div className="comment-text">{comment.text}</div>
                              <div className="comment-time">
                                {new Date(comment.timestamp).toLocaleString()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {msg.sources && msg.sources.length > 0 && (
                  <details className="sources-detail">
                    <summary>SOURCES ({msg.sources.length})</summary>
                    {msg.sources.map((src, i) => (
                      <div key={i} className="source-text">{src}</div>
                    ))}
                  </details>
                )}
              </div>
            ))}
            
            {isLoading && (
              <div className="msg assistant">
                <div className="msg-content typing">
                  <span></span><span></span><span></span>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={sendMessage} className="input-bar">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="ASK A QUESTION..."
              disabled={isLoading}
              className="chat-input"
            />
            <button 
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="send-btn"
            >
              →
            </button>
          </form>
          
          {error && <div className="error-text">{error}</div>}
        </div>
      )}
    </div>
  );
}

export default App;
import React, { useRef } from 'react';
import { api, resetSessionId } from '../services/api';

export function Sidebar({
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  activeMode,
  onChangeMode,
  ragDocuments,
  onUploadRAGDoc,
  onDeleteRAGDoc,
  sessionId,
  onSessionReset,
}) {
  const ragFileInputRef = useRef(null);

  const handleRAGFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await onUploadRAGDoc(file);
    } catch (err) {
      alert('Error uploading RAG document: ' + err.message);
    } finally {
      if (ragFileInputRef.current) ragFileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    if (window.confirm('Resetting your session will start fresh with a new anonymous session. Continue?')) {
      const newId = resetSessionId();
      onSessionReset(newId);
    }
  };

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-badge">
          <div className="brand-icon">✨</div>
          <span>M-Chatbot</span>
        </div>
      </div>

      {/* New Chat Button */}
      <button className="btn-new-chat" onClick={onNewChat} id="btn-new-chat">
        <span>+</span>
        <span>New Conversation</span>
      </button>

      {/* Mode Switcher */}
      <div className="mode-switch-group">
        <button
          className={`mode-tab ${activeMode === 'chat' ? 'active' : ''}`}
          onClick={() => onChangeMode('chat')}
          id="tab-mode-chat"
        >
          💬 Chat
        </button>
        <button
          className={`mode-tab ${activeMode === 'workspace' ? 'active' : ''}`}
          onClick={() => onChangeMode('workspace')}
          id="tab-mode-workspace"
        >
          📝 Workspace
        </button>
      </div>

      {/* Conversation History List */}
      <div className="sidebar-content">
        <div className="section-label">
          <span>Conversations</span>
          <span style={{ fontSize: '0.7rem' }}>({conversations.length})</span>
        </div>

        {conversations.length === 0 ? (
          <div style={{ padding: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            No conversations yet. Start one above!
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${conv.id === activeConvId ? 'active' : ''}`}
              onClick={() => onSelectConversation(conv.id)}
              id={`conv-item-${conv.id}`}
            >
              <span className="conv-title" title={conv.title}>
                {conv.title || 'New Conversation'}
              </span>
              <button
                className="btn-delete-conv"
                title="Delete conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
              >
                ✕
              </button>
            </div>
          ))
        )}

        {/* RAG Knowledge Base Section */}
        <div className="rag-docs-section">
          <div className="section-label" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <span>Knowledge Base (RAG)</span>
            <button
              style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 600 }}
              onClick={() => ragFileInputRef.current?.click()}
              title="Add document to knowledge base"
            >
              + Add Doc
            </button>
          </div>
          <input
            type="file"
            ref={ragFileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt,.md"
            onChange={handleRAGFileChange}
          />

          {ragDocuments.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0.3rem 0' }}>
              No indexed documents. Upload PDF, DOCX, TXT, or MD to chat with your files.
            </div>
          ) : (
            ragDocuments.map((doc) => (
              <div key={doc.id} className="rag-doc-item">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }} title={doc.filename}>
                  📄 {doc.filename}
                </span>
                <button
                  className="btn-delete-rag"
                  title="Remove from knowledge base"
                  onClick={() => onDeleteRAGDoc(doc.id)}
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="sidebar-footer">
        <div className="session-indicator" title={`Session ID: ${sessionId}`}>
          <div className="status-dot"></div>
          <span>Anonymous Session</span>
        </div>
        <button
          onClick={handleReset}
          style={{ color: 'var(--text-muted)', fontSize: '0.72rem', textDecoration: 'underline' }}
          title="Start fresh with a new anonymous session ID"
        >
          Reset
        </button>
      </div>
    </aside>
  );
}

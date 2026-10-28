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
  onOpenLiveVoice,
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
          <span className="brand-title">M-Chatbot</span>
          <span className="brand-tag">PRO</span>
        </div>
      </div>

      {/* Action Buttons Section */}
      <div className="sidebar-actions">
        {/* Live Voice Companion Trigger */}
        <button
          className="btn-live-voice-call"
          onClick={onOpenLiveVoice}
          id="btn-live-voice"
          title="Open Live Talking Assistant (Voice Call)"
        >
          <div className="voice-call-left">
            <span>🎙️</span>
            <span>Live Voice Talk</span>
          </div>
          <span className="live-pill-badge">LIVE</span>
        </button>

        {/* New Chat Button */}
        <button className="btn-new-chat" onClick={onNewChat} id="btn-new-chat">
          <span>✨</span>
          <span>New Conversation</span>
        </button>
      </div>

      {/* Mode Switcher */}
      <div className="mode-switch-group">
        <button
          className={`mode-tab ${activeMode === 'chat' ? 'active' : ''}`}
          onClick={() => onChangeMode('chat')}
          id="tab-mode-chat"
        >
          <span>💬</span> Chat
        </button>
        <button
          className={`mode-tab ${activeMode === 'translator' ? 'active' : ''}`}
          onClick={() => onChangeMode('translator')}
          id="tab-mode-translator"
        >
          <span>🌐</span> Translate
        </button>
        <button
          className={`mode-tab ${activeMode === 'workspace' ? 'active' : ''}`}
          onClick={() => onChangeMode('workspace')}
          id="tab-mode-workspace"
        >
          <span>📝</span> Docs
        </button>
      </div>

      {/* Conversation History List */}
      <div className="sidebar-content">
        <div className="section-label">
          <span>Conversations</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
            {conversations.length}
          </span>
        </div>

        {conversations.length === 0 ? (
          <div style={{ padding: '0.85rem 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            No chats yet. Start asking questions or generating art!
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
              className="btn-upload-doc-pill"
              onClick={() => ragFileInputRef.current?.click()}
              title="Add document to knowledge base"
            >
              + Upload Doc
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
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '0.4rem 0', lineHeight: 1.4 }}>
              Upload PDF, DOCX, TXT, or MD to chat with your knowledge files.
            </div>
          ) : (
            ragDocuments.map((doc) => (
              <div key={doc.id} className="rag-doc-item">
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '175px' }} title={doc.filename}>
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
        <div className="footer-model-badge">
          <div className="model-pill">
            <span className="pulse-dot"></span>
            <span>Gemini 3.1 Flash Lite</span>
          </div>
          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>v2.4</span>
        </div>
        <div className="session-row">
          <span style={{ color: '#64748b' }}>Session: {sessionId.slice(0, 8)}...</span>
          <button
            onClick={handleReset}
            style={{ color: '#38bdf8', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
            title="Start fresh with a new anonymous session ID"
          >
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
}

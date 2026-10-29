import React, { useState, useRef } from 'react';
import { api, resetSessionId } from '../services/api';

export function Sidebar({
  conversations,
  activeConvId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  activeMode,
  onChangeMode,
  ragDocuments,
  onUploadRAGDoc,
  onDeleteRAGDoc,
  sessionId,
  onSessionReset,
  onOpenLiveVoice,
  isOpen,
  onClose,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
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

  const handleStartRename = (e, conv) => {
    e.stopPropagation();
    setEditingConvId(conv.id);
    setEditingTitle(conv.title || '');
  };

  const handleSaveRename = async (e, convId) => {
    e.stopPropagation();
    if (!editingTitle.trim()) {
      setEditingConvId(null);
      return;
    }
    if (onRenameConversation) {
      await onRenameConversation(convId, editingTitle.trim());
    }
    setEditingConvId(null);
  };

  const handleDelete = (e, convId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      onDeleteConversation(convId);
    }
  };

  // Filter conversations by search query
  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <aside className={`sidebar ${isOpen ? 'mobile-open' : ''}`}>
      {/* Brand Header */}
      <div className="sidebar-header">
        <div className="brand-badge">
          <div className="brand-icon">⚡</div>
          <span className="brand-title">M-Chatbot</span>
          <span className="brand-tag">AI 2.0</span>
        </div>
        {isOpen && (
          <button
            className="btn-mobile-close"
            onClick={onClose}
            title="Close sidebar"
            style={{ color: 'var(--text-muted)', fontSize: '1.2rem', padding: '4px 8px' }}
          >
            ✕
          </button>
        )}
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
          onClick={() => {
            onChangeMode('chat');
            if (isOpen && onClose) onClose();
          }}
          id="tab-mode-chat"
        >
          <span>💬</span> Chat
        </button>
        <button
          className={`mode-tab ${activeMode === 'translator' ? 'active' : ''}`}
          onClick={() => {
            onChangeMode('translator');
            if (isOpen && onClose) onClose();
          }}
          id="tab-mode-translator"
        >
          <span>🌐</span> Translate
        </button>
        <button
          className={`mode-tab ${activeMode === 'workspace' ? 'active' : ''}`}
          onClick={() => {
            onChangeMode('workspace');
            if (isOpen && onClose) onClose();
          }}
          id="tab-mode-workspace"
        >
          <span>📝</span> Docs
        </button>
      </div>

      {/* Conversation Search Bar */}
      <div style={{ padding: '0 0.85rem', marginBottom: '0.5rem' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          background: 'var(--bg-input)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '0.3rem 0.6rem',
        }}>
          <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>🔍</span>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '0.78rem',
              width: '100%',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversation History List */}
      <div className="sidebar-content">
        <div className="section-label">
          <span>Conversations</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', fontWeight: 800 }}>
            {filteredConversations.length}
          </span>
        </div>

        {filteredConversations.length === 0 ? (
          <div style={{ padding: '0.85rem 0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            {searchQuery ? 'No matching conversations' : 'No chats yet. Start asking questions or generating media!'}
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const isEditing = editingConvId === conv.id;
            return (
              <div
                key={conv.id}
                className={`conversation-item ${conv.id === activeConvId ? 'active' : ''}`}
                onClick={() => {
                  onSelectConversation(conv.id);
                  if (isOpen && onClose) onClose();
                }}
                id={`conv-item-${conv.id}`}
              >
                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '100%' }} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRename(e, conv.id);
                        if (e.key === 'Escape') setEditingConvId(null);
                      }}
                      autoFocus
                      style={{
                        flex: 1,
                        background: 'var(--bg-input)',
                        border: '1px solid var(--accent-primary)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.78rem',
                        color: 'var(--text-main)',
                      }}
                    />
                    <button
                      onClick={(e) => handleSaveRename(e, conv.id)}
                      style={{ color: '#34d399', fontSize: '0.8rem', padding: '2px 4px' }}
                      title="Save title"
                    >
                      ✓
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingConvId(null);
                      }}
                      style={{ color: '#f87171', fontSize: '0.8rem', padding: '2px 4px' }}
                      title="Cancel"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="conv-title" title={conv.title}>
                      {conv.title || 'New Conversation'}
                    </span>
                    <div className="conv-item-actions" style={{ display: 'flex', gap: '2px' }}>
                      <button
                        className="btn-edit-conv"
                        title="Rename conversation"
                        onClick={(e) => handleStartRename(e, conv)}
                        style={{ opacity: 0.6, fontSize: '0.75rem', padding: '2px 4px' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-delete-conv"
                        title="Delete conversation"
                        onClick={(e) => handleDelete(e, conv.id)}
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
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
            accept=".pdf,.docx,.txt,.md,.csv,.xlsx"
            onChange={handleRAGFileChange}
          />

          {ragDocuments.length === 0 ? (
            <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', padding: '0.4rem 0', lineHeight: 1.4 }}>
              Upload PDF, DOCX, TXT, CSV, or XLSX to chat with your knowledge files.
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
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Universal</span>
        </div>
        <div className="session-row">
          <span style={{ color: 'var(--text-muted)', fontSize: '0.74rem' }}>ID: {sessionId.slice(0, 8)}...</span>
          <button
            onClick={handleReset}
            style={{ color: 'var(--accent-cyan)', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' }}
            title="Start fresh with a new anonymous session ID"
          >
            Reset
          </button>
        </div>
      </div>
    </aside>
  );
}

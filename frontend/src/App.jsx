import React, { useState, useEffect } from 'react';
import { api, getOrCreateSessionId } from './services/api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Composer } from './components/Composer';
import { DocumentWorkspace } from './components/DocumentWorkspace';

import './styles/index.css';
import './styles/App.css';
import './styles/Chat.css';
import './styles/Composer.css';
import './styles/Workspace.css';

export default function App() {
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'workspace'
  const [sessionId, setSessionId] = useState(getOrCreateSessionId());
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ragDocuments, setRagDocuments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);

  // Load initial conversations, RAG documents, and health
  useEffect(() => {
    fetchInitialData();
  }, [sessionId]);

  const fetchInitialData = async () => {
    try {
      const health = await api.checkHealth();
      setHealthStatus(health);
    } catch {
      setHealthStatus({ status: 'offline' });
    }

    try {
      const convs = await api.listConversations();
      setConversations(convs);
      if (convs.length > 0) {
        selectConversation(convs[0].id);
      } else {
        setActiveConvId(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }

    try {
      const docs = await api.listRAGDocuments();
      setRagDocuments(docs);
    } catch (err) {
      console.error('Failed to load RAG documents:', err);
    }
  };

  // Select a conversation and load its messages
  const selectConversation = async (convId) => {
    setActiveConvId(convId);
    try {
      const fullConv = await api.getConversation(convId);
      setMessages(fullConv.messages || []);
    } catch (err) {
      console.error('Failed to load conversation details:', err);
    }
  };

  // Start new conversation
  const handleNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setActiveMode('chat');
  };

  // Delete conversation
  const handleDeleteConversation = async (id) => {
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConvId === id) {
        handleNewChat();
      }
    } catch (err) {
      alert('Failed to delete conversation: ' + err.message);
    }
  };

  // Send message
  const handleSendMessage = async (payload) => {
    setIsGenerating(true);

    // Optimistically show user message
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: payload.message,
      attachments: payload.attachments,
      sources: [],
      rag_citations: [],
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const chatResponse = await api.sendMessage({
        conversation_id: activeConvId,
        ...payload,
      });

      // Update active conversation ID
      if (!activeConvId) {
        setActiveConvId(chatResponse.conversation_id);
        setConversations((prev) => [
          {
            id: chatResponse.conversation_id,
            title: payload.message.slice(0, 30) + '...',
            message_count: 2,
            updated_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      }

      // Replace optimistic message and append assistant message
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempUserMsg.id),
        chatResponse.user_message,
        chatResponse.assistant_message,
      ]);
    } catch (err) {
      alert('Error sending message: ' + err.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
    } finally {
      setIsGenerating(false);
    }
  };

  // RAG document operations
  const handleUploadRAGDoc = async (file) => {
    const uploaded = await api.uploadRAGDocument(file);
    setRagDocuments((prev) => [uploaded, ...prev]);
  };

  const handleDeleteRAGDoc = async (id) => {
    try {
      await api.deleteRAGDocument(id);
      setRagDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert('Failed to delete document: ' + err.message);
    }
  };

  return (
    <div className="app-container">
      {/* Left Sidebar */}
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelectConversation={selectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        activeMode={activeMode}
        onChangeMode={setActiveMode}
        ragDocuments={ragDocuments}
        onUploadRAGDoc={handleUploadRAGDoc}
        onDeleteRAGDoc={handleDeleteRAGDoc}
        sessionId={sessionId}
        onSessionReset={(newId) => setSessionId(newId)}
      />

      {/* Main App Content */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-title">
            <span>{activeMode === 'chat' ? '💬 Assistant Chat' : '📝 Document Workspace'}</span>
          </div>

          <div className="health-badge">
            <span className="status-dot"></span>
            <span>API: {healthStatus?.status === 'ok' ? 'Online' : 'Connecting...'}</span>
          </div>
        </header>

        {/* View Mode Switching */}
        {activeMode === 'chat' ? (
          <>
            <ChatArea
              messages={messages}
              isGenerating={isGenerating}
              onSendPromptStarter={(promptText) =>
                handleSendMessage({
                  message: promptText,
                  attachments: [],
                  enable_web_search: false,
                  enable_rag: true,
                })
              }
            />
            <Composer
              onSendMessage={handleSendMessage}
              isGenerating={isGenerating}
            />
          </>
        ) : (
          <DocumentWorkspace />
        )}
      </main>
    </div>
  );
}

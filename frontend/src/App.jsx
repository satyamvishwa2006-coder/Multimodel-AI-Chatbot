import React, { useState, useEffect } from 'react';
import { api, getOrCreateSessionId } from './services/api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Composer } from './components/Composer';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { TranslatorView } from './components/TranslatorView';
import { LiveVoiceModal } from './components/LiveVoiceModal';

import './styles/index.css';
import './styles/App.css';
import './styles/Chat.css';
import './styles/Composer.css';
import './styles/Workspace.css';

export default function App() {
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'workspace' | 'translator'
  const [sessionId, setSessionId] = useState(getOrCreateSessionId());
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [ragDocuments, setRagDocuments] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null);
  const [isLiveVoiceOpen, setIsLiveVoiceOpen] = useState(false);
  const [appLanguage, setAppLanguage] = useState('hi-IN');

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
      {/* Dynamic Ambient Aurora Background */}
      <div className="aurora-backdrop">
        <div className="aurora-orb aurora-orb-1"></div>
        <div className="aurora-orb aurora-orb-2"></div>
        <div className="aurora-orb aurora-orb-3"></div>
      </div>

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
        onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
      />

      {/* Main App Content */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-title">
            <span className="title-pill">
              {activeMode === 'chat' && '✨ Multimodal Assistant'}
              {activeMode === 'translator' && '🌐 Universal Translator'}
              {activeMode === 'workspace' && '📝 Document Workspace'}
            </span>
          </div>

          <div className="top-bar-right">
            {/* Live Talking Assistant Button in Header */}
            <button
              onClick={() => setIsLiveVoiceOpen(true)}
              className="btn-header-voice"
              title="Open Live Talking Assistant (Voice Call)"
            >
              <span>🎙️</span>
              <span>Live Talk</span>
              <span className="live-pill-badge" style={{ marginLeft: '4px' }}>AI</span>
            </button>

            {/* Language Selector */}
            <select
              className="header-lang-select"
              value={appLanguage}
              onChange={(e) => setAppLanguage(e.target.value)}
              title="Select Assistant & Voice Language"
            >
              <option value="hi-IN">🇮🇳 हिन्दी (Hindi)</option>
              <option value="en-US">🇺🇸 English (US)</option>
              <option value="en-IN">🇮🇳 Hinglish</option>
              <option value="es-ES">🇪🇸 Español</option>
              <option value="fr-FR">🇫🇷 Français</option>
              <option value="de-DE">🇩🇪 Deutsch</option>
              <option value="ja-JP">🇯🇵 日本語</option>
              <option value="ar-SA">🇸🇦 العربية</option>
            </select>

            <div className="health-badge">
              <span className="status-dot"></span>
              <span>API: {healthStatus?.status === 'ok' ? 'Online' : 'Connecting...'}</span>
            </div>
          </div>
        </header>

        {/* View Mode Switching */}
        {activeMode === 'chat' && (
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
        )}

        {activeMode === 'translator' && <TranslatorView />}

        {activeMode === 'workspace' && <DocumentWorkspace />}
      </main>

      {/* Live Talking Assistant Modal */}
      <LiveVoiceModal
        isOpen={isLiveVoiceOpen}
        onClose={() => setIsLiveVoiceOpen(false)}
        selectedLanguage={appLanguage}
        onLanguageChange={setAppLanguage}
      />
    </div>
  );
}

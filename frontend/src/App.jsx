import React, { useState, useEffect, useRef } from 'react';
import { api, getOrCreateSessionId } from './services/api';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Composer } from './components/Composer';
import { DocumentWorkspace } from './components/DocumentWorkspace';
import { TranslatorView } from './components/TranslatorView';
import { LiveVoiceModal } from './components/LiveVoiceModal';
import { SettingsModal } from './components/SettingsModal';

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appLanguage, setAppLanguage] = useState('hi-IN');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Theme state: dark or light
  const [theme, setTheme] = useState(() => localStorage.getItem('mchatbot_theme') || 'dark');

  const abortControllerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mchatbot_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

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

  // Rename conversation
  const handleRenameConversation = async (id, newTitle) => {
    try {
      const updated = await api.renameConversation(id, newTitle);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: updated.title } : c))
      );
    } catch (err) {
      alert('Failed to rename conversation: ' + err.message);
    }
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

  // Stop response generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  // Send message with streaming support
  const handleSendMessage = async (payload) => {
    setIsGenerating(true);
    const abortCtrl = new AbortController();
    abortControllerRef.current = abortCtrl;

    // Optimistically show user message
    const tempUserMsg = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: payload.message,
      attachments: payload.attachments || [],
      sources: [],
      rag_citations: [],
      created_at: new Date().toISOString(),
    };

    // Temporary placeholder for assistant streaming message
    const tempAssistantMsg = {
      id: 'temp-asst-' + Date.now(),
      role: 'assistant',
      content: '',
      attachments: [],
      sources: [],
      rag_citations: [],
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg]);

    let accumulatedContent = '';

    await api.streamChatMessage(
      {
        conversation_id: activeConvId,
        ...payload,
      },
      {
        signal: abortCtrl.signal,
        onToken: (token) => {
          accumulatedContent += token;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === tempAssistantMsg.id
                ? { ...m, content: accumulatedContent }
                : m
            )
          );
        },
        onDone: (data) => {
          if (!activeConvId && data.conversation_id) {
            setActiveConvId(data.conversation_id);
            setConversations((prev) => [
              {
                id: data.conversation_id,
                title: payload.message.slice(0, 32) + (payload.message.length > 32 ? '...' : ''),
                message_count: 2,
                updated_at: new Date().toISOString(),
              },
              ...prev,
            ]);
          }

          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === tempAssistantMsg.id) {
                return {
                  ...m,
                  id: data.assistant_message?.id || m.id,
                  content: data.assistant_message?.content || accumulatedContent,
                  attachments: data.assistant_message?.attachments || [],
                  sources: data.sources || [],
                  rag_citations: data.rag_citations || [],
                  audio_url: data.assistant_message?.audio_url || null,
                };
              }
              return m;
            })
          );
          setIsGenerating(false);
          abortControllerRef.current = null;
        },
        onError: (err) => {
          console.error('Streaming error, falling back:', err);
          // If streaming failed early, do fallback to standard sendMessage
          api.sendMessage({
            conversation_id: activeConvId,
            ...payload,
          })
            .then((chatResponse) => {
              if (!activeConvId) {
                setActiveConvId(chatResponse.conversation_id);
                setConversations((prev) => [
                  {
                    id: chatResponse.conversation_id,
                    title: payload.message.slice(0, 32) + '...',
                    message_count: 2,
                    updated_at: new Date().toISOString(),
                  },
                  ...prev,
                ]);
              }
              setMessages((prev) => [
                ...prev.filter((m) => m.id !== tempUserMsg.id && m.id !== tempAssistantMsg.id),
                chatResponse.user_message,
                chatResponse.assistant_message,
              ]);
            })
            .catch((fallbackErr) => {
              alert('Error: ' + fallbackErr.message);
              setMessages((prev) =>
                prev.filter((m) => m.id !== tempUserMsg.id && m.id !== tempAssistantMsg.id)
              );
            })
            .finally(() => {
              setIsGenerating(false);
              abortControllerRef.current = null;
            });
        },
      }
    );
  };

  // Regenerate message
  const handleRegenerateMessage = async () => {
    if (!activeConvId) return;
    setIsGenerating(true);
    try {
      const regenerated = await api.regenerateMessage({
        conversation_id: activeConvId,
        enable_rag: true,
      });
      setMessages((prev) => {
        const withoutLastAsst = [...prev];
        if (withoutLastAsst.length > 0 && withoutLastAsst[withoutLastAsst.length - 1].role === 'assistant') {
          withoutLastAsst.pop();
        }
        return [...withoutLastAsst, regenerated.assistant_message];
      });
    } catch (err) {
      alert('Regeneration failed: ' + err.message);
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
        onRenameConversation={handleRenameConversation}
        activeMode={activeMode}
        onChangeMode={setActiveMode}
        ragDocuments={ragDocuments}
        onUploadRAGDoc={handleUploadRAGDoc}
        onDeleteRAGDoc={handleDeleteRAGDoc}
        sessionId={sessionId}
        onSessionReset={(newId) => setSessionId(newId)}
        onOpenLiveVoice={() => setIsLiveVoiceOpen(true)}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main App Content */}
      <main className="main-content">
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Hamburger toggle button on mobile */}
            <button
              className="btn-hamburger"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title="Toggle navigation sidebar"
            >
              ☰
            </button>
            <span className="title-pill">
              {activeMode === 'chat' && '⚡ Multimodal AI Studio'}
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

            {/* Theme Toggle (Dark / Light) */}
            <button
              onClick={toggleTheme}
              className="btn-theme-toggle"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              <span style={{ fontSize: '0.78rem' }}>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {/* Personalization Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="btn-settings-toggle"
              title="Personalization and Memory Settings"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span>⚙️</span>
              <span style={{ fontSize: '0.78rem' }}>Settings</span>
            </button>

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
              onRegenerate={handleRegenerateMessage}
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
              onStopGeneration={handleStopGeneration}
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

      {/* Personalization & Memory Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}

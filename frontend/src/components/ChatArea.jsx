import React, { useEffect, useRef, useState } from 'react';
import { MessageItem } from './MessageItem';

export function ChatArea({ messages, isGenerating, onSendPromptStarter }) {
  const messagesEndRef = useRef(null);
  const [activeCategory, setActiveCategory] = useState('all');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const promptStarters = [
    {
      category: 'image',
      badge: 'Creative AI',
      title: '🎨 AI Image Studio',
      desc: 'Generate original photorealistic art, scenery, or cinematic graphics from your vision',
      prompt: 'Generate an image of a majestic snow-capped mountain reflecting in a crystal lake at sunrise.',
    },
    {
      category: 'hindi',
      badge: 'Multilingual',
      title: '🇮🇳 हिन्दी वार्तालाप (Hindi)',
      desc: 'सहज, धाराप्रवाह हिंदी या हिंग्लिश में बातचीत करें और जटिल विषयों को समझें',
      prompt: 'नमस्ते! मुझे ब्रह्मांड के रहस्यों और ब्लैक होल के बारे में सरल हिंदी में समझाइए।',
    },
    {
      category: 'vision',
      badge: 'Multimodal',
      title: '👁️ Vision & Image Analysis',
      desc: 'Attach photos, screenshots, or diagrams to explain or analyze them',
      prompt: 'Please inspect the attached image in detail and explain what it depicts.',
    },
    {
      category: 'rag',
      badge: 'Doc Q&A',
      title: '📄 Analyze Documents (RAG)',
      desc: 'Upload a PDF or DOCX and ask for key takeaways or deep QA',
      prompt: 'Can you summarize the main findings from the document I upload?',
    },
    {
      category: 'web',
      badge: 'Real-time',
      title: '🌐 Live Web Deep Search',
      desc: 'Query recent news or global facts with live verified citations',
      prompt: 'Search the web for the latest advancements in artificial intelligence.',
    },
    {
      category: 'support',
      badge: 'Companion',
      title: '🌱 Thoughtful Space',
      desc: 'A calm, compassionate space to unpack ideas or a stressful day',
      prompt: "I've been feeling overwhelmed with deadlines lately. Can you help me sort out my thoughts?",
    },
  ];

  const filteredStarters =
    activeCategory === 'all'
      ? promptStarters
      : promptStarters.filter((s) => s.category === activeCategory);

  return (
    <div className="chat-container">
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            {/* 3D Holographic AI Sphere */}
            <div className="welcome-orb-badge">
              <span>✨</span>
            </div>

            <h1 className="welcome-title">What would you like to explore?</h1>
            <p className="welcome-subtitle">
              Your next-generation multimodal AI companion. Converses in Hindi and all world languages,
              creates original art, analyzes documents, and searches the live web.
            </p>

            {/* Quick Category Chips */}
            <div className="starter-filter-bar">
              <button
                className={`starter-filter-pill ${activeCategory === 'all' ? 'active' : ''}`}
                onClick={() => setActiveCategory('all')}
              >
                ✨ All Modes
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'image' ? 'active' : ''}`}
                onClick={() => setActiveCategory('image')}
              >
                🎨 Image Studio
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'hindi' ? 'active' : ''}`}
                onClick={() => setActiveCategory('hindi')}
              >
                🇮🇳 Hindi / Universal
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'rag' ? 'active' : ''}`}
                onClick={() => setActiveCategory('rag')}
              >
                📄 Doc RAG
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'web' ? 'active' : ''}`}
                onClick={() => setActiveCategory('web')}
              >
                🌐 Web Search
              </button>
            </div>

            {/* Prompt Cards Grid */}
            <div className="starter-grid">
              {filteredStarters.map((starter, idx) => (
                <div
                  key={idx}
                  className="starter-card"
                  onClick={() => onSendPromptStarter(starter.prompt)}
                >
                  <div className="starter-header-row">
                    <div className="starter-title">{starter.title}</div>
                    <span className="starter-badge">{starter.badge}</span>
                  </div>
                  <div className="starter-desc">{starter.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}

        {/* Synaptic Neural Thinking Indicator */}
        {isGenerating && (
          <div className="message-row assistant">
            <div className="assistant-avatar">⚡</div>
            <div className="thinking-bubble">
              <div className="neural-dots">
                <span className="neural-dot"></span>
                <span className="neural-dot"></span>
                <span className="neural-dot"></span>
              </div>
              <span className="thinking-text">Synthesizing multimodal response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

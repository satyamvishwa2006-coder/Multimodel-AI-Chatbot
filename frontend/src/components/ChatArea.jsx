import React, { useEffect, useRef, useState } from 'react';
import { MessageItem } from './MessageItem';

export function ChatArea({ messages, isGenerating, onSendPromptStarter, onRegenerate }) {
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
      category: 'video',
      badge: 'Video AI',
      title: '🎥 AI Video Studio',
      desc: 'Create animated cinematic scenes, physics simulations, or nature vistas',
      prompt: 'Generate a video of a golden sunset over a calm ocean with moving waves.',
    },
    {
      category: 'code',
      badge: 'Coding Pro',
      title: '💻 AI Coding Assistant',
      desc: 'Generate clean Python, JavaScript, or React code, debug errors, and refactor',
      prompt: 'Write a fast Python function to find the longest palindromic substring with tests.',
    },
    {
      category: 'image',
      badge: 'Creative AI',
      title: '🎨 AI Image Studio',
      desc: 'Generate original photorealistic art, scenery, or cinematic graphics from your vision',
      prompt: 'Generate an image of a futuristic neon cyber city with flying vehicles in rain.',
    },
    {
      category: 'hindi',
      badge: 'Multilingual',
      title: '🇮🇳 हिन्दी वार्तालाप (Hindi)',
      desc: 'सहज, धाराप्रवाह हिंदी या हिंग्लिश में बातचीत करें और जटिल विषयों को समझें',
      prompt: 'नमस्ते! मुझे ब्रह्मांड के रहस्यों और ब्लैक होल के बारे में सरल हिंदी में समझाइए।',
    },
    {
      category: 'rag',
      badge: 'Doc Q&A',
      title: '📄 Analyze Documents & Data',
      desc: 'Upload a PDF, DOCX, CSV, or XLSX and ask for key takeaways or formulas',
      prompt: 'Can you summarize the main findings from the document I upload?',
    },
    {
      category: 'web',
      badge: 'Real-time',
      title: '🌐 Live Web Deep Search',
      desc: 'Query recent news or global facts with live verified citations',
      prompt: 'Search the web for the latest advancements in artificial intelligence.',
    },
  ];

  const filteredStarters =
    activeCategory === 'all'
      ? promptStarters
      : promptStarters.filter((s) => s.category === activeCategory);

  // Find index of the latest assistant message
  const lastAssistantIndex = messages.map((m) => m.role).lastIndexOf('assistant');

  return (
    <div className="chat-container">
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            {/* 3D Holographic AI Sphere */}
            <div className="welcome-orb-badge">
              <span>⚡</span>
            </div>

            <h1 className="welcome-title">What would you like to create today?</h1>
            <p className="welcome-subtitle">
              Your next-generation multimodal AI companion. Converses in Hindi & all world languages,
              generates images & videos, assists with code, analyzes documents, and searches the live web.
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
                className={`starter-filter-pill ${activeCategory === 'video' ? 'active' : ''}`}
                onClick={() => setActiveCategory('video')}
              >
                🎥 Video
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'code' ? 'active' : ''}`}
                onClick={() => setActiveCategory('code')}
              >
                💻 Code
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'image' ? 'active' : ''}`}
                onClick={() => setActiveCategory('image')}
              >
                🎨 Image
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'hindi' ? 'active' : ''}`}
                onClick={() => setActiveCategory('hindi')}
              >
                🇮🇳 Hindi
              </button>
              <button
                className={`starter-filter-pill ${activeCategory === 'web' ? 'active' : ''}`}
                onClick={() => setActiveCategory('web')}
              >
                🌐 Web
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
          messages.map((msg, index) => (
            <MessageItem
              key={msg.id || index}
              message={msg}
              onRegenerate={onRegenerate}
              isLatestAssistant={index === lastAssistantIndex}
            />
          ))
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
              <span className="thinking-text">Synthesizing multimodal streaming response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

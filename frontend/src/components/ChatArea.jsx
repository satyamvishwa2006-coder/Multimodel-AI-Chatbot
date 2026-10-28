import React, { useEffect, useRef } from 'react';
import { MessageItem } from './MessageItem';

export function ChatArea({ messages, isGenerating, onSendPromptStarter }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  const promptStarters = [
    {
      title: 'Analyze Document',
      desc: 'Upload a PDF or DOCX and ask for key takeaways',
      prompt: 'Can you summarize the main findings from the document I upload?',
    },
    {
      title: 'Live Web Search',
      desc: 'Query recent news or facts with live verified citations',
      prompt: 'Search the web for the latest advancements in artificial intelligence.',
    },
    {
      title: 'Emotional Support',
      desc: 'A calm, compassionate space to unpack a stressful day',
      prompt: "I've been feeling overwhelmed with deadlines lately. Can you help me sort out my thoughts?",
    },
    {
      title: 'Document Workspace',
      desc: 'Create or refine structured reports and export to DOCX',
      prompt: 'Draft an executive briefing on best practices for cloud security.',
    },
  ];

  return (
    <div className="chat-container">
      <div className="message-list">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon">✨</div>
            <h1 className="welcome-title">How can I help you today?</h1>
            <p className="welcome-subtitle">
              Your personal multimodal assistant for grounded document research, live web search,
              document authoring, and thoughtful conversations.
            </p>

            <div className="starter-grid">
              {promptStarters.map((starter, idx) => (
                <div
                  key={idx}
                  className="starter-card"
                  onClick={() => onSendPromptStarter(starter.prompt)}
                >
                  <div className="starter-title">{starter.title}</div>
                  <div className="starter-desc">{starter.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => <MessageItem key={msg.id} message={msg} />)
        )}

        {/* Loading Indicator */}
        {isGenerating && (
          <div className="message-row assistant">
            <div className="message-bubble assistant-bubble" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div className="status-dot" style={{ animation: 'pulse 1s infinite' }}></div>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>Thinking and synthesizing response...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

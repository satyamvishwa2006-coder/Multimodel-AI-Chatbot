import React, { useState } from 'react';

export function MessageItem({ message }) {
  const isUser = message.role === 'user';
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Copy code block content
  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Play audio TTS
  const handlePlayAudio = (url) => {
    if (!url) return;
    const audio = new Audio(url);
    setIsPlayingAudio(true);
    audio.play();
    audio.onended = () => setIsPlayingAudio(false);
    audio.onerror = () => setIsPlayingAudio(false);
  };

  // Basic Markdown-like formatting helper
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Split code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const codeContent = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '');
        return (
          <div key={idx} style={{ position: 'relative', margin: '0.6rem 0' }}>
            <button
              onClick={() => handleCopyCode(codeContent, idx)}
              style={{
                position: 'absolute',
                top: '6px',
                right: '8px',
                fontSize: '0.72rem',
                padding: '2px 6px',
                background: 'rgba(255, 255, 255, 0.1)',
                color: '#e2e8f0',
                borderRadius: '4px',
              }}
            >
              {copiedCodeIndex === idx ? '✓ Copied' : 'Copy'}
            </button>
            <pre>
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

      // Format lines with paragraphs and bold
      return (
        <div key={idx}>
          {part.split('\n\n').map((paragraph, pIdx) => {
            if (!paragraph.trim()) return null;
            return (
              <p
                key={pIdx}
                dangerouslySetInnerHTML={{
                  __html: paragraph
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/`([^`]+)`/g, '<code>$1</code>')
                    .replace(/\n/g, '<br/>')
                }}
              />
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
        {/* Header / Meta */}
        <div className="bubble-meta">
          <span className="bubble-role">{isUser ? 'You' : 'Assistant'}</span>
          <span>•</span>
          <span>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Attachments preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.6rem' }}>
            {message.attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: '0.78rem',
                }}
              >
                {['png', 'jpg', 'jpeg', 'webp'].includes(att.file_type) ? '🖼️' : '📎'}
                <span>{att.filename}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content text */}
        <div className="bubble-content">
          {renderFormattedText(message.content)}
        </div>

        {/* Audio TTS playback button */}
        {message.audio_url && (
          <div className="audio-player-bar">
            <button
              className="btn-play-audio"
              onClick={() => handlePlayAudio(message.audio_url)}
            >
              {isPlayingAudio ? '🔊 Playing Audio...' : '▶ Listen (TTS)'}
            </button>
          </div>
        )}

        {/* Web Search Source Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="citation-group">
            <span className="citation-header">Web Search Sources</span>
            <div className="citation-list">
              {message.sources.map((src, sIdx) => (
                <a
                  key={sIdx}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="source-pill"
                  title={src.snippet}
                >
                  🌐 {src.title || src.url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* RAG Knowledge Document Citations */}
        {message.rag_citations && message.rag_citations.length > 0 && (
          <div className="citation-group">
            <span className="citation-header">Document Citations</span>
            <div className="citation-list">
              {message.rag_citations.map((rag, rIdx) => (
                <div key={rIdx} className="rag-pill" title={rag.snippet}>
                  📄 {rag.document_name} (Chunk #{rag.chunk_index + 1})
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

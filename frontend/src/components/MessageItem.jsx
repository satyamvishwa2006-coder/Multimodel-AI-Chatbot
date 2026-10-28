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

  // Play audio TTS (server audio or native Web Speech API)
  const handlePlayAudio = (url) => {
    if (isPlayingAudio) {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsPlayingAudio(false);
      return;
    }

    if (url) {
      const audio = new Audio(url);
      setIsPlayingAudio(true);
      audio.play().catch(() => {
        speakNative(message.content);
      });
      audio.onended = () => setIsPlayingAudio(false);
      audio.onerror = () => {
        speakNative(message.content);
      };
    } else {
      speakNative(message.content);
    }
  };

  const speakNative = (text) => {
    if (!('speechSynthesis' in window) || !text) {
      setIsPlayingAudio(false);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*_#`[\]()]/g, ' ').slice(0, 1000);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);
    setIsPlayingAudio(true);
    window.speechSynthesis.speak(utterance);
  };

  // Basic Markdown-like formatting helper
  const renderFormattedText = (text) => {
    if (!text) return null;

    // Split code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);

    return parts.map((part, idx) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const firstLine = part.slice(3, -3).split('\n')[0].trim();
        const lang = firstLine || 'code';
        const codeContent = part.slice(3, -3).replace(/^[a-zA-Z0-9_-]+\n/, '');
        return (
          <div key={idx} style={{ position: 'relative', margin: '0.8rem 0' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.35rem 0.8rem',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderBottom: 'none',
                borderRadius: '8px 8px 0 0',
                fontSize: '0.74rem',
                color: '#94a3b8',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>💻 {lang}</span>
              <button
                onClick={() => handleCopyCode(codeContent, idx)}
                style={{
                  fontSize: '0.74rem',
                  padding: '2px 8px',
                  background: copiedCodeIndex === idx ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: copiedCodeIndex === idx ? '#34d399' : '#e2e8f0',
                  borderRadius: '4px',
                  fontWeight: 600,
                  transition: 'all 0.2s',
                }}
              >
                {copiedCodeIndex === idx ? '✓ Copied!' : 'Copy Code'}
              </button>
            </div>
            <pre style={{ margin: 0, borderRadius: '0 0 8px 8px' }}>
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
      {!isUser && (
        <div className="assistant-avatar" title="Multimodal Assistant">
          ⚡
        </div>
      )}
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.8rem' }}>
            {message.attachments.map((att) => {
              const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes((att.file_type || '').toLowerCase());
              if (isImg && att.url) {
                return (
                  <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.url}
                        alt={att.filename}
                        style={{
                          maxWidth: '260px',
                          maxHeight: '200px',
                          objectFit: 'cover',
                          borderRadius: '10px',
                          border: '1px solid rgba(255,255,255,0.2)',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                          cursor: 'pointer',
                          transition: 'transform 0.2s',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                        onMouseOut={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                    </a>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{att.filename}</span>
                  </div>
                );
              }
              return (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '8px',
                    background: 'rgba(0,0,0,0.3)',
                    fontSize: '0.82rem',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <span>📎</span>
                  <a
                    href={att.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 500 }}
                  >
                    {att.filename}
                  </a>
                </div>
              );
            })}
          </div>
        )}

        {/* Content text */}
        <div className="bubble-content">
          {renderFormattedText(message.content)}
        </div>

        {/* Audio TTS playback button for assistant messages */}
        {!isUser && (
          <div className="audio-player-bar">
            <button
              className="btn-play-audio"
              onClick={() => handlePlayAudio(message.audio_url)}
              title={isPlayingAudio ? 'Stop audio playback' : 'Listen to response'}
            >
              {isPlayingAudio ? (
                <>
                  <span>⏹ Stop Voice</span>
                  <span className="equalizer-wave">
                    <span className="equalizer-bar"></span>
                    <span className="equalizer-bar"></span>
                    <span className="equalizer-bar"></span>
                    <span className="equalizer-bar"></span>
                  </span>
                </>
              ) : (
                <>
                  <span>🔊 Listen (TTS)</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Web Search Source Citations */}
        {message.sources && message.sources.length > 0 && (
          <div className="citation-group">
            <span className="citation-header">Web Search Verified Sources</span>
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
            <span className="citation-header">Knowledge Base Document Citations</span>
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

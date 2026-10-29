import React, { useState } from 'react';
import { api } from '../services/api';

export function MessageItem({ message, onRegenerate, isLatestAssistant }) {
  const isUser = message.role === 'user';
  const [copiedCodeIndex, setCopiedCodeIndex] = useState(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [feedback, setFeedback] = useState(message.feedback || null);

  // Copy code block content
  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedCodeIndex(index);
    setTimeout(() => setCopiedCodeIndex(null), 2000);
  };

  // Download code block file
  const handleDownloadCode = (codeText, lang) => {
    const extMap = {
      python: 'py',
      py: 'py',
      javascript: 'js',
      js: 'js',
      typescript: 'ts',
      ts: 'ts',
      html: 'html',
      css: 'css',
      json: 'json',
      sql: 'sql',
      cpp: 'cpp',
      c: 'c',
      java: 'java',
    };
    const ext = extMap[(lang || '').toLowerCase()] || 'txt';
    const blob = new Blob([codeText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code_snippet.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy full response text
  const handleCopyResponse = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // Set message feedback
  const handleFeedback = async (type) => {
    const nextFeedback = feedback === type ? null : type;
    setFeedback(nextFeedback);
    if (message.id && !message.id.startsWith('temp-')) {
      try {
        await api.setMessageFeedback(message.id, nextFeedback);
      } catch (err) {
        console.error('Feedback error:', err);
      }
    }
  };

  // Play audio TTS
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

  // Markdown-like formatting helper
  const renderFormattedText = (text) => {
    if (!text) return null;

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
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-light)',
                borderBottom: 'none',
                borderRadius: '8px 8px 0 0',
                fontSize: '0.74rem',
                color: 'var(--text-secondary)',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              <span>💻 {lang}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => handleCopyCode(codeContent, idx)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    background: copiedCodeIndex === idx ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                    color: copiedCodeIndex === idx ? '#34d399' : 'var(--text-main)',
                    borderRadius: '4px',
                    fontWeight: 600,
                    transition: 'all 0.2s',
                  }}
                  title="Copy code to clipboard"
                >
                  {copiedCodeIndex === idx ? '✓ Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => handleDownloadCode(codeContent, lang)}
                  style={{
                    fontSize: '0.72rem',
                    padding: '2px 8px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: 'var(--text-main)',
                    borderRadius: '4px',
                    fontWeight: 600,
                  }}
                  title="Download code file"
                >
                  ⬇ Download
                </button>
              </div>
            </div>
            <pre style={{ margin: 0, borderRadius: '0 0 8px 8px', overflowX: 'auto', padding: '0.9rem', background: 'rgba(0,0,0,0.5)' }}>
              <code>{codeContent}</code>
            </pre>
          </div>
        );
      }

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
                    .replace(/\n/g, '<br/>'),
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
            {new Date(message.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Attachments preview */}
        {message.attachments && message.attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.8rem' }}>
            {message.attachments.map((att) => {
              const fType = (att.file_type || '').toLowerCase();
              const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fType);
              const isVid = ['mp4', 'webm', 'mov', 'avi'].includes(fType);

              if (isImg && att.url) {
                return (
                  <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <a href={att.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={att.url}
                        alt={att.filename}
                        style={{
                          maxWidth: '280px',
                          maxHeight: '220px',
                          objectFit: 'cover',
                          borderRadius: '10px',
                          border: '1px solid var(--border-light)',
                          boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
                          cursor: 'pointer',
                        }}
                      />
                    </a>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{att.filename}</span>
                      <a href={att.url} download={att.filename} style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)' }}>⬇ Save</a>
                    </div>
                  </div>
                );
              }

              if (isVid && att.url) {
                return (
                  <div key={att.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', width: '100%', maxWidth: '380px' }}>
                    <video
                      controls
                      src={att.url}
                      style={{
                        width: '100%',
                        maxHeight: '260px',
                        borderRadius: '10px',
                        backgroundColor: '#000',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.5)',
                      }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>🎬 {att.filename}</span>
                      <a href={att.url} download={att.filename} style={{ fontSize: '0.74rem', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                        ⬇ Download Video
                      </a>
                    </div>
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
                    background: 'var(--bg-card)',
                    fontSize: '0.82rem',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <span>📎</span>
                  <a
                    href={att.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-cyan)', textDecoration: 'none', fontWeight: 500 }}
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

        {/* Assistant Action Bar (Audio TTS, Copy, Feedback, Regenerate) */}
        {!isUser && (
          <div className="audio-player-bar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginTop: '0.6rem' }}>
            {/* Audio TTS button */}
            <button
              className="btn-play-audio"
              onClick={() => handlePlayAudio(message.audio_url)}
              title={isPlayingAudio ? 'Stop audio playback' : 'Listen to response'}
            >
              {isPlayingAudio ? (
                <>
                  <span>⏹ Stop</span>
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

            {/* Quick Actions Right */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Copy Response */}
              <button
                onClick={handleCopyResponse}
                title="Copy entire response"
                style={{
                  fontSize: '0.76rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: copiedResponse ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                  color: copiedResponse ? '#34d399' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                }}
              >
                {copiedResponse ? '✓ Copied' : '📋 Copy'}
              </button>

              {/* Thumbs Up */}
              <button
                onClick={() => handleFeedback('like')}
                title="Helpful response"
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: feedback === 'like' ? 'rgba(16, 185, 129, 0.25)' : 'var(--bg-card)',
                  border: feedback === 'like' ? '1px solid #10b981' : '1px solid var(--border-light)',
                  color: feedback === 'like' ? '#34d399' : 'var(--text-secondary)',
                }}
              >
                👍
              </button>

              {/* Thumbs Down */}
              <button
                onClick={() => handleFeedback('dislike')}
                title="Needs improvement"
                style={{
                  fontSize: '0.78rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  background: feedback === 'dislike' ? 'rgba(239, 68, 68, 0.25)' : 'var(--bg-card)',
                  border: feedback === 'dislike' ? '1px solid #ef4444' : '1px solid var(--border-light)',
                  color: feedback === 'dislike' ? '#f87171' : 'var(--text-secondary)',
                }}
              >
                👎
              </button>

              {/* Regenerate if latest */}
              {isLatestAssistant && onRegenerate && (
                <button
                  onClick={() => onRegenerate(message)}
                  title="Regenerate this response"
                  style={{
                    fontSize: '0.76rem',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    background: 'var(--bg-card)',
                    color: 'var(--accent-cyan)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>🔄</span>
                  <span>Regenerate</span>
                </button>
              )}
            </div>
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

import React, { useState, useRef } from 'react';
import { api } from '../services/api';

export function Composer({ onSendMessage, onStopGeneration, isGenerating }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);

  // Handle file attachment selection (images, videos, documents, audio, code)
  const handleFileChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        const uploaded = await api.uploadAttachment(file);
        setAttachments((prev) => [...prev, uploaded]);
      }
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Toggle Voice Recording with Web Speech API real-time fallback
  const handleToggleRecord = async () => {
    if (isRecording) {
      // Stop recording
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {}
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    } else {
      // Check for native browser SpeechRecognition first
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = 'hi-IN'; // Default to Hindi / Universal
          recognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                transcript += event.results[i][0].transcript;
              }
            }
            if (transcript) {
              setText((prev) => (prev ? `${prev} ${transcript.trim()}` : transcript.trim()));
            }
          };
          recognition.onerror = () => {
            // Fall back to server transcription if speech recognition errors out
            fallbackAudioRecorder();
          };
          recognition.onend = () => {
            setIsRecording(false);
          };
          speechRecognitionRef.current = recognition;
          recognition.start();
          setIsRecording(true);
          return;
        } catch {
          // Fall back to MediaRecorder
        }
      }
      fallbackAudioRecorder();
    }
  };

  const fallbackAudioRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        try {
          const result = await api.transcribeAudio(audioFile);
          if (result.text) {
            setText((prev) => (prev ? `${prev} ${result.text}` : result.text));
          }
        } catch (err) {
          alert('Voice transcription failed: ' + err.message);
        }
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied or unsupported: ' + err.message);
      setIsRecording(false);
    }
  };

  // Quick image generation trigger
  const handleGenerateImageClick = () => {
    let promptToUse = text.trim();
    if (!promptToUse) {
      promptToUse = window.prompt('Describe the image you want to generate:');
    }
    if (!promptToUse || !promptToUse.trim()) return;

    onSendMessage({
      message: `Generate an image of ${promptToUse.trim()}`,
      attachments: [],
      enable_web_search: false,
      enable_rag: false,
      enable_tts: false,
    });
    setText('');
  };

  // Quick video generation trigger
  const handleGenerateVideoClick = () => {
    let promptToUse = text.trim();
    if (!promptToUse) {
      promptToUse = window.prompt('Describe the video scene you want to generate:');
    }
    if (!promptToUse || !promptToUse.trim()) return;

    onSendMessage({
      message: `Generate a video of ${promptToUse.trim()}`,
      attachments: [],
      enable_web_search: false,
      enable_rag: false,
      enable_tts: false,
    });
    setText('');
  };

  // Submit message
  const handleSubmit = (e) => {
    e?.preventDefault();
    if ((!text.trim() && attachments.length === 0) || isGenerating || isUploading) return;

    onSendMessage({
      message: text.trim() || 'Attached files',
      attachments,
      enable_web_search: isWebSearchEnabled,
      enable_rag: true,
      enable_tts: false,
    });

    setText('');
    setAttachments([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="composer-container">
      <div className="composer-box">
        {/* Attachment preview chips */}
        {attachments.length > 0 && (
          <div className="attachment-preview-bar">
            {attachments.map((att) => {
              const fType = (att.file_type || '').toLowerCase();
              const isImg = ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(fType);
              const isVid = ['mp4', 'webm', 'mov', 'avi'].includes(fType);
              return (
                <div key={att.id} className="attachment-chip" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {isImg && att.url ? (
                    <img
                      src={att.url}
                      alt={att.filename}
                      style={{ width: '26px', height: '26px', objectFit: 'cover', borderRadius: '4px' }}
                    />
                  ) : isVid ? (
                    <span>🎬</span>
                  ) : (
                    <span>📎</span>
                  )}
                  <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {att.filename}
                  </span>
                  <button
                    className="btn-remove-chip"
                    onClick={() => handleRemoveAttachment(att.id)}
                    title="Remove attachment"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Text Area */}
        <textarea
          className="composer-textarea"
          placeholder={isRecording ? '🎙️ Listening to your voice (Hindi, English, universal)...' : 'Ask anything, discuss video/docs, or prompt in Hindi/English...'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          id="composer-input"
        />

        {/* Toolbar Row */}
        <div className="composer-toolbar">
          <div className="toolbar-left">
            {/* Attachment Button */}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              multiple
              accept="image/*,video/*,.mp4,.webm,.mov,.pdf,.docx,.txt,.md,.csv,.xlsx,.py,.js,.ts,.html,.css,audio/*"
              onChange={handleFileChange}
            />
            <button
              className="icon-btn"
              title="Attach image, video, document, or audio"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isGenerating}
              id="btn-attachment"
            >
              📎
            </button>

            {/* Microphone Voice Input */}
            <button
              className={`icon-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop Recording' : 'Record voice input (Hindi / Universal)'}
              onClick={handleToggleRecord}
              id="btn-voice-record"
            >
              🎤
            </button>

            {/* AI Image Generation Trigger */}
            <button
              className="icon-btn image-gen-btn"
              title="Generate AI image from text prompt"
              onClick={handleGenerateImageClick}
              disabled={isGenerating || isUploading}
              id="btn-image-generate"
            >
              🎨
            </button>

            {/* AI Video Generation Trigger */}
            <button
              className="icon-btn video-gen-btn"
              title="Generate AI video from text prompt"
              onClick={handleGenerateVideoClick}
              disabled={isGenerating || isUploading}
              id="btn-video-generate"
            >
              🎥
            </button>

            {/* Web Search Toggle Pill */}
            <button
              className={`toggle-pill ${isWebSearchEnabled ? 'active' : ''}`}
              onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
              title="Toggle live Web Search"
              id="btn-search-toggle"
            >
              <span className="search-led"></span>
              <span>🌐 Web Search {isWebSearchEnabled ? 'ON' : 'OFF'}</span>
            </button>
          </div>

          <div className="toolbar-right">
            {isGenerating ? (
              <button
                className="btn-stop-gen"
                onClick={onStopGeneration}
                id="btn-stop-generation"
                title="Stop response generation"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid #ef4444',
                  color: '#f87171',
                  borderRadius: '10px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <span>⏹</span>
                <span>Stop</span>
              </button>
            ) : (
              <button
                className="btn-send"
                onClick={handleSubmit}
                disabled={(!text.trim() && attachments.length === 0) || isUploading}
                id="btn-send-message"
                title="Send message (Enter)"
              >
                ↑
              </button>
            )}
          </div>
        </div>

        {/* Modern Hint Row */}
        <div className="composer-hint-row">
          <div className="composer-hint-left">
            <span>⚡ Gemini 3.1 Flash Lite</span>
            <span>•</span>
            <span>Hindi & Universal Multimodal AI</span>
          </div>
          <div className="composer-hint-right">
            <span>↵ to send • Shift+↵ for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}

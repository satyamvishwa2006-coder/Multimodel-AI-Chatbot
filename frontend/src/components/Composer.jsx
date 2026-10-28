import React, { useState, useRef } from 'react';
import { api } from '../services/api';

export function Composer({ onSendMessage, isGenerating }) {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Handle file attachment selection
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

  // Toggle Voice Recording
  const handleToggleRecord = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      // Start recording
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
          // Stop mic tracks
          stream.getTracks().forEach((track) => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        alert('Microphone access denied or unsupported: ' + err.message);
      }
    }
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
            {attachments.map((att) => (
              <div key={att.id} className="attachment-chip">
                <span>📎 {att.filename}</span>
                <button
                  className="btn-remove-chip"
                  onClick={() => handleRemoveAttachment(att.id)}
                  title="Remove attachment"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Text Area */}
        <textarea
          className="composer-textarea"
          placeholder={isRecording ? 'Listening to your voice...' : 'Ask anything, discuss an uploaded document, or share thoughts...'}
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
              accept="image/*,.pdf,.docx,.txt,.md,audio/*"
              onChange={handleFileChange}
            />
            <button
              className="icon-btn"
              title="Attach image, document, or audio"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isGenerating}
              id="btn-attachment"
            >
              📎
            </button>

            {/* Microphone Voice Input */}
            <button
              className={`icon-btn ${isRecording ? 'recording' : ''}`}
              title={isRecording ? 'Stop Recording' : 'Record voice input'}
              onClick={handleToggleRecord}
              id="btn-voice-record"
            >
              🎤
            </button>

            {/* Web Search Toggle Pill */}
            <button
              className={`toggle-pill ${isWebSearchEnabled ? 'active' : ''}`}
              onClick={() => setIsWebSearchEnabled(!isWebSearchEnabled)}
              title="Toggle live Web Search"
              id="btn-search-toggle"
            >
              🌐 Web Search {isWebSearchEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="toolbar-right">
            <button
              className="btn-send"
              onClick={handleSubmit}
              disabled={(!text.trim() && attachments.length === 0) || isGenerating || isUploading}
              id="btn-send-message"
              title="Send message"
            >
              {isGenerating ? '⏳' : '↑'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

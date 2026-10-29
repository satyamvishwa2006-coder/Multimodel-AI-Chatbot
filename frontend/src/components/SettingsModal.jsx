import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export function SettingsModal({ isOpen, onClose }) {
  const [customInstructions, setCustomInstructions] = useState('');
  const [preferredTone, setPreferredTone] = useState('empathetic');
  const [preferredLanguage, setPreferredLanguage] = useState('auto');
  const [memoryNotes, setMemoryNotes] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreferences();
    }
  }, [isOpen]);

  const loadPreferences = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const pref = await api.getPreferences();
      if (pref) {
        setCustomInstructions(pref.custom_instructions || '');
        setPreferredTone(pref.preferred_tone || 'empathetic');
        setPreferredLanguage(pref.preferred_language || 'auto');
        setMemoryNotes(pref.memory_notes || '');
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      await api.updatePreferences({
        custom_instructions: customInstructions,
        preferred_tone: preferredTone,
        preferred_language: preferredLanguage,
        memory_notes: memoryNotes,
      });
      setStatusMessage('✓ Settings saved successfully!');
      setTimeout(() => {
        setStatusMessage('');
        onClose();
      }, 900);
    } catch (err) {
      setStatusMessage('Error saving settings: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearMemory = async () => {
    if (window.confirm('Are you sure you want to clear your saved personalization notes and memory?')) {
      setIsLoading(true);
      try {
        await api.clearPreferences();
        setCustomInstructions('');
        setMemoryNotes('');
        setStatusMessage('✓ Personalization memory cleared.');
      } catch (err) {
        setStatusMessage('Error clearing memory: ' + err.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px', width: '92%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{ fontSize: '1.4rem' }}>⚙️</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-main)', fontWeight: 700 }}>
                Personalization & Assistant Memory
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Customize how the AI talks to you, its tone, language, and memory notes.
              </p>
            </div>
          </div>
          <button className="btn-close-modal" onClick={onClose} title="Close settings">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem', maxHeight: '70vh', overflowY: 'auto' }}>
          {statusMessage && (
            <div style={{
              padding: '0.6rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontWeight: 600,
              background: statusMessage.startsWith('✓') ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
              color: statusMessage.startsWith('✓') ? '#34d399' : '#f87171',
              border: statusMessage.startsWith('✓') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)',
            }}>
              {statusMessage}
            </div>
          )}

          {/* Preferred Tone */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Assistant Tone & Persona:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.5rem' }}>
              {[
                { id: 'empathetic', label: 'Empathetic', icon: '💖' },
                { id: 'professional', label: 'Professional', icon: '👔' },
                { id: 'concise', label: 'Concise', icon: '⚡' },
                { id: 'creative', label: 'Creative', icon: '🎨' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setPreferredTone(t.id)}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    border: preferredTone === t.id ? '1px solid var(--accent-primary)' : '1px solid var(--border-light)',
                    background: preferredTone === t.id ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-card)',
                    color: preferredTone === t.id ? '#c7d2fe' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem',
                  }}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preferred Language */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Default Conversation Language:
            </label>
            <select
              value={preferredLanguage}
              onChange={(e) => setPreferredLanguage(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.8rem',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
              }}
            >
              <option value="auto">🌐 Auto-detect (Match User Language naturally)</option>
              <option value="Hindi">🇮🇳 हिन्दी (Hindi)</option>
              <option value="Hinglish">🇮🇳 Hinglish</option>
              <option value="English">🇺🇸 English</option>
              <option value="Spanish">🇪🇸 Español</option>
              <option value="French">🇫🇷 Français</option>
              <option value="German">🇩🇪 Deutsch</option>
              <option value="Japanese">🇯🇵 日本語</option>
            </select>
          </div>

          {/* Custom System Instructions */}
          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
              Custom Instructions (About You & Preferences):
            </label>
            <textarea
              rows={3}
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., I am a full-stack developer. When writing code, prefer modern TypeScript and clean comments. Keep explanations brief."
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                resize: 'vertical',
                lineHeight: 1.45,
              }}
            />
          </div>

          {/* Memory Notes */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Persistent Memory Notes:
              </label>
              <button
                type="button"
                onClick={handleClearMemory}
                style={{ fontSize: '0.74rem', color: '#f87171', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                🗑 Clear Memory
              </button>
            </div>
            <textarea
              rows={2}
              value={memoryNotes}
              onChange={(e) => setMemoryNotes(e.target.value)}
              placeholder="Facts or preferences you want the AI to remember across conversations."
              style={{
                width: '100%',
                padding: '0.6rem 0.8rem',
                borderRadius: '8px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-light)',
                color: 'var(--text-main)',
                fontSize: '0.85rem',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '1.2rem', paddingTop: '0.8rem', borderTop: '1px solid var(--border-light)' }}>
          <button
            type="button"
            className="action-btn"
            onClick={onClose}
            style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-btn primary"
            onClick={handleSave}
            disabled={isLoading}
            style={{ padding: '0.45rem 1.2rem', fontSize: '0.85rem', fontWeight: 600 }}
          >
            {isLoading ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </div>
    </div>
  );
}


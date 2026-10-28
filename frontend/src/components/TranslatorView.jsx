import React, { useState } from 'react';
import { api } from '../services/api';

const SUPPORTED_LANGUAGES = [
  { code: 'hi', name: '🇮🇳 Hindi (हिन्दी)' },
  { code: 'en', name: '🇺🇸 English' },
  { code: 'es', name: '🇪🇸 Spanish (Español)' },
  { code: 'fr', name: '🇫🇷 French (Français)' },
  { code: 'de', name: '🇩🇪 German (Deutsch)' },
  { code: 'ja', name: '🇯🇵 Japanese (日本語)' },
  { code: 'zh', name: '🇨🇳 Chinese (中文)' },
  { code: 'ar', name: '🇸🇦 Arabic (العربية)' },
  { code: 'ru', name: '🇷🇺 Russian (Русский)' },
  { code: 'bn', name: '🇮🇳 Bengali (বাংলা)' },
  { code: 'mr', name: '🇮🇳 Marathi (मराठी)' },
  { code: 'gu', name: '🇮🇳 Gujarati (ગુજરાતી)' },
  { code: 'pa', name: '🇮🇳 Punjabi (ਪੰਜਾਬੀ)' },
  { code: 'ta', name: '🇮🇳 Tamil (தமிழ்)' },
  { code: 'te', name: '🇮🇳 Telugu (తెలుగు)' },
];

export function TranslatorView() {
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('hi');
  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [copied, setCopied] = useState(false);

  // Translate handler
  const handleTranslate = async (textToTranslate = sourceText) => {
    if (!textToTranslate || !textToTranslate.trim()) return;
    setIsTranslating(true);
    try {
      const response = await api.translateText({
        text: textToTranslate.trim(),
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      setTranslatedText(response.translated_text || '');
    } catch (err) {
      alert('Translation failed: ' + err.message);
    } finally {
      setIsTranslating(false);
    }
  };

  // Swap languages
  const handleSwap = () => {
    const tempLang = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(tempLang);
    const tempText = sourceText;
    setSourceText(translatedText);
    setTranslatedText(tempText);
  };

  // Voice speech input for source text
  const handleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      const langMap = {
        hi: 'hi-IN',
        en: 'en-US',
        es: 'es-ES',
        fr: 'fr-FR',
        de: 'de-DE',
      };
      recognition.lang = langMap[sourceLang] || 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);

      recognition.onresult = (event) => {
        const spoken = event.results[0][0].transcript;
        if (spoken) {
          setSourceText(spoken);
          handleTranslate(spoken);
        }
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsRecording(false);
    }
  };

  // Speak text aloud using SpeechSynthesis
  const handleSpeak = (text, langCode) => {
    if (!('speechSynthesis' in window) || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const langMap = {
      hi: 'hi-IN',
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      ja: 'ja-JP',
    };
    utterance.lang = langMap[langCode] || langCode;

    // Pick best available voice for language
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find((v) => v.lang.startsWith(langCode));
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
  };

  // Copy to clipboard
  const handleCopy = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const samplePresets = [
    { text: 'Hello, how can I help you today?', s: 'en', t: 'hi' },
    { text: 'नमस्ते, आप कैसे हैं?', s: 'hi', t: 'en' },
    { text: 'What are the main advantages of multimodal AI models?', s: 'en', t: 'hi' },
    { text: 'कृपया मुझे इस विषय के बारे में विस्तार से बताएं।', s: 'hi', t: 'en' },
  ];

  return (
    <div className="translator-canvas">
      {/* Top Header */}
      <div className="translator-header">
        <div>
          <h2 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', color: '#f8fafc' }}>
            🌐 Live Multilingual & Hindi Translator
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8' }}>
            Instant, natural AI translation between Hindi (हिन्दी), English, and world languages with speech input & audio playback.
          </p>
        </div>

        {/* Quick Language Swap Toolbar */}
        <div className="translator-lang-bar">
          <select
            className="lang-dropdown"
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>

          <button className="btn-swap-lang" onClick={handleSwap} title="Swap languages">
            ⇄
          </button>

          <select
            className="lang-dropdown"
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>

          <button
            className="btn-translate-action"
            onClick={() => handleTranslate()}
            disabled={isTranslating || !sourceText.trim()}
          >
            {isTranslating ? 'Translating...' : 'Translate ➔'}
          </button>
        </div>
      </div>

      {/* Side-by-side Translation Panels */}
      <div className="translator-grid">
        {/* Source Text Box */}
        <div className="trans-box source-box">
          <div className="trans-box-header">
            <span>INPUT ({SUPPORTED_LANGUAGES.find((l) => l.code === sourceLang)?.name})</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className={`icon-tool-btn ${isRecording ? 'recording' : ''}`}
                onClick={handleVoiceInput}
                title="Speak text via microphone"
              >
                🎤 {isRecording ? 'Listening...' : 'Voice Input'}
              </button>
              {sourceText && (
                <button
                  className="icon-tool-btn"
                  onClick={() => handleSpeak(sourceText, sourceLang)}
                  title="Listen to original speech"
                >
                  🔊 Listen
                </button>
              )}
            </div>
          </div>
          <textarea
            className="trans-textarea"
            placeholder={sourceLang === 'hi' ? 'यहाँ हिंदी में लिखें या बोलें...' : 'Type or speak text to translate...'}
            value={sourceText}
            onChange={(e) => setSourceText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleTranslate();
              }
            }}
          />
          <div className="trans-box-footer">
            <span>{sourceText.length} characters</span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Press Ctrl+Enter to translate</span>
          </div>
        </div>

        {/* Target Translation Box */}
        <div className="trans-box target-box">
          <div className="trans-box-header">
            <span>TRANSLATION ({SUPPORTED_LANGUAGES.find((l) => l.code === targetLang)?.name})</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {translatedText && (
                <>
                  <button
                    className="icon-tool-btn"
                    onClick={() => handleSpeak(translatedText, targetLang)}
                    title="Listen to translation"
                  >
                    🔊 Listen
                  </button>
                  <button className="icon-tool-btn" onClick={handleCopy} title="Copy translation">
                    {copied ? '✓ Copied' : '📋 Copy'}
                  </button>
                </>
              )}
            </div>
          </div>
          <textarea
            className="trans-textarea result"
            readOnly
            placeholder={isTranslating ? 'Translating with AI...' : 'Translation will appear here...'}
            value={translatedText}
          />
          <div className="trans-box-footer">
            <span>{translatedText.length} characters</span>
            <span style={{ fontSize: '0.75rem', color: '#10b981' }}>
              {translatedText ? '✓ Translated by AI' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Example Presets */}
      <div className="presets-row">
        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Try Quick Presets:</span>
        {samplePresets.map((preset, idx) => (
          <button
            key={idx}
            className="preset-chip"
            onClick={() => {
              setSourceLang(preset.s);
              setTargetLang(preset.t);
              setSourceText(preset.text);
              handleTranslate(preset.text);
            }}
          >
            {preset.text}
          </button>
        ))}
      </div>
    </div>
  );
}


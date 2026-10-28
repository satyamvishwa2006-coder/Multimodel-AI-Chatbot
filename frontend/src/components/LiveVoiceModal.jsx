import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';

export function LiveVoiceModal({ isOpen, onClose, selectedLanguage = 'hi-IN', onLanguageChange }) {
  const [voiceState, setVoiceState] = useState('idle'); // 'idle' | 'listening' | 'thinking' | 'speaking'
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [language, setLanguage] = useState(selectedLanguage);
  const [isAutoListen, setIsAutoListen] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  const recognitionRef = useRef(null);
  const isComponentMounted = useRef(true);

  useEffect(() => {
    isComponentMounted.current = true;
    return () => {
      isComponentMounted.current = false;
      stopAll();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      startListening();
    } else {
      stopAll();
    }
  }, [isOpen, language]);

  const stopAll = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setVoiceState('idle');
  };

  // Start Web Speech Recognition
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMessage('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      setVoiceState('idle');
      return;
    }

    stopAll();

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = language; // 'hi-IN' or 'en-US'
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        if (!isComponentMounted.current) return;
        setVoiceState('listening');
        setTranscript('');
        setErrorMessage(null);
      };

      recognition.onresult = (event) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript;
        }
        setTranscript(currentTranscript);
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error !== 'no-speech') {
          setErrorMessage(`Microphone error: ${event.error}`);
        }
        setVoiceState('idle');
      };

      recognition.onend = () => {
        if (!isComponentMounted.current) return;
        setTranscript((finalText) => {
          if (finalText && finalText.trim().length > 1) {
            handleSendToAI(finalText.trim());
          } else {
            setVoiceState('idle');
          }
          return finalText;
        });
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setErrorMessage('Could not activate microphone.');
      setVoiceState('idle');
    }
  };

  // Send recognized speech to AI
  const handleSendToAI = async (userText) => {
    setVoiceState('thinking');
    setAiResponse('');

    const langInstruction =
      language === 'hi-IN'
        ? '\n\n(IMPORTANT: The user is speaking in Hindi. Respond directly and fluently in spoken Hindi / हिन्दी with a natural, conversational tone. Keep response concise for speech).'
        : '\n\n(Keep response concise, natural and friendly for live speech synthesis).';

    try {
      const response = await api.sendMessage({
        message: userText + langInstruction,
        attachments: [],
        enable_web_search: false,
        enable_rag: false,
        enable_tts: false,
      });

      const replyText = response.assistant_message?.content || 'I am here with you.';
      setAiResponse(replyText);
      speakLiveResponse(replyText);
    } catch (err) {
      setErrorMessage('Failed to connect to AI: ' + err.message);
      setVoiceState('idle');
    }
  };

  // Speak AI response live with Web Speech Synthesis
  const speakLiveResponse = (text) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState('idle');
      return;
    }

    window.speechSynthesis.cancel();
    setVoiceState('speaking');

    // Clean markdown symbols for natural speech
    const cleanSpeech = text
      .replace(/[*_#`[\]()]/g, ' ')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/(\n)+/g, '. ')
      .slice(0, 800);

    const utterance = new SpeechSynthesisUtterance(cleanSpeech);
    utterance.lang = language;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Pick best matching voice for Hindi or English
    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find(
      (v) => v.lang.startsWith(language.split('-')[0]) || v.lang === language
    );
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onend = () => {
      if (!isComponentMounted.current) return;
      setVoiceState('idle');
      // If auto-listen is active, seamlessly listen for user's reply
      if (isAutoListen) {
        setTimeout(() => {
          if (isComponentMounted.current) {
            startListening();
          }
        }, 600);
      }
    };

    utterance.onerror = () => {
      if (isComponentMounted.current) {
        setVoiceState('idle');
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div className="live-voice-overlay">
      <div className="live-voice-modal">
        {/* Header */}
        <div className="live-voice-header">
          <div className="live-voice-title">
            <span className="live-indicator">● LIVE</span>
            <span>AI Voice Companion</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            {/* Language Selector */}
            <select
              className="live-lang-select"
              value={language}
              onChange={(e) => {
                const newLang = e.target.value;
                setLanguage(newLang);
                if (onLanguageChange) onLanguageChange(newLang);
              }}
            >
              <option value="hi-IN">🇮🇳 हिन्दी (Hindi)</option>
              <option value="en-US">🇺🇸 English</option>
              <option value="en-IN">🇮🇳 Hinglish / Indian English</option>
            </select>

            <button className="btn-close-voice" onClick={onClose} title="End live talk">
              ✕
            </button>
          </div>
        </div>

        {/* Visual Pulsing Orb Animation */}
        <div className="voice-orb-container">
          <div className={`voice-orb ${voiceState}`}>
            <div className="orb-core">
              {voiceState === 'listening' && '🎤'}
              {voiceState === 'thinking' && '💭'}
              {voiceState === 'speaking' && '🔊'}
              {voiceState === 'idle' && '✨'}
            </div>
            <div className="orb-ring ring-1"></div>
            <div className="orb-ring ring-2"></div>
            <div className="orb-ring ring-3"></div>
          </div>
          <div className="voice-status-label">
            {voiceState === 'listening' && (language === 'hi-IN' ? 'सुन रहा हूँ... बोलिए' : 'Listening... Speak now')}
            {voiceState === 'thinking' && (language === 'hi-IN' ? 'सोच रहा हूँ...' : 'Thinking...')}
            {voiceState === 'speaking' && (language === 'hi-IN' ? 'बोल रहा हूँ...' : 'Speaking...')}
            {voiceState === 'idle' && (language === 'hi-IN' ? 'शुरू करने के लिए माइक दबाएँ' : 'Tap to start talking')}
          </div>
        </div>

        {/* Live Subtitles / Transcripts */}
        <div className="voice-transcription-box">
          {transcript && (
            <div className="live-user-speech">
              <span className="speech-badge">You:</span> {transcript}
            </div>
          )}
          {aiResponse && (
            <div className="live-ai-speech">
              <span className="speech-badge ai">AI:</span> {aiResponse}
            </div>
          )}
          {!transcript && !aiResponse && (
            <div className="speech-placeholder">
              {language === 'hi-IN'
                ? 'नमस्ते! आप हिंदी या इंग्लिश में कुछ भी बोल सकते हैं...'
                : 'Say hello or ask anything out loud in English or Hindi...'}
            </div>
          )}
        </div>

        {errorMessage && <div className="voice-error-banner">{errorMessage}</div>}

        {/* Bottom Control Actions */}
        <div className="live-voice-controls">
          <button
            className={`btn-voice-action ${voiceState === 'listening' ? 'active' : ''}`}
            onClick={voiceState === 'listening' ? stopAll : startListening}
          >
            {voiceState === 'listening' ? '⏹ Stop' : '🎤 Speak'}
          </button>

          <label className="auto-listen-toggle">
            <input
              type="checkbox"
              checked={isAutoListen}
              onChange={(e) => setIsAutoListen(e.target.checked)}
            />
            <span>{language === 'hi-IN' ? 'लगातार बातचीत (Auto-listen)' : 'Continuous conversation'}</span>
          </label>

          <button className="btn-voice-end" onClick={onClose}>
            End Call
          </button>
        </div>
      </div>
    </div>
  );
}


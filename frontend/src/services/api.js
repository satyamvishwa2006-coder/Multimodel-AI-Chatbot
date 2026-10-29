const SESSION_KEY = 'mchatbot_session_id';

export function getOrCreateSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function resetSessionId() {
  const newId = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
  localStorage.setItem(SESSION_KEY, newId);
  return newId;
}

async function request(endpoint, options = {}) {
  const sessionId = getOrCreateSessionId();
  const headers = {
    'x-session-id': sessionId,
    ...(options.headers || {}),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = 'An unexpected error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch {
      errorDetail = await response.text() || errorDetail;
    }
    throw new Error(errorDetail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  checkHealth: () => request('/api/health'),

  // Conversations
  listConversations: () => request('/api/conversations'),
  searchConversations: (query) =>
    request(`/api/conversations/search?q=${encodeURIComponent(query)}`),
  createConversation: (title = 'New Conversation') =>
    request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  getConversation: (id) => request(`/api/conversations/${id}`),
  renameConversation: (id, title) =>
    request(`/api/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    }),
  deleteConversation: (id) =>
    request(`/api/conversations/${id}`, { method: 'DELETE' }),
  clearAllConversations: () =>
    request('/api/conversations', { method: 'DELETE' }),
  setMessageFeedback: (messageId, feedback) =>
    request(`/api/conversations/messages/${messageId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    }),

  // Chat
  sendMessage: (payload) =>
    request('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  regenerateMessage: (payload) =>
    request('/api/chat/regenerate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  streamChatMessage: async (payload, { onToken, onDone, onError, signal }) => {
    const sessionId = getOrCreateSessionId();
    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify(payload),
        signal,
      });

      if (!response.ok) {
        let errText = 'Failed to stream response';
        try {
          const errJson = await response.json();
          errText = errJson.detail || errText;
        } catch {
          errText = await response.text() || errText;
        }
        throw new Error(errText);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep partial line

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.substring(6);
            try {
              const data = JSON.parse(jsonStr);
              if (data.type === 'token') {
                onToken(data.token);
              } else if (data.type === 'done') {
                onDone(data);
              } else if (data.type === 'error') {
                onError(new Error(data.error));
              }
            } catch {
              // Ignore non-json lines
            }
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Stream aborted by user
        return;
      }
      onError(err);
    }
  },

  // Uploads
  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/uploads', {
      method: 'POST',
      body: formData,
    });
  },

  // RAG Documents
  listRAGDocuments: () => request('/api/documents/rag'),
  uploadRAGDocument: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/documents/rag/upload', {
      method: 'POST',
      body: formData,
    });
  },
  deleteRAGDocument: (id) =>
    request(`/api/documents/rag/${id}`, { method: 'DELETE' }),

  // Web Search
  searchWeb: (query) =>
    request('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // Workspace Documents
  createWorkspaceDocument: (payload) =>
    request('/api/documents/workspace/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  editWorkspaceDocument: (payload) =>
    request('/api/documents/workspace/edit', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWorkspaceDocument: (id, payload) =>
    request(`/api/documents/workspace/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  listWorkspaceDocuments: () => request('/api/documents/workspace'),
  downloadWorkspaceDocumentUrl: (id, format = 'docx') =>
    `/api/documents/workspace/${id}/download?format=${format}`,
  compareDocuments: (originalText, revisedText) =>
    request('/api/documents/workspace/compare', {
      method: 'POST',
      body: JSON.stringify({ original_text: originalText, revised_text: revisedText }),
    }),

  // Audio / Voice
  transcribeAudio: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/audio/transcribe', {
      method: 'POST',
      body: formData,
    });
  },
  synthesizeSpeech: (text, voice = 'alloy') =>
    request('/api/audio/synthesize', {
      method: 'POST',
      body: JSON.stringify({ text, voice }),
    }),

  // Image Generation
  generateImage: (prompt, width = 768, height = 768) =>
    request('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, width, height }),
    }),

  // Video Generation & Understanding
  generateVideo: (prompt, durationSeconds = 4, aspectRatio = '16:9', conversationId = null) =>
    request('/api/videos/generate', {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        duration_seconds: durationSeconds,
        aspect_ratio: aspectRatio,
        conversation_id: conversationId,
      }),
    }),
  analyzeVideo: (file, query = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (query) formData.append('query', query);
    return request('/api/videos/understand', {
      method: 'POST',
      body: formData,
    });
  },

  // Preferences & Memory
  getPreferences: () => request('/api/preferences'),
  updatePreferences: (payload) =>
    request('/api/preferences', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  clearPreferences: () =>
    request('/api/preferences', {
      method: 'DELETE',
    }),

  // Translation
  translateText: (payload) =>
    request('/api/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

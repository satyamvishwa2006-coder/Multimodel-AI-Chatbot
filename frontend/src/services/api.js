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

  listConversations: () => request('/api/conversations'),
  createConversation: (title = 'New Conversation') =>
    request('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    }),
  getConversation: (id) => request(`/api/conversations/${id}`),
  deleteConversation: (id) =>
    request(`/api/conversations/${id}`, { method: 'DELETE' }),
  clearAllConversations: () =>
    request('/api/conversations', { method: 'DELETE' }),

  sendMessage: (payload) =>
    request('/api/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadAttachment: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('/api/uploads', {
      method: 'POST',
      body: formData,
    });
  },

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

  searchWeb: (query) =>
    request('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

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
  generateImage: (prompt, width = 768, height = 768) =>
    request('/api/images/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, width, height }),
    }),
  translateText: (payload) =>
    request('/api/translate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

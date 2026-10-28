import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export function DocumentWorkspace() {
  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [title, setTitle] = useState('New Project Document');
  const [originalContent, setOriginalContent] = useState('');
  const [revisedContent, setRevisedContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showPromptInput, setShowPromptInput] = useState(false);

  // Load existing workspace documents
  const loadDocuments = async () => {
    try {
      const docs = await api.listWorkspaceDocuments();
      setDocuments(docs);
      if (docs.length > 0 && !activeDoc) {
        selectDocument(docs[0]);
      }
    } catch (err) {
      console.error('Failed to load workspace documents:', err);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const selectDocument = (doc) => {
    setActiveDoc(doc);
    setTitle(doc.title);
    setOriginalContent(doc.original_content || '');
    setRevisedContent(doc.revised_content || doc.original_content || '');
  };

  // Create new document from prompt
  const handleCreateNew = async () => {
    const promptText = window.prompt('Enter a prompt to generate a new document (or leave blank for an empty editor):');
    if (promptText === null) return;

    setIsLoading(true);
    try {
      const doc = await api.createWorkspaceDocument({
        title: promptText ? promptText.slice(0, 30) : 'Untitled Document',
        prompt: promptText,
        file_type: 'docx',
      });
      setDocuments((prev) => [doc, ...prev]);
      selectDocument(doc);
    } catch (err) {
      alert('Creation failed: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Apply AI action (summarize, simplify, fix_grammar, translate, custom)
  const handleApplyAction = async (action, instruction = null) => {
    if (!activeDoc) {
      alert('Please create or select a document first.');
      return;
    }

    setIsLoading(true);
    try {
      const updated = await api.editWorkspaceDocument({
        document_id: activeDoc.id,
        action,
        instruction,
        target_language: 'Spanish',
      });
      selectDocument(updated);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    } catch (err) {
      alert('Action failed: ' + err.message);
    } finally {
      setIsLoading(false);
      setShowPromptInput(false);
      setCustomPrompt('');
    }
  };

  // Accept revised content into original
  const handleAcceptRevisions = () => {
    setOriginalContent(revisedContent);
    alert('Revisions accepted into working draft!');
  };

  return (
    <div className="workspace-container">
      {/* Workspace Top Toolbar */}
      <div className="workspace-toolbar">
        <input
          className="workspace-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Document Title..."
        />

        <div className="workspace-actions">
          <button
            className="action-btn primary"
            onClick={handleCreateNew}
            disabled={isLoading}
            id="btn-workspace-new"
          >
            <span>+</span> New from Prompt
          </button>

          <button
            className="action-btn"
            onClick={() => handleApplyAction('summarize')}
            disabled={isLoading || !originalContent}
            id="btn-action-summarize"
          >
            📋 Summarize
          </button>

          <button
            className="action-btn"
            onClick={() => handleApplyAction('simplify')}
            disabled={isLoading || !originalContent}
            id="btn-action-simplify"
          >
            💡 Simplify
          </button>

          <button
            className="action-btn"
            onClick={() => handleApplyAction('fix_grammar')}
            disabled={isLoading || !originalContent}
            id="btn-action-grammar"
          >
            ✍️ Polish & Fix
          </button>

          <button
            className="action-btn"
            onClick={() => handleApplyAction('translate')}
            disabled={isLoading || !originalContent}
            id="btn-action-translate"
          >
            🌐 Translate (ES)
          </button>

          <button
            className="action-btn"
            onClick={() => setShowPromptInput(!showPromptInput)}
            disabled={isLoading || !originalContent}
            id="btn-action-custom"
          >
            ⚙️ Custom Edit
          </button>
        </div>
      </div>

      {/* Custom Instruction Box */}
      {showPromptInput && (
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '8px' }}>
          <input
            style={{ flex: 1, padding: '0.4rem 0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'white' }}
            placeholder="e.g. Add a section detailing cloud deployment security..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
          />
          <button
            className="action-btn primary"
            onClick={() => handleApplyAction('custom', customPrompt)}
            disabled={!customPrompt.trim() || isLoading}
          >
            Apply
          </button>
        </div>
      )}

      {/* Side-by-Side Editor Comparison */}
      <div className="editor-comparison-grid">
        {/* Original Content */}
        <div className="editor-card">
          <div className="editor-card-header">
            <span>ORIGINAL CONTENT</span>
            <span>Version #{activeDoc?.version_number ? activeDoc.version_number - 1 : 1}</span>
          </div>
          <div className="editor-card-body">
            <textarea
              className="editor-textarea"
              placeholder="Paste or type document content here..."
              value={originalContent}
              onChange={(e) => setOriginalContent(e.target.value)}
              id="textarea-original-doc"
            />
          </div>
        </div>

        {/* AI Revised Content */}
        <div className="editor-card" style={{ borderColor: 'var(--border-focus)' }}>
          <div className="editor-card-header">
            <span style={{ color: '#c7d2fe' }}>AI REVISED VERSION</span>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                className="action-btn"
                style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                onClick={handleAcceptRevisions}
                disabled={!revisedContent || revisedContent === originalContent}
              >
                ✓ Accept Changes
              </button>
            </div>
          </div>
          <div className="editor-card-body">
            <textarea
              className="editor-textarea"
              placeholder={isLoading ? 'AI is generating revisions...' : 'Revised document preview will appear here...'}
              value={revisedContent}
              onChange={(e) => setRevisedContent(e.target.value)}
              id="textarea-revised-doc"
            />
          </div>
        </div>
      </div>

      {/* Download and Export Bar */}
      {activeDoc && (
        <div className="download-bar">
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.5rem' }}>
            Export Approved Document:
          </span>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'docx')}
            className="download-link"
            download
            id="btn-download-docx"
          >
            📥 Download .DOCX
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'md')}
            className="download-link"
            download
            id="btn-download-md"
          >
            📥 Download .MD
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'txt')}
            className="download-link"
            download
            id="btn-download-txt"
          >
            📥 Download .TXT
          </a>
        </div>
      )}
    </div>
  );
}

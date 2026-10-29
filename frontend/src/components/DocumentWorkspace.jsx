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
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'diff'
  const [diffLines, setDiffLines] = useState([]);

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

  // Accept revised content into original and persist
  const handleAcceptRevisions = async () => {
    setOriginalContent(revisedContent);
    if (activeDoc?.id) {
      try {
        const updated = await api.updateWorkspaceDocument(activeDoc.id, {
          title,
          original_content: revisedContent,
          revised_content: revisedContent,
        });
        setActiveDoc(updated);
        setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        alert('Revisions saved into working draft!');
      } catch (err) {
        alert('Changes updated locally. Server note: ' + err.message);
      }
    }
  };

  // Save manual draft edits
  const handleSaveDraft = async () => {
    if (!activeDoc?.id) return;
    try {
      const updated = await api.updateWorkspaceDocument(activeDoc.id, {
        title,
        original_content: originalContent,
        revised_content: revisedContent,
      });
      setActiveDoc(updated);
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      alert('Draft saved successfully!');
    } catch (err) {
      alert('Failed to save draft: ' + err.message);
    }
  };

  // Compute Diff
  const handleToggleDiff = async () => {
    if (viewMode === 'diff') {
      setViewMode('split');
      return;
    }
    try {
      const res = await api.compareDocuments(originalContent, revisedContent);
      setDiffLines(res.diff_lines || []);
      setViewMode('diff');
    } catch (err) {
      alert('Diff comparison error: ' + err.message);
    }
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
            onClick={handleToggleDiff}
            disabled={!originalContent}
            style={{ background: viewMode === 'diff' ? 'rgba(99, 102, 241, 0.3)' : undefined }}
            title="Toggle line-by-line diff comparison"
          >
            🔍 {viewMode === 'diff' ? 'Split View' : 'Diff View'}
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
            style={{ flex: 1, padding: '0.4rem 0.8rem', background: 'var(--bg-input)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-main)' }}
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

      {/* Main View: Split Editor vs Diff View */}
      {viewMode === 'diff' ? (
        <div className="editor-card" style={{ width: '100%', minHeight: '400px' }}>
          <div className="editor-card-header">
            <span>DIFF COMPARISON (Added vs Removed)</span>
            <button className="action-btn" onClick={() => setViewMode('split')} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
              Close Diff
            </button>
          </div>
          <div style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.82rem', maxHeight: '500px', overflowY: 'auto' }}>
            {diffLines.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No differences between original and revised document.</p>
            ) : (
              diffLines.map((line, idx) => {
                const isAdd = line.startsWith('+');
                const isRem = line.startsWith('-');
                return (
                  <div
                    key={idx}
                    style={{
                      padding: '2px 6px',
                      background: isAdd ? 'rgba(16, 185, 129, 0.15)' : isRem ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                      color: isAdd ? '#34d399' : isRem ? '#f87171' : 'var(--text-main)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="editor-comparison-grid">
          {/* Original Content */}
          <div className="editor-card">
            <div className="editor-card-header">
              <span>ORIGINAL CONTENT</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  className="action-btn"
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                  onClick={handleSaveDraft}
                  disabled={!activeDoc || isLoading}
                  title="Save manual changes to database"
                >
                  💾 Save Draft
                </button>
                <span>Version #{activeDoc?.version_number ? activeDoc.version_number - 1 : 1}</span>
              </div>
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
      )}

      {/* Download and Export Bar (DOCX, PDF, XLSX, CSV, MD, TXT) */}
      {activeDoc && (
        <div className="download-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginRight: '0.5rem', fontWeight: 600 }}>
            Export Formats:
          </span>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'docx')}
            className="download-link"
            download
            id="btn-download-docx"
          >
            📥 .DOCX
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'pdf')}
            className="download-link"
            download
            id="btn-download-pdf"
          >
            📥 .PDF
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'xlsx')}
            className="download-link"
            download
            id="btn-download-xlsx"
          >
            📥 .XLSX
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'csv')}
            className="download-link"
            download
            id="btn-download-csv"
          >
            📥 .CSV
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'md')}
            className="download-link"
            download
            id="btn-download-md"
          >
            📥 .MD
          </a>
          <a
            href={api.downloadWorkspaceDocumentUrl(activeDoc.id, 'txt')}
            className="download-link"
            download
            id="btn-download-txt"
          >
            📥 .TXT
          </a>
        </div>
      )}
    </div>
  );
}

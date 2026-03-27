import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, FolderOpen, Folder, Plus, Trash2, ChevronRight, ChevronDown, Send, LayoutDashboard } from 'lucide-react';
import { api } from '../api/client';
import { ChatMessage, ConversationSummary, Document, QueryHistoryEntry, Source } from '../types';
import { PdfViewer } from '../components/PdfViewer/PdfViewer';

interface DocFolder { id: number; name: string }

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g).filter(Boolean);

  return parts.map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={index} href={linkMatch[2]} target="_blank" rel="noreferrer">
          {linkMatch[1]}
        </a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (!listItems.length) {
      return;
    }
    blocks.push(
      <ol key={key}>
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ol>
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    const orderedMatch = line.match(/^\d+\.\s+(.*)$/);

    if (!line) {
      flushList(`list-${index}`);
      return;
    }

    if (orderedMatch) {
      listItems.push(orderedMatch[1]);
      return;
    }

    flushList(`list-${index}`);

    if (line.startsWith('### ')) {
      blocks.push(<h3 key={`h3-${index}`}>{renderInlineMarkdown(line.slice(4))}</h3>);
      return;
    }
    if (line.startsWith('## ')) {
      blocks.push(<h2 key={`h2-${index}`}>{renderInlineMarkdown(line.slice(3))}</h2>);
      return;
    }
    if (line.startsWith('# ')) {
      blocks.push(<h1 key={`h1-${index}`}>{renderInlineMarkdown(line.slice(2))}</h1>);
      return;
    }

    blocks.push(<p key={`p-${index}`}>{renderInlineMarkdown(line)}</p>);
  });

  flushList('list-final');
  return blocks;
}

export function Chat() {
  const [searchParams] = useSearchParams();
  const requestedIds = (searchParams.get('document_ids') ?? '')
    .split(',')
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id));
  const scopedToRequestedDocs = requestedIds.length > 0;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | 'unfiled' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (!documents.length) {
      return;
    }
    void loadConversations(selectedDocs);
  }, [documents, selectedDocs]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (addingFolder) folderInputRef.current?.focus();
  }, [addingFolder]);

  async function loadData() {
    const [docsRes, foldersRes] = await Promise.all([
      api.get<Document[]>('/documents'),
      api.get<DocFolder[]>('/folders')
    ]);
    const readyDocs = docsRes.data.filter((d) => d.status === 'ready');
    const initialSelection = requestedIds.length
      ? readyDocs.filter((doc) => requestedIds.includes(doc.id)).map((doc) => doc.id)
      : readyDocs.map((d) => d.id);
    setDocuments(readyDocs);
    setSelectedDocs(initialSelection);
    setFolders(foldersRes.data);
    // Expand all folders by default
    const expanded: Record<number, boolean> = {};
    foldersRes.data.forEach((f) => { expanded[f.id] = true; });
    setExpandedFolders(expanded);
  }

  async function loadConversations(documentIds: number[]) {
    const params = documentIds.length ? { document_ids: documentIds.join(',') } : undefined;
    const { data } = await api.get<ConversationSummary[]>('/query/history', { params });
    setConversations(data);
  }

  async function openConversation(conversationId: string) {
    const { data } = await api.get<QueryHistoryEntry[]>(`/query/history/${conversationId}`);
    const conversationDocIds = [...new Set(data.flatMap((entry) => entry.document_ids ?? []))];
    const historyMessages: ChatMessage[] = data.flatMap((entry) => ([
      {
        id: `${entry.query_id}-user`,
        role: 'user' as const,
        content: entry.question,
        created_at: new Date(entry.created_at)
      },
      {
        id: `${entry.query_id}-assistant`,
        role: 'assistant' as const,
        content: entry.answer,
        sources: entry.sources,
        created_at: new Date(entry.created_at)
      }
    ]));
    const expanded = Object.fromEntries(
      data.map((entry) => [`${entry.query_id}-assistant`, true])
    ) as Record<string, boolean>;
    if (conversationDocIds.length) {
      setSelectedDocs(conversationDocIds);
    }
    setCurrentConversationId(conversationId);
    setMessages(historyMessages);
    setExpandedSources(expanded);
    setActiveSource(data.at(-1)?.sources[0] ?? null);
  }

  async function deleteConversation(conversationId: string) {
    await api.delete(`/query/history/${conversationId}`);
    if (currentConversationId === conversationId) {
      resetConversation();
    }
    await loadConversations(selectedDocs);
  }

  function resetConversation() {
    setCurrentConversationId(null);
    setMessages([]);
    setExpandedSources({});
    setActiveSource(null);
  }

  const sourceHighlights = useMemo(() => (activeSource ? [activeSource.bbox] : []), [activeSource]);

  const sendQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: question, created_at: new Date() };
    setMessages((cur) => [...cur, userMsg]);
    setLoading(true);
    const q = question;
    setQuestion('');

    try {
      const { data } = await api.post<{ answer: string; sources: Source[]; conversation_id: string }>('/query', {
        question: q,
        document_ids: selectedDocs,
        conversation_id: currentConversationId ?? undefined
      });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: data.answer,
        sources: data.sources, created_at: new Date()
      };
      setMessages((cur) => [...cur, assistantMsg]);
      setCurrentConversationId(data.conversation_id);
      setExpandedSources((cur) => ({ ...cur, [assistantMsg.id]: true }));
      if (data.sources.length) setActiveSource(data.sources[0]);
      void loadConversations(selectedDocs);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendQuestion(e as unknown as FormEvent); }
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    const { data } = await api.post<DocFolder>('/folders', { name: newFolderName.trim() });
    setFolders((cur) => [...cur, data]);
    setExpandedFolders((cur) => ({ ...cur, [data.id]: true }));
    setNewFolderName('');
    setAddingFolder(false);
  };

  const deleteFolder = async (id: number) => {
    await api.delete(`/folders/${id}`);
    setFolders((cur) => cur.filter((f) => f.id !== id));
    setDocuments((cur) => cur.map((d) => (d.folder_id === id ? { ...d, folder_id: null } : d)));
  };

  const moveToFolder = async (docId: number, folderId: number | null) => {
    await api.patch(`/documents/${docId}/folder`, { folder_id: folderId });
    setDocuments((cur) => cur.map((d) => (d.id === docId ? { ...d, folder_id: folderId } : d)));
  };

  const toggleDoc = (id: number, checked: boolean) =>
    setSelectedDocs((cur) => (checked ? [...cur, id] : cur.filter((x) => x !== id)));

  const visibleDocuments = scopedToRequestedDocs
    ? documents.filter((document) => requestedIds.includes(document.id))
    : documents;
  const docsInFolder = (folderId: number) => visibleDocuments.filter((d) => d.folder_id === folderId);
  const unfiledDocs = visibleDocuments.filter((d) => !d.folder_id);

  function DocItem({ doc }: { doc: Document }) {
    return (
      <label
        className={`sidebar-doc-row ${selectedDocs.includes(doc.id) ? 'selected' : ''}`}
        draggable
        onDragStart={() => setDragging(doc.id)}
        onDragEnd={() => { setDragging(null); setDragOver(null); }}
        title={doc.original_name}
      >
        <input
          type="checkbox"
          checked={selectedDocs.includes(doc.id)}
          onChange={(e) => toggleDoc(doc.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        <FileText size={13} style={{ flexShrink: 0 }} />
        <span className="doc-label">{doc.original_name.replace(/\.[^.]+$/, '')}</span>
      </label>
    );
  }

  return (
    <div className="chat-layout">
      {/* ── LEFT SIDEBAR ── */}
      <aside className="chat-sidebar">
        <Link to="/dashboard" className="sidebar-back">
          <LayoutDashboard size={14} /> Dashboard
        </Link>

        <div className="sidebar-section-header">
          <span>Carpetas</span>
          <button type="button" className="icon-btn" title="Nueva carpeta" onClick={() => setAddingFolder(true)}>
            <Plus size={14} />
          </button>
        </div>

        {addingFolder && (
          <div className="new-folder-row">
            <input
              ref={folderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nombre carpeta"
              onKeyDown={(e) => { if (e.key === 'Enter') void createFolder(); if (e.key === 'Escape') { setAddingFolder(false); setNewFolderName(''); } }}
            />
            <button type="button" onClick={() => void createFolder()}>OK</button>
          </div>
        )}

        {folders.map((folder) => (
          <div
            key={folder.id}
            className={`folder-group ${dragOver === folder.id ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(folder.id); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => { if (dragging) void moveToFolder(dragging, folder.id); setDragOver(null); }}
          >
            <div className="folder-header">
              <button type="button" className="folder-toggle" onClick={() => setExpandedFolders((cur) => ({ ...cur, [folder.id]: !cur[folder.id] }))}>
                {expandedFolders[folder.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                {expandedFolders[folder.id] ? <FolderOpen size={14} /> : <Folder size={14} />}
                <span>{folder.name}</span>
                <span className="folder-count">{docsInFolder(folder.id).length}</span>
              </button>
              <button type="button" className="icon-btn danger" onClick={() => void deleteFolder(folder.id)}>
                <Trash2 size={12} />
              </button>
            </div>
            {expandedFolders[folder.id] && (
              <div className="folder-docs">
                {docsInFolder(folder.id).length === 0
                  ? <span className="empty-folder">Arrastra documentos aquí</span>
                  : docsInFolder(folder.id).map((doc) => <DocItem key={doc.id} doc={doc} />)}
              </div>
            )}
          </div>
        ))}

        {unfiledDocs.length > 0 && (
          <div
            className={`folder-group ${dragOver === 'unfiled' ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver('unfiled'); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={() => { if (dragging) void moveToFolder(dragging, null); setDragOver(null); }}
          >
            <div className="folder-header">
              <span className="unfiled-label">Sin carpeta</span>
              <span className="folder-count">{unfiledDocs.length}</span>
            </div>
            <div className="folder-docs">
              {unfiledDocs.map((doc) => <DocItem key={doc.id} doc={doc} />)}
            </div>
          </div>
        )}
      </aside>

      {/* ── CENTER: PDF VIEWER ── */}
      <div className="viewer-pane">
        {activeSource ? (
          <>
            <div className="viewer-info">
              <FileText size={13} />
              <strong>{activeSource.document_name}</strong>
              <span>·</span>
              <span>Pág. {activeSource.page_number}</span>
            </div>
            <PdfViewer
              key={`${activeSource.document_id}-${activeSource.page_number}-${activeSource.bbox.x}-${activeSource.bbox.y}`}
              documentId={activeSource.document_id}
              targetPage={activeSource.page_number}
              highlights={sourceHighlights}
            />
          </>
        ) : (
          <div className="viewer-placeholder">
            <FileText size={48} strokeWidth={1} />
            <span>Selecciona una fuente para ver el PDF</span>
          </div>
        )}
      </div>

      {/* ── RIGHT: CHAT ── */}
      <main className="chat-main">
        <div className="chat-header">
          <span>Chat</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              className="sources-toggle"
              onClick={resetConversation}
            >
              Nuevo chat
            </button>
            <span className="chat-header-meta">{selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {conversations.length > 0 && (
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.08, color: 'var(--text-secondary)', marginBottom: 10 }}>
              Chats anteriores
            </div>
            <div style={{ display: 'grid', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
              {conversations.map((conversation) => (
                <div
                  key={conversation.conversation_id}
                  style={{
                    background: currentConversationId === conversation.conversation_id ? 'var(--bg-secondary)' : 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    padding: '10px 12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                    <button
                      type="button"
                      onClick={() => void openConversation(conversation.conversation_id)}
                      style={{
                        textAlign: 'left',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        padding: 0,
                        flex: 1
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: 4 }}>
                        {conversation.title}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {conversation.message_count} turno{conversation.message_count !== 1 ? 's' : ''} · {new Date(conversation.created_at).toLocaleString()}
                      </div>
                    </button>
                    <button
                      type="button"
                      className="icon-btn danger"
                      onClick={() => void deleteConversation(conversation.conversation_id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="messages">
          {messages.length === 0 && (
            <div className="messages-empty">Haz una pregunta sobre tus documentos</div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="markdown-content">
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.role === 'assistant' && msg.sources?.length ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="sources-toggle"
                    onClick={() => setExpandedSources((cur) => ({ ...cur, [msg.id]: !cur[msg.id] }))}
                  >
                    {expandedSources[msg.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    {msg.sources.length} fuente{msg.sources.length !== 1 ? 's' : ''}
                  </button>
                  {expandedSources[msg.id] && (
                    <div className="sources-list">
                      {msg.sources.map((src, i) => (
                        <button
                          type="button"
                          key={`${msg.id}-${i}`}
                          className={`source-card ${activeSource === src ? 'active' : ''}`}
                          onClick={() => setActiveSource(src)}
                        >
                          <div className="source-card-header">
                            <strong>{src.document_name.replace(/\.[^.]+$/, '')}</strong>
                            <span className="source-page">p.{src.page_number}</span>
                          </div>
                          <span className="source-text">{src.text}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {loading && <div className="message assistant loading">Consultando…</div>}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-form" onSubmit={sendQuestion}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta algo… (Enter para enviar)"
            rows={2}
          />
          <button type="submit" disabled={loading || !question.trim() || selectedDocs.length === 0}>
            <Send size={16} />
          </button>
        </form>
      </main>
    </div>
  );
}

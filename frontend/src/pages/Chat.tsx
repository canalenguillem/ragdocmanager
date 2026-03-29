import React, { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FileText, FolderOpen, Folder, Plus, Trash2, ChevronRight, ChevronDown, Send, LayoutDashboard, X } from 'lucide-react';
import axios from 'axios';
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
  const [contextExpanded, setContextExpanded] = useState(true);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'context' | 'history' | null>(null);
  const [loading, setLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [addingFolder, setAddingFolder] = useState(false);
  const [dragging, setDragging] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | 'unfiled' | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const viewerPaneRef = useRef<HTMLDivElement>(null);

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
    if (!activeSource) {
      return;
    }
    viewerPaneRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeSource]);

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
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? typeof error.response?.data?.error === 'string'
          ? error.response.data.error
          : error.response?.status === 400
            ? 'La consulta es demasiado larga o no tiene el formato esperado.'
            : 'No se pudo procesar la consulta.'
        : 'No se pudo procesar la consulta.';

      setMessages((cur) => [
        ...cur,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: message,
          created_at: new Date()
        }
      ]);
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
  const selectedDocNames = documents
    .filter((document) => selectedDocs.includes(document.id))
    .slice(0, 3)
    .map((document) => document.original_name.replace(/\.[^.]+$/, ''));
  const hiddenDocCount = Math.max(0, selectedDocs.length - selectedDocNames.length);

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
      <div className="viewer-pane" ref={viewerPaneRef}>
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
          <div className="chat-header-copy">
            <span className="chat-kicker">Workspace</span>
            <div className="chat-title-row">
              <span>Chat</span>
              <span className="chat-header-meta">{selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div className="chat-header-actions">
            <button
              type="button"
              className="sources-toggle"
              onClick={resetConversation}
            >
              Nuevo chat
            </button>
          </div>
        </div>

        <div className="chat-mobile-tools">
          <button
            type="button"
            className={`chat-mobile-tool ${mobilePanel === 'context' ? 'active' : ''}`}
            onClick={() => setMobilePanel((current) => current === 'context' ? null : 'context')}
          >
            Contexto
            <span>{selectedDocs.length}</span>
          </button>
          <button
            type="button"
            className={`chat-mobile-tool ${mobilePanel === 'history' ? 'active' : ''}`}
            onClick={() => setMobilePanel((current) => current === 'history' ? null : 'history')}
          >
            Historial
            <span>{conversations.length}</span>
          </button>
        </div>

        <div className="chat-context-bar">
          <div className="chat-context-copy collapsible">
            <button
              type="button"
              className="chat-section-toggle"
              onClick={() => setContextExpanded((current) => !current)}
            >
              <span className="chat-context-label">Contexto activo</span>
              <span className="chat-section-toggle-meta">
                {selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''}
                {contextExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {contextExpanded && (
              <div className="chat-context-docs">
                {selectedDocNames.length > 0 ? (
                  <>
                    {selectedDocNames.map((name) => (
                      <span key={name} className="chat-doc-pill">{name}</span>
                    ))}
                    {hiddenDocCount > 0 && (
                      <span className="chat-doc-pill muted">+{hiddenDocCount} más</span>
                    )}
                  </>
                ) : (
                  <span className="chat-doc-pill muted">Selecciona al menos un documento</span>
                )}
              </div>
            )}
          </div>
        </div>

        {conversations.length > 0 && (
          <div className="conversation-strip">
            <button
              type="button"
              className="chat-section-toggle conversation-strip-toggle"
              onClick={() => setHistoryExpanded((current) => !current)}
            >
              <span className="conversation-strip-title">Chats anteriores</span>
              <span className="chat-section-toggle-meta">
                {conversations.length}
                {historyExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
            </button>
            {historyExpanded && (
              <div className="conversation-list">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.conversation_id}
                    className={`conversation-card ${currentConversationId === conversation.conversation_id ? 'active' : ''}`}
                  >
                    <div className="conversation-card-row">
                      <button
                        type="button"
                        onClick={() => void openConversation(conversation.conversation_id)}
                        className="conversation-open-btn"
                      >
                        <div className="conversation-title">
                          {conversation.title}
                        </div>
                        <div className="conversation-meta">
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
            )}
          </div>
        )}

        {mobilePanel && (
          <div className="chat-mobile-drawer">
            <div className="chat-mobile-drawer-backdrop" onClick={() => setMobilePanel(null)} />
            <div className="chat-mobile-drawer-sheet">
              <div className="chat-mobile-drawer-header">
                <strong>{mobilePanel === 'context' ? 'Contexto activo' : 'Chats anteriores'}</strong>
                <button type="button" className="icon-btn" onClick={() => setMobilePanel(null)}>
                  <X size={16} />
                </button>
              </div>

              {mobilePanel === 'context' ? (
                <div className="chat-mobile-drawer-body">
                  <div className="chat-context-copy mobile">
                    <div className="chat-context-docs">
                      {selectedDocNames.length > 0 ? (
                        <>
                          {selectedDocNames.map((name) => (
                            <span key={name} className="chat-doc-pill">{name}</span>
                          ))}
                          {hiddenDocCount > 0 && (
                            <span className="chat-doc-pill muted">+{hiddenDocCount} más</span>
                          )}
                        </>
                      ) : (
                        <span className="chat-doc-pill muted">Selecciona al menos un documento</span>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="chat-mobile-drawer-body">
                  <div className="conversation-list mobile">
                    {conversations.map((conversation) => (
                      <div
                        key={conversation.conversation_id}
                        className={`conversation-card ${currentConversationId === conversation.conversation_id ? 'active' : ''}`}
                      >
                        <div className="conversation-card-row">
                          <button
                            type="button"
                            onClick={() => {
                              void openConversation(conversation.conversation_id);
                              setMobilePanel(null);
                            }}
                            className="conversation-open-btn"
                          >
                            <div className="conversation-title">
                              {conversation.title}
                            </div>
                            <div className="conversation-meta">
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
            </div>
          </div>
        )}

        <div className="messages">
          {messages.length === 0 && (
            <div className="messages-empty">
              <span className="messages-empty-kicker">Consulta guiada</span>
              <strong>Haz una pregunta sobre tus documentos</strong>
              <p>El asistente responderá usando solo los archivos que tengas seleccionados y te dejará saltar a las fuentes exactas.</p>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div className="message-meta">
                <span>{msg.role === 'assistant' ? 'Asistente' : 'Tú'}</span>
                <span>{msg.created_at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
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

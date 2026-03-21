import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import { api } from '../api/client';
import { ChatMessage, Document, Source } from '../types';
import { PdfViewer } from '../components/PdfViewer/PdfViewer';

export function Chat() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [activeSource, setActiveSource] = useState<Source | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void (async () => {
      const { data } = await api.get<Document[]>('/documents');
      const readyDocs = data.filter((d) => d.status === 'ready');
      setDocuments(readyDocs);
      setSelectedDocs(readyDocs.map((d) => d.id));
    })();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sourceHighlights = useMemo(() => (activeSource ? [activeSource.bbox] : []), [activeSource]);

  const sendQuestion = async (e: FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: question,
      created_at: new Date()
    };
    setMessages((cur) => [...cur, userMsg]);
    setLoading(true);
    const q = question;
    setQuestion('');

    try {
      const { data } = await api.post<{ answer: string; sources: Source[] }>('/query', {
        question: q,
        document_ids: selectedDocs
      });
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        created_at: new Date()
      };
      setMessages((cur) => [...cur, assistantMsg]);
      setExpanded((cur) => ({ ...cur, [assistantMsg.id]: true }));
      if (data.sources.length) setActiveSource(data.sources[0]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendQuestion(e as unknown as FormEvent);
    }
  };

  return (
    <div className="chat-layout">
      {/* LEFT: document list */}
      <aside className="chat-sidebar">
        <Link
          to="/dashboard"
          style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: 13, marginBottom: 16 }}
        >
          <ArrowLeft size={14} /> Dashboard
        </Link>
        <h3>Documentos</h3>
        {documents.map((doc) => (
          <label key={doc.id} className="checkbox-row">
            <input
              type="checkbox"
              checked={selectedDocs.includes(doc.id)}
              onChange={(e) =>
                setSelectedDocs((cur) =>
                  e.target.checked ? [...cur, doc.id] : cur.filter((id) => id !== doc.id)
                )
              }
            />
            <span style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <FileText size={13} style={{ marginTop: 1, flexShrink: 0 }} />
              {doc.original_name}
            </span>
          </label>
        ))}
      </aside>

      {/* CENTER: PDF viewer */}
      <aside className="viewer-pane">
        {activeSource ? (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', alignSelf: 'flex-start' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{activeSource.document_name}</strong>
              {' · '}Página {activeSource.page_number}
            </div>
            <PdfViewer
              documentId={activeSource.document_id}
              targetPage={activeSource.page_number}
              highlights={sourceHighlights}
            />
          </>
        ) : (
          <div className="viewer-placeholder">
            <FileText size={40} strokeWidth={1} />
            <span>Selecciona una fuente para ver el PDF</span>
          </div>
        )}
      </aside>

      {/* RIGHT: chat */}
      <main className="chat-main">
        <div className="chat-header">
          Chat
          <span style={{ fontSize: 12, fontWeight: 400 }}>{selectedDocs.length} doc{selectedDocs.length !== 1 ? 's' : ''} seleccionado{selectedDocs.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="messages">
          {messages.length === 0 && (
            <div style={{ color: 'var(--text-secondary)', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
              Haz una pregunta sobre tus documentos
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              <div>{msg.content}</div>
              {msg.role === 'assistant' && msg.sources?.length ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setExpanded((cur) => ({ ...cur, [msg.id]: !cur[msg.id] }))}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}
                  >
                    {expanded[msg.id] ? '▾' : '▸'} {msg.sources.length} fuente{msg.sources.length !== 1 ? 's' : ''}
                  </button>
                  {expanded[msg.id] && (
                    <div className="sources-list">
                      {msg.sources.map((src, i) => (
                        <button
                          type="button"
                          key={`${msg.id}-${i}`}
                          className="source-card"
                          onClick={() => setActiveSource(src)}
                        >
                          <strong>{src.document_name}</strong>
                          <span>Página {src.page_number}</span>
                          <span style={{ color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                            {src.text}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {loading && (
            <div className="message assistant" style={{ opacity: 0.6 }}>Consultando...</div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-form" onSubmit={sendQuestion}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta algo… (Enter para enviar, Shift+Enter nueva línea)"
            rows={2}
          />
          <button type="submit" disabled={loading || !question.trim()}>
            Enviar
          </button>
        </form>
      </main>
    </div>
  );
}

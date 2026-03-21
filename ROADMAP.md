# RAG Document Manager — Estado del proyecto y Roadmap

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Backend | Fastify 4 + TypeScript |
| Frontend | React 18 + Vite + Zustand |
| Base de datos relacional | MariaDB 11 |
| Base de datos documental | MongoDB 3.6 |
| Base de datos vectorial | Qdrant |
| Caché / sesiones | Redis 7 |
| Contenedores | Docker + Docker Compose |
| Proveedores IA | OpenAI, Gemini (Google) |

---

## Lo que está implementado

### Autenticación
- [x] Registro de usuarios (email + contraseña hasheada con bcrypt)
- [x] Login con JWT (expiración 8h)
- [x] Revocación de tokens en logout (Redis)
- [x] Rutas protegidas con middleware JWT
- [x] Redirección automática según estado de sesión

### Gestión de documentos
- [x] Subida de PDFs (drag-and-drop o selector de archivo, máx. 50 MB)
- [x] Procesado asíncrono con seguimiento de estado (`pending → processing → ready / error`)
- [x] Extracción de texto con pdfjs-dist
- [x] Chunking inteligente (512 chars, 256 de solapamiento)
- [x] Tracking de bounding boxes por chunk (página + coordenadas)
- [x] Borrado de documentos con limpieza en cascada (Qdrant + MongoDB + MariaDB)
- [x] Endpoint de descarga/servicio de archivos
- [x] Polling automático de estado en el dashboard (cada 3 s)

### Embeddings y búsqueda vectorial
- [x] Soporte para OpenAI (`text-embedding-3-large`, `text-embedding-3-small`, `text-embedding-ada-002`)
- [x] Soporte para Gemini (`gemini-embedding-001`)
- [x] Procesado por lotes (OpenAI: 20 items, Gemini: 5 items)
- [x] Almacenamiento en Qdrant con filtrado por usuario y documento
- [x] Búsqueda semántica por similitud coseno (top-K configurable)

### RAG (Retrieval-Augmented Generation)
- [x] Pipeline completo: pregunta → embedding → búsqueda vectorial → contexto → LLM → respuesta
- [x] Selección de múltiples documentos como contexto (checkboxes)
- [x] Recuperación de las 5 fuentes más relevantes por consulta
- [x] Atribución de fuentes con número de página y bounding box
- [x] Historial de consultas persistido en MongoDB
- [x] Prompt del sistema en español

### Gestión de API Keys
- [x] Almacenamiento cifrado de claves (AES-256-CBC)
- [x] Por proveedor y por usuario
- [x] Tipo de clave: embeddings, chat o ambos
- [x] Verificación de clave antes de guardar
- [x] Fallback a variables de entorno (`OPENAI_API_KEY`, `GEMINI_API_KEY`)

### Preferencias de usuario
- [x] Selección de proveedor y modelo de embeddings
- [x] Selección de proveedor y modelo de chat LLM
- [x] Persistencia de configuración por usuario en MariaDB
- [x] Aviso al cambiar modelo de embeddings (requiere re-indexar)

### Interfaz de chat
- [x] Layout de 3 paneles: lista de documentos | visor PDF | conversación
- [x] Selección de documentos con checkboxes
- [x] Historial de mensajes en la sesión
- [x] Fuentes colapsables por respuesta
- [x] Clic en fuente → navega al chunk en el visor PDF
- [x] Resaltado visual del chunk en el PDF
- [x] Indicador de carga durante la consulta

### Dashboard
- [x] Tarjetas de documento con estado, tamaño, páginas y proveedor
- [x] Badge de error con mensaje descriptivo
- [x] Botón de borrado (papelera) por documento
- [x] Banner de aviso si no hay API keys configuradas

---

## Roadmap

### P0 — Bugs / deuda técnica inmediata
- [ ] Paginación en la lista de documentos (ahora carga todo)
- [ ] Retry automático en fallos transitorios de la API de embeddings
- [ ] Manejo de modelos con dimensiones distintas a 3072 en Qdrant (actualmente hardcodeado)
- [ ] Re-indexado automático al cambiar modelo de embeddings

### P1 — Mejoras de UX prioritarias
- [ ] Visor PDF con controles de navegación completos (anterior/siguiente, número de página)
- [ ] Soporte para PDFs escaneados mediante OCR (Tesseract o servicio externo)
- [ ] Subida múltiple de archivos en una sola operación
- [ ] Progreso detallado del procesado (extracción, chunking, embeddings)
- [ ] Retry manual de documentos con error
- [ ] Exportar historial de chat (PDF / Markdown)

### P2 — Nuevas funcionalidades
- [ ] Búsqueda dentro de documentos y del historial de chat
- [ ] Carpetas / etiquetas para organizar documentos
- [ ] Compartir documentos entre usuarios
- [ ] Modo de comparación entre documentos (query sobre N PDFs a la vez con respuesta estructurada)
- [ ] Preguntas sugeridas al abrir un documento (como ChatPDF)
- [ ] Respuestas en streaming (Server-Sent Events)

### P3 — Proveedores adicionales
- [ ] Cohere embeddings y chat
- [ ] Mistral embeddings y chat
- [ ] Soporte para modelos locales vía Ollama

### P4 — Operaciones y calidad
- [ ] Tests unitarios de servicios backend (embedding, rag, pdf)
- [ ] Tests de integración con base de datos real
- [ ] Documentación OpenAPI/Swagger del API
- [ ] Rate limiting en endpoints de auth y upload
- [ ] Logs estructurados (sustituir console.log por pino levels)
- [ ] Dashboard de métricas: consultas por día, documentos procesados, errores

---

## Esquema de base de datos

```
MariaDB
├── users              (id, email, password_hash, name, role)
├── user_api_keys      (user_id, provider, key_type, encrypted_key, verified_at)
├── user_settings      (user_id, embedding_provider, embedding_model, chat_provider, chat_model, embedding_dimensions)
└── documents          (id, user_id, filename, original_name, file_size, page_count, status, error_msg, embedding_provider, embedding_model)

MongoDB
├── document_chunks    (document_id, user_id, chunk_index, text, page_number, bbox, qdrant_point_id)
└── query_history      (user_id, question, answer, sources[], embedding_provider, chat_provider)

Qdrant
└── rag_docs           (vector 3072-dim, payload: document_id, user_id, chunk_index, page_number, text, bbox)

Redis
└── token_blacklist    (JWT revocados en logout)
```

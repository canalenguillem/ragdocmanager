# RAG Document Manager

Sistema multiusuario de gestion documental con RAG (Retrieval-Augmented Generation) para subir PDFs tecnicos, indexarlos en Qdrant y consultar su contenido con respuesta estructurada y fuentes trazables hasta la pagina exacta del documento.

## Requirements

- Docker
- Docker Compose v2

## Setup

1. `cp .env.example .env`
2. Genera `API_KEY_ENCRYPTION_SECRET` con `openssl rand -hex 32`
3. Ejecuta `docker compose up -d`

## URLs

- Frontend: `http://localhost:3002`
- Backend: `http://localhost:4001`
- Qdrant: `http://localhost:6335`
- n8n: `http://localhost:5680`

## First Use

1. Registra un usuario
2. Ve a `/settings`
3. Añade una API key de Gemini o OpenAI
4. Sube un PDF
5. Espera a que el estado sea `ready`
6. Abre Chat y haz preguntas sobre el documento

## Architecture

```text
┌─────────────────────────────────────────────────────┐
│                    Docker Network                    │
│                                                      │
│  ┌──────────┐    ┌──────────┐    ┌───────────────┐  │
│  │ Frontend │    │ Backend  │    │    n8n        │  │
│  │  :3000   │───▶│  :4000   │    │   :5678       │  │
│  │ React+Vite│   │ Fastify  │    │  (workflows)  │  │
│  └──────────┘    └────┬─────┘    └───────────────┘  │
│                       │                              │
│         ┌─────────────┼──────────────┐               │
│         ▼             ▼              ▼               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ MariaDB  │  │ MongoDB  │  │  Redis   │           │
│  │  :3306   │  │  :27017  │  │  :6379   │           │
│  │ users,   │  │ docs,    │  │ sessions │           │
│  │ doc meta │  │ chunks,  │  │ cache    │           │
│  └──────────┘  │ history  │  └──────────┘           │
│                └──────────┘                          │
│                                                      │
│                ┌──────────┐                          │
│                │  Qdrant  │                          │
│                │  :6333   │                          │
│                │ vectors  │                          │
│                └──────────┘                          │
└─────────────────────────────────────────────────────┘
```

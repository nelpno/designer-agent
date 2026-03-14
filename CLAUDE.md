# Designer Agent

## Status: Em desenvolvimento (Fase 1)

## O que é
Plataforma interna de geração de artes estáticas com IA. Pipeline de 5 agentes (Creative Director → Prompt Engineer → Generator → Reviewer → Refiner) com loop automático de qualidade.

## Stack
- **Backend**: Python FastAPI + Celery + Redis
- **Frontend**: React + Vite + Tailwind
- **DB**: PostgreSQL 16
- **IA**: OpenRouter (API única) — LLMs + geração de imagem
- **Infra**: Docker + Portainer

## Modelos via OpenRouter
- **LLMs**: `anthropic/claude-sonnet-4` (agentes pensantes)
- **Imagem texto**: `google/gemini-3-pro-image-preview` (Nano Banana Pro)
- **Imagem rápida**: `google/gemini-3.1-flash-image-preview` (Nano Banana 2)
- **Imagem foto**: `black-forest-labs/flux.2-pro` (FLUX.2 Pro)
- **Imagem flex**: `black-forest-labs/flux.2-flex` (FLUX.2 Flex)
- **Fontes custom**: `sourceful/riverflow-v2-standard-preview`

## Estrutura
```
backend/app/
├── agents/          # 5 agentes do pipeline
├── providers/       # OpenRouter client + model router
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic schemas
├── routers/         # API endpoints
├── services/        # Business logic
├── prompts/         # Templates de prompt por tipo de arte
└── tasks/           # Celery tasks

frontend/src/
├── pages/           # Dashboard, NewBrief, Gallery, GenerationDetail, Brands
├── components/      # BriefForm, ChatArea, PipelineTrace, etc.
├── api/             # API client + WebSocket
└── hooks/           # React hooks
```

## Convenções
- Python: async/await, type hints, Pydantic v2
- Frontend: TypeScript, componentes funcionais, Tailwind
- API: REST, prefixo `/api/`, paginação cursor-based
- Testes: pytest (backend), vitest (frontend)

## Gotchas
- OpenRouter image generation usa `modalities: ["image"]` e retorna base64 PNG
- `image_config.aspect_ratio` e `image_config.image_size` para configurar output
- Geração de imagem é async via Celery (pode levar 30-60s+)
- WebSocket em `/ws/generation/{id}` para updates em tempo real

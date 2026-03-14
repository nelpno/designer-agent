# Designer Agent

## Status: Em produção (v1.0)

## URLs
- **Frontend**: https://design.dynamicagents.tech (ou http://82.29.60.220:8086)
- **API**: http://82.29.60.220:8085
- **API Docs**: http://82.29.60.220:8085/docs
- **GitHub**: https://github.com/nelpno/designer-agent (público)

## O que é
Plataforma interna de geração de artes estáticas com IA. Pipeline de 5 agentes (Creative Director → Prompt Engineer → Generator → Reviewer → Refiner) com loop automático de qualidade.

## Stack
- **Backend**: Python FastAPI + Celery + Redis
- **Frontend**: React 19 + Vite 6 + Tailwind 3 (fontes Sora + DM Sans)
- **DB**: PostgreSQL 14 (compartilhado, database `designer_agent`, user `designer`)
- **IA**: OpenRouter (API única) — LLMs + geração de imagem
- **Infra**: Docker Swarm via Portainer (stack ID: 32, rede: nelsonNet)
- **DNS**: design.dynamicagents.tech via Cloudflare (proxy ativado, SSL Full)
- **Reverse Proxy**: Traefik v2.11 com labels no deploy

## Modelos via OpenRouter
- **LLMs**: `anthropic/claude-sonnet-4` (agentes pensantes)
- **Imagem texto**: `google/gemini-3-pro-image-preview` (Nano Banana Pro)
- **Imagem rápida**: `google/gemini-3.1-flash-image-preview` (Nano Banana 2)
- **Imagem foto**: `black-forest-labs/flux.2-pro` (FLUX.2 Pro)
- **Imagem flex**: `black-forest-labs/flux.2-flex` (FLUX.2 Flex)
- **Fontes custom**: `sourceful/riverflow-v2-standard-preview`

## Features
- **Brand Discovery**: POST /api/brands/discover?website_url=... — IA analisa site e extrai guidelines
- **Sugestão de Textos**: POST /api/briefs/suggest-texts — IA sugere título, texto e CTA
- **Upload de Referências**: POST /api/briefs/upload-reference — upload de imagens
- **Model Router**: Seleção inteligente de modelo por tipo de arte
- **Quality Loop**: Reviewer + Refiner com até 3 iterações automáticas
- **WebSocket**: Updates em tempo real do pipeline

## Estrutura
```
backend/app/
├── agents/          # 5 agentes do pipeline (creative_director, prompt_engineer, generator, reviewer, refiner)
├── providers/       # OpenRouter client unificado + model router
├── models/          # SQLAlchemy models (brand, brief, generation, pipeline_log, generated_image)
├── schemas/         # Pydantic schemas
├── routers/         # API endpoints (brands, briefs, generations, gallery, websocket)
├── services/        # Business logic (brand_service, brief_service, storage_service, brand_discovery)
├── prompts/         # Templates de prompt por tipo de arte
└── tasks/           # Celery tasks (generation_tasks)

frontend/src/
├── pages/           # Painel, Novo Brief, Galeria, Detalhe da Geração, Gestão de Marcas
├── components/      # Layout, StatusBadge, ScoreBadge, ModelBadge
├── api/             # Axios client + WebSocket helper
└── types/           # TypeScript types
```

## Deploy (como atualizar)
1. Fazer push para `main` no GitHub
2. Forçar restart dos serviços via Portainer (ou via API)
3. Containers clonam o repo do GitHub na inicialização

## Convenções
- Python: async/await, type hints, Pydantic v2
- Frontend: TypeScript, componentes funcionais, Tailwind, tudo em PT-BR
- API: REST, prefixo `/api/`
- Agents: NÃO usar `response_format={"type": "json_object"}` — nem todos os modelos suportam. Fazer strip de markdown code blocks antes de json.loads()

## Gotchas
- OpenRouter image generation usa `modalities: ["image"]` e retorna base64 PNG
- `image_config.aspect_ratio` e `image_config.image_size` para configurar output
- Geração de imagem é async via Celery (pode levar 30-60s+)
- WebSocket em `/ws/generation/{id}` para updates em tempo real
- UUID nas Celery tasks: sempre converter str → uuid.UUID() antes de query no SQLAlchemy
- Storage: arquivos em `/app/storage/`, servidos via Nginx/Traefik em `/storage/`
- Cloudflare SSL deve estar em modo "Full" para evitar redirect loop
- Vite `allowedHosts: true` para aceitar qualquer hostname
- CORS: `allow_origins=["*"]` para flexibilidade

## Credenciais (NÃO committar)
- OpenRouter API Key: nas variáveis de ambiente da stack Portainer
- PostgreSQL: designer / designer123 / designer_agent
- Portainer Stack ID: 32

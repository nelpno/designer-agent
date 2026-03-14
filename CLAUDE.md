# Designer Agent

## Status: Em produção (v1.0) — 15 commits, 80+ arquivos

## URLs
- **Frontend**: http://82.29.60.220:8086 (direto)
- **Frontend (domínio)**: https://design.dynamicagents.tech (requer Cloudflare SSL=Full)
- **API**: http://82.29.60.220:8085
- **API Docs Swagger**: http://82.29.60.220:8085/docs
- **GitHub**: https://github.com/nelpno/designer-agent (público)
- **Portainer Stack**: ID 32

## O que é
Plataforma interna de geração de artes estáticas com IA. Pipeline de 5 agentes (Creative Director → Prompt Engineer → Generator → Reviewer → Refiner) com loop automático de qualidade e seleção inteligente de modelo.

## Stack
- **Backend**: Python 3.12 FastAPI + Celery + Redis
- **Frontend**: React 19 + Vite 6 + Tailwind 3 (fontes Sora + DM Sans, glassmorphism dark theme)
- **DB**: PostgreSQL 14 (compartilhado na nelsonNet, database `designer_agent`, user `designer`)
- **IA**: OpenRouter (API única) — LLMs para agentes + geração de imagem
- **Infra**: Docker Swarm via Portainer, rede nelsonNet
- **DNS**: design.dynamicagents.tech via Cloudflare (proxy ativado)
- **Reverse Proxy**: Traefik v2.11 com labels no deploy (websecure + letsencrypt)
- **Imagens**: servidas via FastAPI StaticFiles em `/storage/`

## Modelos via OpenRouter
- **LLMs (agentes pensantes)**: `anthropic/claude-sonnet-4`
- **Imagem (texto/logo)**: `google/gemini-3-pro-image-preview` (Nano Banana Pro)
- **Imagem (rápido)**: `google/gemini-3.1-flash-image-preview` (Nano Banana 2)
- **Imagem (fotorrealismo)**: `black-forest-labs/flux.2-pro` (FLUX.2 Pro)
- **Imagem (flexível)**: `black-forest-labs/flux.2-flex` (FLUX.2 Flex)
- **Fontes customizadas**: `sourceful/riverflow-v2-standard-preview`

## Model Router — Seleção Inteligente
| Tipo de Arte | Modelo | Razão |
|---|---|---|
| Logo / texto pesado | Nano Banana Pro | Melhor texto em imagens |
| Ad com CTA/headline | Nano Banana Pro | Texto perfeito |
| Product shot / foto | FLUX.2 Pro | Fotorrealismo |
| Post social media | Nano Banana 2 | Rápido, bom custo |
| Ilustração | Nano Banana Pro | Estilo artístico |
| Regra geral: texto → Nano Banana Pro | | |

## Features
- **Pipeline 5 Agentes**: Creative Director → Prompt Engineer → Generator → Reviewer → Refiner
- **Quality Loop**: Reviewer avalia (score 0-100), Refiner corrige, até 3 iterações
- **Brand Discovery**: IA analisa site do cliente e preenche guidelines automaticamente
- **Sugestão de Textos com IA**: sugere título, texto e CTA baseado na descrição
- **Upload de Referências**: drag-and-drop de imagens de referência
- **Upload de Logo**: na gestão de marcas
- **Model Router**: seleção automática do melhor modelo por tipo de arte
- **WebSocket**: updates em tempo real do pipeline
- **API Docs**: Swagger em /docs com documentação completa
- **Sidebar Responsiva**: hamburger menu no mobile

## Estrutura
```
backend/app/
├── agents/          # creative_director, prompt_engineer, generator, reviewer, refiner
│   ├── orchestrator.py   # Pipeline controller com loop de qualidade
│   └── context.py        # PipelineContext compartilhado entre agentes
├── providers/       # openrouter_client.py (LLMs + imagem) + model_router.py
├── models/          # brand, brief, generation, pipeline_log, generated_image, prompt_template
├── schemas/         # Pydantic v2 schemas
├── routers/         # brands, briefs, generations, gallery, websocket
├── services/        # brand_service, brief_service, storage_service, brand_discovery
├── prompts/         # Templates por tipo de arte (10 tipos)
└── tasks/           # Celery tasks (engine próprio por task)

frontend/src/
├── pages/           # Painel, Novo Brief, Galeria, Detalhe da Geração, Gestão de Marcas
├── components/      # Layout (responsivo), StatusBadge, ScoreBadge, ModelBadge
├── api/             # Axios client + WebSocket + storageUrl helper
└── types/           # TypeScript types (ArtType, Platform, GenerationStatus)
```

## Deploy
1. `git push origin main` — código vai para GitHub
2. Restart serviços no Portainer (ou via API)
3. Containers clonam repo do GitHub na inicialização (~3 min para ficar pronto)
4. Portas: backend=8085, frontend=8086

## Convenções
- Python: async/await, type hints, Pydantic v2
- Frontend: TypeScript, Tailwind, tudo em Português Brasileiro
- API: REST, prefixo `/api/`
- Agentes: NÃO usar `response_format={"type": "json_object"}` — fazer strip de markdown code blocks antes de json.loads()
- Celery tasks: criar engine asyncpg NOVO por task (nunca usar o global do FastAPI)
- Imagens: salvar em storage, servir via `/storage/`, frontend usa `storageUrl()` helper
- OpenRouter image parsing: suportar TODOS os formatos (list, dict, string, images field com objetos)

## Gotchas
- Traefik redireciona HTTP→HTTPS globalmente. Cloudflare SSL deve estar em "Full"
- Vite precisa de `allowedHosts: true` para aceitar qualquer hostname
- CORS: `allow_origins=["*"]`
- UUID: sempre converter str→uuid.UUID() antes de query no SQLAlchemy
- Celery + asyncpg: cada task cria engine próprio (event loop separado)
- FLUX.2 retorna images como `[{type:"image_url", image_url:{url:"data:..."}}]`
- Gerações travadas: marcar como failed via SQL se ficarem >10min em pending/running

## Credenciais (NÃO committar)
- OpenRouter API Key: nas env vars da stack Portainer
- PostgreSQL: designer / designer123 / designer_agent (host: postgres na nelsonNet)
- Portainer Stack ID: 32

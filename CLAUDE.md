# Artisan

## Status: Em produção (v1.3) — 38 commits

## URLs
- **Frontend**: http://82.29.60.220:8086 (direto)
- **Frontend (domínio)**: https://design.dynamicagents.tech (requer Cloudflare SSL=Full)
- **API**: http://82.29.60.220:8085
- **API Docs Swagger**: desabilitado em produção (habilitar com `DEBUG=true`)
- **GitHub**: https://github.com/nelpno/designer-agent (público)
- **Portainer Stack**: ID 32

## O que é
Plataforma interna de geração de artes estáticas com IA chamada **Artisan**. Pipeline de 5 agentes (Creative Director → Prompt Engineer → Generator → Reviewer → Refiner) com loop automático de qualidade e seleção inteligente de modelo.

## Stack
- **Backend**: Python 3.12 FastAPI + Celery + Redis
- **Frontend**: React 19 + Vite 6 + Tailwind 3 (fontes Sora + DM Sans, dark/light theme Raycast-style)
- **DB**: PostgreSQL 14 (compartilhado na nelsonNet, database `designer_agent`, user `designer`)
- **IA**: OpenRouter (API única) — LLMs para agentes + geração de imagem (HTTP/2)
- **Infra**: Docker Swarm via Portainer, rede nelsonNet
- **DNS**: design.dynamicagents.tech via Cloudflare (proxy ativado)
- **Reverse Proxy**: Traefik v2.11 com labels no deploy (websecure + letsencrypt)
- **Imagens**: servidas via FastAPI StaticFiles em `/storage/`

## Modelos via OpenRouter
- **LLMs (agentes pensantes)**: `anthropic/claude-sonnet-4` (Prompt Engineer, Reviewer, Refiner)
- **LLM rápido**: `anthropic/claude-haiku-4.5` (Creative Director — tarefa mais simples)
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
- **Brand Discovery**: IA analisa site, Instagram, about pages e logo via vision — output em PT-BR
- **Sugestão de Textos com IA**: sugere título, texto e CTA baseado na descrição
- **Upload de Referências**: drag-and-drop de imagens de referência (enviadas ao modelo como base64)
- **Upload de Logo**: na gestão de marcas (suporta data URL e arquivo)
- **Model Router**: seleção automática do melhor modelo por tipo de arte
- **Prompts por Modelo**: JSON estruturado (Gemini), linguagem natural (FLUX), texto entre aspas
- **Enriquecimento de Descrição**: Creative Director auto-melhora descrições fracas
- **Pipeline em Tempo Real**: logs persistidos após cada agente, WebSocket + polling inteligente
- **Download de Imagens**: endpoint dedicado com Content-Disposition attachment
- **Dark/Light Mode**: tema segue sistema + toggle manual (ThemeProvider + localStorage)
- **Fluxo Progressivo**: criação de arte em seções que revelam conforme avança (tudo-em-um)
- **Auth Middleware**: API key opcional via `API_SECRET_KEY` env var
- **Upload Seguro**: validação magic bytes, limite 10MB, extensão forçada
- **Sidebar Responsiva**: hamburger menu no mobile, touch targets 44px
- **Pipeline Visual**: nomes dos agentes (Creative Director, etc.), duração human-readable, raciocínio expansível
- **Mobile Otimizado**: stats 2 colunas, art types 2 colunas, padding responsivo, stack vertical

## Design System — Artisan
- **Nome**: Artisan (logo ❖ com gradiente verde→ciano)
- **Visual**: Raycast/Notion-style, dark quente (#1C1C1E), cards sólidos (#2C2C2E)
- **Accent**: Verde #30D158 (primary), Ciano #5AC8FA (secondary), gradiente 135deg
- **Status**: success=#30D158, processing=#5AC8FA, pending=#FFD60A, failed=#FF453A
- **Tema**: CSS variables em `:root` (dark) e `[data-theme="light"]`
- **Fontes**: Sora (headings), DM Sans (body)
- **Cards**: `.artisan-card` (bg-secondary, border, rounded-xl, hover translateY -2px)
- **Botões**: `.btn-primary` (gradient), `.btn-secondary` (outline), `.btn-ghost`
- **Inputs**: `.artisan-input` (bg-tertiary, border, focus ring accent)

## Estrutura
```
backend/app/
├── agents/          # creative_director, prompt_engineer, generator, reviewer, refiner
│   ├── orchestrator.py   # Pipeline controller com loop de qualidade
│   └── context.py        # PipelineContext compartilhado entre agentes
├── providers/       # openrouter_client.py (LLMs + imagem, HTTP/2) + model_router.py
├── models/          # brand, brief, generation, pipeline_log, generated_image, prompt_template
├── schemas/         # Pydantic v2 schemas
├── routers/         # brands, briefs, generations, gallery, websocket
├── services/        # brand_service, brief_service, storage_service, brand_discovery
├── prompts/         # Templates por tipo de arte (10 tipos)
└── tasks/           # Celery tasks (engine próprio por task)

frontend/src/
├── pages/           # Painel, Nova Arte, Galeria, Detalhe da Geração, Gestão de Marcas
├── components/      # Layout (responsivo), StatusBadge, ScoreBadge, ModelBadge
├── contexts/        # ThemeContext (dark/light mode)
├── api/             # Axios client + WebSocket + storageUrl helper
└── types/           # TypeScript types (ArtType, Platform, GenerationStatus)
```

## Deploy
1. `git push origin main` — código vai para GitHub
2. Restart via API: `POST stop + POST start` em `https://porto.dynamicagents.tech/api/stacks/32/{stop|start}?endpointId=1`
3. Containers clonam repo do GitHub na inicialização (~3 min para ficar pronto)
4. Portas: backend=8085, frontend=8086
5. NUNCA dar restart com gerações em andamento — worker morre e geração fica travada

## Convenções
- Python: async/await, type hints, Pydantic v2
- Frontend: TypeScript, Tailwind, tudo em Português Brasileiro
- Frontend: TODAS as cores via CSS variables (var(--bg-primary), var(--text-primary), etc.) — NUNCA hardcoded hex
- Frontend: "Nova Arte" (não "Novo Brief"), "Artisan" (não "Designer Agent")
- Frontend: fluxo progressivo ordem — Marca → Tipo → Descrição → Textos → Gerar (descrição antes de textos para IA sugerir melhor)
- Frontend: Pipeline mostra nomes dos agentes (Creative Director, não "Etapa 1"), duração como "1min 18s" (não "78.1s")
- Frontend: NÃO duplicar informação — sidebar de detalhes não repete logs do Pipeline
- API: REST, prefixo `/api/`
- Agentes: NÃO usar `response_format={"type": "json_object"}` — fazer strip de markdown code blocks antes de json.loads()
- Celery tasks: criar engine asyncpg NOVO por task (nunca usar o global do FastAPI)
- Imagens: salvar em storage, servir via `/storage/`, frontend usa `storageUrl()` helper
- OpenRouter image parsing: suportar TODOS os formatos (list, dict, string, images field com objetos)
- Prompts Gemini: linguagem natural descritiva, NUNCA incluir medidas (px, %, rem) — aparecem na imagem
- Prompts FLUX: linguagem natural rica, SEM negative_prompt (não suporta)
- Security: paths de storage SEMPRE validar com `os.path.realpath` + `startswith` guard
- Security: uploads validar magic bytes, forçar extensão segura, limite 10MB
- Security: erros sanitizados — NUNCA expor stack traces ou detalhes internos ao cliente
- Brand discovery retorna dados em `{"discovered": {...}}` — frontend acessa `.discovered`
- Logo da marca pode ser `data:image/png;base64,...` (data URL) ou path no storage
- Orchestrator `_save_agent_log` é non-fatal (try/except) para não matar pipeline por falha de DB
- OpenRouter model IDs: usar formato OpenRouter (`anthropic/claude-haiku-4.5`), NÃO formato API direta (`claude-haiku-4-5-20251001`)

## Gotchas
- Traefik redireciona HTTP→HTTPS globalmente. Cloudflare SSL deve estar em "Full"
- Vite precisa de `allowedHosts: true` para aceitar qualquer hostname
- CORS: restrito a `FRONTEND_URL` em produção, wildcard só com `DEBUG=true`
- UUID: sempre converter str→uuid.UUID() antes de query no SQLAlchemy
- Celery + asyncpg: cada task cria engine próprio (event loop separado)
- FLUX.2 retorna images como `[{type:"image_url", image_url:{url:"data:..."}}]`
- Gerações travadas: usar `POST /api/generations/{id}/mark-failed` (só running/pending), depois retry
- Retry só funciona para status failed/completed (evitar race condition com tasks paralelas)
- Frontend download cross-origin: precisa endpoint dedicado (atributo `download` do `<a>` não funciona entre portas)
- PipelineContext.from_dict filtra campos desconhecidos para compatibilidade futura
- Orchestrator + task cada um cria engine asyncpg próprio (2 engines por pipeline run)
- Swagger/docs desabilitado em produção (DEBUG=false) — habilitar com `DEBUG=true`
- Auth middleware opt-in: sem `API_SECRET_KEY` configurada = sem auth (modo dev)
- Request body limit global: 15MB (middleware)
- Paginação: max 100 em todos os endpoints de listagem
- Redis e PostgreSQL NÃO expõem portas no host (só rede Docker interna)
- WebSocket e polling NÃO rodam simultaneamente — polling só ativa se WS desconectado
- Botões em forms: SEMPRE usar `type="button"` se não for submit (evitar double submit)

## Credenciais (NÃO committar)
- OpenRouter API Key: nas env vars da stack Portainer (NUNCA no .env.example ou código)
- PostgreSQL: designer / (senha no Portainer) / designer_agent (host: postgres na nelsonNet)
- Portainer Stack ID: 32

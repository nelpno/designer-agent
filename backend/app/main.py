from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db
from app.routers import brands, briefs, generations, gallery, websocket


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialise DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Designer Agent API",
    description="""
## API de Geração de Artes Estáticas com IA

Pipeline de 5 agentes inteligentes que gera artes profissionais automaticamente.

### Pipeline de Agentes
1. **Creative Director** — interpreta o brief e define direção criativa
2. **Prompt Engineer** — traduz a direção em prompts otimizados
3. **Generator** — gera a imagem via OpenRouter (Nano Banana Pro, FLUX.2, etc.)
4. **Reviewer** — avalia qualidade com vision AI (score 0-100)
5. **Refiner** — corrige problemas e refina (loop automático)

### Fluxo básico via API
```
POST /api/brands → criar marca (ou POST /api/brands/discover-and-create)
POST /api/briefs → criar brief com detalhes da arte
POST /api/generations/from-brief/{brief_id} → iniciar geração
GET  /api/generations/{id} → acompanhar status e resultado
WS   /ws/generation/{id} → updates em tempo real
```

### Modelos de Imagem Disponíveis
- **Nano Banana Pro** (google/gemini-3-pro-image-preview) — melhor texto em imagens
- **Nano Banana 2** (google/gemini-3.1-flash-image-preview) — rápido
- **FLUX.2 Pro** (black-forest-labs/flux.2-pro) — fotorrealismo
- **FLUX.2 Flex** (black-forest-labs/flux.2-flex) — flexível
""",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(brands.router)
app.include_router(briefs.router)
app.include_router(generations.router)
app.include_router(gallery.router)
app.include_router(websocket.router)


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

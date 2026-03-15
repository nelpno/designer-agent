import os
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import init_db
from app.routers import brands, briefs, config, generations, gallery, websocket


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan: initialise DB on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Designer Agent API",
    description="API de Geração de Artes Estáticas com IA",
    version="1.4.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)

# --- Security Middlewares ---

# 1. Request body size limit (15MB max)
MAX_BODY_SIZE = 15 * 1024 * 1024

@app.middleware("http")
async def limit_request_body(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_BODY_SIZE:
        return JSONResponse(status_code=413, content={"detail": "Request body too large (max 15MB)"})
    return await call_next(request)


# 2. API Key authentication
@app.middleware("http")
async def require_api_key(request: Request, call_next):
    # Skip auth if no key configured (dev mode) or for health/storage/docs
    if not settings.API_SECRET_KEY:
        return await call_next(request)

    path = request.url.path
    # Public paths that don't need auth
    if path in ("/health", "/docs", "/redoc", "/openapi.json") or path.startswith("/storage/"):
        return await call_next(request)

    # All /api and /ws paths require auth
    if path.startswith("/api") or path.startswith("/ws"):
        key = request.headers.get("X-API-Key") or request.query_params.get("api_key")
        if key != settings.API_SECRET_KEY:
            return JSONResponse(status_code=401, content={"detail": "Unauthorized"})

    return await call_next(request)


# 3. CORS — restrict to known frontend origin
if settings.FRONTEND_URL == "*" or settings.DEBUG:
    allowed_origins = ["*"]
else:
    # Accept both HTTP and HTTPS variants of the configured origin
    base = settings.FRONTEND_URL.rstrip("/")
    allowed_origins = [base]
    if base.startswith("https://"):
        allowed_origins.append(base.replace("https://", "http://", 1))
    elif base.startswith("http://"):
        allowed_origins.append(base.replace("http://", "https://", 1))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# --- Routers ---
app.include_router(brands.router)
app.include_router(briefs.router)
app.include_router(config.router)
app.include_router(generations.router)
app.include_router(gallery.router)
app.include_router(websocket.router)

# Servir arquivos estáticos do storage (imagens geradas)
from fastapi.staticfiles import StaticFiles
storage_path = os.environ.get("STORAGE_PATH", "/app/storage")
os.makedirs(storage_path, exist_ok=True)
app.mount("/storage", StaticFiles(directory=storage_path), name="storage")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.brief import BriefCreate, BriefResponse, BriefUpdate
from app.services import brief_service

router = APIRouter(prefix="/api/briefs", tags=["briefs"], redirect_slashes=False)


@router.post("", response_model=BriefResponse, status_code=status.HTTP_201_CREATED)
async def create_brief(
    data: BriefCreate,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.create_brief(session, data)
    return BriefResponse.model_validate(brief)


@router.get("", response_model=list[BriefResponse])
async def list_briefs(
    skip: int = Query(default=0, ge=0, le=10000),
    limit: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[BriefResponse]:
    briefs = await brief_service.list_briefs(session, skip=skip, limit=limit, status=status)
    return [BriefResponse.model_validate(b) for b in briefs]


class SuggestTextsRequest(BaseModel):
    art_type: str
    platform: str | None = None
    description: str = ""
    slide_count: int = 0


@router.post("/suggest-texts")
async def suggest_texts(request: SuggestTextsRequest):
    """AI suggests headline, body text, and CTA based on description.

    For carousel (slide_count > 0): returns {slides: [{headline, body_text}, ...]}.
    For other types: returns fields based on art_type_config (omits CTA if not applicable).
    """
    from app.providers.openrouter_client import OpenRouterClient
    from app.config import get_settings
    from app.config.art_type_config import get_art_type_config, get_text_fields
    import json, re

    settings = get_settings()
    client = OpenRouterClient()

    try:
        art_type = request.art_type
        platform = request.platform
        description = request.description
        slide_count = request.slide_count

        # Determine which fields to return based on art type config
        config = get_art_type_config(art_type)
        text_field_names = get_text_fields(art_type) if config else ["headline", "body_text", "cta_text"]

        if slide_count > 0:
            # Carousel mode — generate per-slide texts
            system_prompt = f"""Você é um copywriter especialista em marketing digital.
Dado um tipo de arte e uma descrição, sugira textos criativos e persuasivos para um carrossel com {slide_count} slides.

Responda APENAS com JSON válido:
{{
    "slides": [
        {{"headline": "Título do slide (curto, impactante)", "body_text": "Texto de apoio do slide"}},
        ...
    ]
}}

Cada slide deve ter uma mensagem que progride naturalmente (storytelling).
Gere exatamente {slide_count} slides."""
        else:
            # Build dynamic JSON format based on art type config
            field_descriptions = {
                "headline": '"headline": "Título principal (curto, impactante, máx 60 chars)"',
                "body_text": '"body_text": "Texto de apoio (1-2 frases, persuasivo)"',
                "cta_text": '"cta_text": "Call to action (2-4 palavras, ex: Compre Agora, Saiba Mais)"',
            }
            json_fields = ",\n    ".join(
                field_descriptions[f] for f in text_field_names if f in field_descriptions
            )
            system_prompt = f"""Você é um copywriter especialista em marketing digital.
Dado um tipo de arte e uma descrição, sugira textos criativos e persuasivos.

Responda APENAS com JSON válido:
{{
    {json_fields}
}}"""

        user_prompt = f"Tipo de arte: {art_type}\nPlataforma: {platform or 'geral'}\nDescrição: {description}"

        response_text = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8,
            max_tokens=1024,
        )

        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        return json.loads(text)
    except Exception:
        if slide_count > 0:
            return {"slides": [], "error": "Falha ao gerar sugestões."}
        return {"headline": "", "body_text": "", "cta_text": "", "error": "Falha ao gerar sugestões."}
    finally:
        await client.close()


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB

# Magic bytes → safe extension mapping
_MAGIC_BYTES = {
    b'\x89PNG': 'png',
    b'\xff\xd8\xff': 'jpg',
    b'GIF8': 'gif',
}


def _detect_image_type(content: bytes) -> str | None:
    """Detect image type from magic bytes. Returns extension or None."""
    for magic, ext in _MAGIC_BYTES.items():
        if content[:len(magic)] == magic:
            return ext
    # WebP: starts with RIFF....WEBP
    if content[:4] == b'RIFF' and content[8:12] == b'WEBP':
        return 'webp'
    return None


@router.post("/upload-reference")
async def upload_reference(file: UploadFile = File(...)):
    """Upload a reference image and return its URL."""
    import uuid as _uuid
    from pathlib import Path
    from app.config import get_settings

    settings = get_settings()

    # Read with size limit
    content = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande (max 10MB)")

    # Validate actual content type via magic bytes (ignore client Content-Type)
    detected_ext = _detect_image_type(content)
    if not detected_ext:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido. Apenas PNG, JPG, WebP e GIF são aceitos.")

    # Force safe extension from detected type
    ref_id = str(_uuid.uuid4())[:8]
    filename = f"ref_{ref_id}.{detected_ext}"

    save_dir = Path(settings.STORAGE_PATH) / "references"
    save_dir.mkdir(parents=True, exist_ok=True)

    file_path = save_dir / filename
    file_path.write_bytes(content)

    return {"url": f"/storage/references/{filename}", "filename": filename}


@router.post("/upload-inclusion")
async def upload_inclusion(file: UploadFile = File(...)):
    """Upload an inclusion image (asset that MUST appear in the generated art)."""
    import uuid as _uuid
    from pathlib import Path
    from app.config import get_settings

    settings = get_settings()

    # Read with size limit
    content = await file.read(MAX_UPLOAD_SIZE + 1)
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=413, detail="Arquivo muito grande (max 10MB)")

    # Validate actual content type via magic bytes (ignore client Content-Type)
    detected_ext = _detect_image_type(content)
    if not detected_ext:
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido. Apenas PNG, JPG, WebP e GIF são aceitos.")

    # Force safe extension from detected type
    inc_id = str(_uuid.uuid4())[:8]
    filename = f"inc_{inc_id}.{detected_ext}"

    save_dir = Path(settings.STORAGE_PATH) / "inclusions"
    save_dir.mkdir(parents=True, exist_ok=True)

    file_path = save_dir / filename
    file_path.write_bytes(content)

    return {"url": f"/storage/inclusions/{filename}", "filename": filename}


@router.get("/{brief_id}", response_model=BriefResponse)
async def get_brief(
    brief_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.get_brief(session, brief_id)
    if brief is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return BriefResponse.model_validate(brief)


@router.put("/{brief_id}", response_model=BriefResponse)
async def update_brief(
    brief_id: uuid.UUID,
    data: BriefUpdate,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.update_brief(session, brief_id, data)
    if brief is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return BriefResponse.model_validate(brief)


@router.delete("/{brief_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_brief(
    brief_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
):
    deleted = await brief_service.delete_brief(session, brief_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brief not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas.brief import BriefCreate, BriefResponse, BriefUpdate
from app.services import brief_service

router = APIRouter(prefix="/api/briefs", tags=["briefs"])


@router.post("", response_model=BriefResponse, status_code=status.HTTP_201_CREATED)
async def create_brief(
    data: BriefCreate,
    session: AsyncSession = Depends(get_session),
) -> BriefResponse:
    brief = await brief_service.create_brief(session, data)
    return BriefResponse.model_validate(brief)


@router.get("", response_model=list[BriefResponse])
async def list_briefs(
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> list[BriefResponse]:
    briefs = await brief_service.list_briefs(session, skip=skip, limit=limit, status=status)
    return [BriefResponse.model_validate(b) for b in briefs]


@router.post("/suggest-texts")
async def suggest_texts(
    art_type: str,
    platform: str | None = None,
    description: str = "",
):
    """AI suggests headline, body text, and CTA based on description."""
    from app.providers.openrouter_client import OpenRouterClient
    from app.config import get_settings
    import json, re

    settings = get_settings()
    client = OpenRouterClient()

    try:
        system_prompt = """Você é um copywriter especialista em marketing digital.
Dado um tipo de arte e uma descrição, sugira textos criativos e persuasivos.

Responda APENAS com JSON válido:
{
    "headline": "Título principal (curto, impactante, máx 60 chars)",
    "body_text": "Texto de apoio (1-2 frases, persuasivo)",
    "cta_text": "Call to action (2-4 palavras, ex: Compre Agora, Saiba Mais)"
}"""

        user_prompt = f"Tipo de arte: {art_type}\nPlataforma: {platform or 'geral'}\nDescrição: {description}"

        response_text = await client.chat(
            model=settings.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.8,
            max_tokens=500,
        )

        text = response_text.strip()
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\s*', '', text)
            text = re.sub(r'\s*```$', '', text)

        return json.loads(text)
    except Exception as e:
        return {"headline": "", "body_text": "", "cta_text": "", "error": str(e)}
    finally:
        await client.close()


@router.post("/upload-reference")
async def upload_reference(file: UploadFile = File(...)):
    """Upload a reference image and return its URL."""
    import uuid as _uuid
    from pathlib import Path
    from app.config import get_settings

    settings = get_settings()

    # Validate file type
    allowed = {"image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail=f"Tipo de arquivo não permitido: {file.content_type}")

    # Save file
    ref_id = str(_uuid.uuid4())[:8]
    ext = file.filename.split(".")[-1] if file.filename else "png"
    filename = f"ref_{ref_id}.{ext}"

    save_dir = Path(settings.STORAGE_PATH) / "references"
    save_dir.mkdir(parents=True, exist_ok=True)

    file_path = save_dir / filename
    content = await file.read()
    file_path.write_bytes(content)

    return {"url": f"/storage/references/{filename}", "filename": filename}


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

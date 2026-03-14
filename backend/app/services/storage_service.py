from __future__ import annotations

import asyncio
import shutil
from datetime import datetime
from pathlib import Path

from app.config import settings


def get_storage_path() -> Path:
    return Path(settings.STORAGE_PATH)


def _build_generation_dir(generation_id: str, brand_id: str | None = None) -> Path:
    now = datetime.utcnow()
    brand_segment = brand_id if brand_id else "no_brand"
    return (
        get_storage_path()
        / brand_segment
        / str(now.year)
        / f"{now.month:02d}"
        / generation_id
    )


async def save_image(
    image_data: bytes,
    generation_id: str,
    filename: str,
    brand_id: str | None = None,
) -> str:
    """Save raw image bytes and return the relative URL path."""
    gen_dir = _build_generation_dir(generation_id, brand_id)
    await asyncio.to_thread(gen_dir.mkdir, parents=True, exist_ok=True)

    file_path = gen_dir / filename
    await asyncio.to_thread(file_path.write_bytes, image_data)

    # Return relative path from STORAGE_PATH root
    return str(file_path.relative_to(get_storage_path())).replace("\\", "/")


async def save_thumbnail(
    image_data: bytes,
    generation_id: str,
    brand_id: str | None = None,
) -> str:
    """Create a 400px-wide WebP thumbnail and return the relative URL path."""
    def _create_thumbnail(data: bytes, thumb_path: Path) -> None:
        from PIL import Image
        import io

        img = Image.open(io.BytesIO(data))

        # Resize preserving aspect ratio: max width 400px
        max_size = 400
        ratio = max_size / max(img.width, 1)
        if ratio < 1:
            new_width = int(img.width * ratio)
            new_height = int(img.height * ratio)
            img = img.resize((new_width, new_height), Image.LANCZOS)

        thumb_buffer = io.BytesIO()
        img.save(thumb_buffer, format="WEBP", quality=80)
        thumb_path.write_bytes(thumb_buffer.getvalue())

    gen_dir = _build_generation_dir(generation_id, brand_id)
    await asyncio.to_thread(gen_dir.mkdir, parents=True, exist_ok=True)

    thumb_path = gen_dir / "thumbnail.webp"

    try:
        await asyncio.to_thread(_create_thumbnail, image_data, thumb_path)
    except Exception:
        # Pillow not available or PIL error — store original bytes under thumbnail name
        await asyncio.to_thread(thumb_path.write_bytes, image_data)

    return str(thumb_path.relative_to(get_storage_path())).replace("\\", "/")


async def delete_generation_files(generation_id: str) -> None:
    """Delete all files stored for a given generation across all brand/date paths."""
    storage_root = get_storage_path()
    # Walk the full tree and remove any directory named after the generation_id
    for candidate in storage_root.rglob(generation_id):
        if candidate.is_dir():
            shutil.rmtree(candidate, ignore_errors=True)

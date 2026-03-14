import asyncio
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.generation import Generation

router = APIRouter()


@router.websocket("/ws/generation/{generation_id}")
async def generation_websocket(websocket: WebSocket, generation_id: str):
    """WebSocket endpoint that streams generation status updates to the client."""
    await websocket.accept()

    try:
        generation_uuid = uuid.UUID(generation_id)
    except ValueError:
        await websocket.close(code=4000)
        return

    try:
        while True:
            # Poll generation status from database
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(Generation).where(Generation.id == generation_uuid)
                )
                generation = result.scalar_one_or_none()

                if generation:
                    status_data = {
                        "status": generation.status,
                        "pipeline_context": generation.pipeline_context,
                        "final_image_url": generation.final_image_url,
                        "final_score": generation.final_score,
                        "model_used": generation.model_used,
                        "iterations_used": generation.iterations_used,
                        "error_message": generation.error_message,
                    }
                    await websocket.send_json(status_data)

                    if generation.status in ("completed", "failed"):
                        break

            await asyncio.sleep(2)  # Poll every 2 seconds

    except WebSocketDisconnect:
        pass

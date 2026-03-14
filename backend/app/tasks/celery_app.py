from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "designer_agent",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_track_started=True,
    task_time_limit=300,  # 5 min max per task
    task_soft_time_limit=240,
    worker_prefetch_multiplier=1,
)

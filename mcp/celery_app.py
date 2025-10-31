"""
File: mcp/celery_app.py
Purpose: Celery application configuration (broker/backend via Redis).
Notes: Keep imports minimal; worker module listed in celery_app.conf.imports.
"""
import os
from celery import Celery


REDIS_URL = os.environ.get('REDIS_URL', 'redis://redis:6379/0')
celery_app = Celery('imposter', broker=REDIS_URL, backend=REDIS_URL)
celery_app.conf.imports = ('worker',)

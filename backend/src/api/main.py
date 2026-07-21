from fastapi import FastAPI

from src.api.health import router as health_router

app = FastAPI(title="EvalOps Backend")
app.include_router(health_router)

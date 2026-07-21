from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from src.application.errors import ErrorCodeError
from src.api.health import router as health_router
from src.api.routers.dataset_router import router as dataset_router
from src.api.routers.evaluation_case_router import router as evaluation_case_router
from src.api.routers.project_router import router as project_router
from src.api.routers.dataset_version_router import router as dataset_version_router
from src.api.routers.target_router import router as target_router

app = FastAPI(title="EvalOps Backend")
app.include_router(health_router)
app.include_router(project_router, prefix="/api/v1")
app.include_router(dataset_router, prefix="/api/v1")
app.include_router(evaluation_case_router, prefix="/api/v1")
app.include_router(dataset_version_router, prefix="/api/v1")
app.include_router(target_router, prefix="/api/v1")


@app.exception_handler(ErrorCodeError)
async def error_code_exception_handler(_: Request, exc: ErrorCodeError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc), "details": exc.details}},
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "HTTP_ERROR", "message": exc.detail, "details": None}},
    )

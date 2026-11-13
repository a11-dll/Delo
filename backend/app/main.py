from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes.documents import ensure_storage, router


@asynccontextmanager
async def lifespan(_app: FastAPI):
    ensure_storage()
    yield


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


app.include_router(router)

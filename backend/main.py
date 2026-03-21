from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import analysis
from database import init_db
from routers import analysis, scanner


app = FastAPI(title="BenderEdge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analysis.router, prefix="/api")

@app.on_event("startup")
async def startup():
    init_db()

app.include_router(scanner.router, prefix="/api")

@app.get("/")
def health():
    return {"status": "ok", "model": "qwen2.5:7b"}
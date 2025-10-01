from fastapi import FastAPI
from app.api.routes import repos, query

app = FastAPI(
    title="Codebase Comprehender",
    description="API for ingesting and querying codebases",
    version="0.1.0"
)

# Register routes
app.include_router(repos.router, prefix="/repos", tags=["Repositories"])
app.include_router(query.router, prefix="/query", tags=["Queries"])

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Codebase Comprehender API running"}

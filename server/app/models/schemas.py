from pydantic import BaseModel

class RepoRequest(BaseModel):
    github_url: str

class QueryRequest(BaseModel):
    repo_id: str
    query: str
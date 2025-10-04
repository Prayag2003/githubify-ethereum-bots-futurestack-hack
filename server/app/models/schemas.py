from pydantic import BaseModel, Field
from typing import Optional

class RepoRequest(BaseModel):
    github_url: str = Field(..., description="GitHub repository URL")
    token: Optional[str] = None

class QueryRequest(BaseModel):
    repo_id: str = Field(..., description="Repository ID")
    query: str = Field(..., description="Question about the codebase")
    mode: str = Field("fast", description="fast or accurate")
from pydantic import BaseModel, Field

class RepoRequest(BaseModel):
    github_url: str = Field(..., description="GitHub repository URL")

class QueryRequest(BaseModel):
    repo_id: str = Field(..., description="Repository ID")
    query: str = Field(..., description="Question about the codebase")
    mode: str = Field("fast", description="fast or accurate")
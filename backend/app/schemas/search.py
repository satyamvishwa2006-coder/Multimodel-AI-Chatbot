from typing import List
from pydantic import BaseModel, Field
from app.schemas.conversation import SourceCitation


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    max_results: int = 5


class SearchResponse(BaseModel):
    query: str
    results: List[SourceCitation] = []
    provider: str

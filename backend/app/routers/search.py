from fastapi import APIRouter
from app.schemas.search import SearchRequest, SearchResponse
from app.services.web_search_service import WebSearchService

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.post("", response_model=SearchResponse)
async def perform_search(payload: SearchRequest):
    """Executes a web search query."""
    data = await WebSearchService.search(query=payload.query, max_results=payload.max_results)
    return SearchResponse(
        query=data.get("query", payload.query),
        results=data.get("results", []),
        provider=data.get("provider", "mock"),
    )

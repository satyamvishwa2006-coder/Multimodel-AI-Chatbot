import logging
from typing import List, Dict, Any
import httpx
from app.core.config import settings

logger = logging.getLogger("uvicorn.error")


class WebSearchService:
    @staticmethod
    async def search(query: str, max_results: int = 5) -> Dict[str, Any]:
        """
        Executes web search using Tavily if API key is configured,
        or uses DuckDuckGo / fallback mock search.
        """
        clean_query = query.strip()
        if not clean_query:
            return {"query": clean_query, "results": [], "provider": "none"}

        # 1. Tavily API Search
        if settings.TAVILY_API_KEY:
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": settings.TAVILY_API_KEY,
                            "query": clean_query,
                            "search_depth": "basic",
                            "include_answer": False,
                            "max_results": max_results,
                        }
                    )
                    if resp.status_code == 200:
                        data = resp.json()
                        results = [
                            {
                                "title": item.get("title", "Untitled"),
                                "url": item.get("url", ""),
                                "snippet": item.get("content", ""),
                            }
                            for item in data.get("results", [])
                        ]
                        return {"query": clean_query, "results": results, "provider": "tavily"}
                    else:
                        logger.warning(f"Tavily search failed with status {resp.status_code}")
            except Exception as e:
                logger.error(f"Error querying Tavily: {e}")

        # 2. Free DuckDuckGo search fallback via public API / instant answers
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                ddg_url = f"https://api.duckduckgo.com/?q={clean_query}&format=json&no_html=1&skip_disambig=1"
                resp = await client.get(ddg_url)
                if resp.status_code == 200:
                    data = resp.json()
                    results = []
                    abstract = data.get("AbstractText")
                    source_url = data.get("AbstractURL")
                    source_title = data.get("Heading") or clean_query
                    if abstract and source_url:
                        results.append({
                            "title": source_title,
                            "url": source_url,
                            "snippet": abstract,
                        })
                    for topic in data.get("RelatedTopics", [])[:max_results - len(results)]:
                        if isinstance(topic, dict) and topic.get("Text") and topic.get("FirstURL"):
                            results.append({
                                "title": topic.get("Text")[:60] + "...",
                                "url": topic.get("FirstURL"),
                                "snippet": topic.get("Text"),
                            })
                    if results:
                        return {"query": clean_query, "results": results, "provider": "duckduckgo"}
        except Exception as ddg_err:
            logger.warning(f"DuckDuckGo search error: {ddg_err}")

        # 3. Informative fallback when no keys are provided
        fallback_results = [
            {
                "title": f"Web Overview: {clean_query}",
                "url": f"https://en.wikipedia.org/wiki/Special:Search?search={clean_query.replace(' ', '+')}",
                "snippet": f"Web exploration results for '{clean_query}'. Note: Configure TAVILY_API_KEY in .env for live real-time web crawling.",
            }
        ]
        return {"query": clean_query, "results": fallback_results, "provider": "fallback"}

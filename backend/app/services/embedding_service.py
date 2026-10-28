import abc
import hashlib
import math
from typing import List
from app.core.config import settings


class BaseEmbeddingProvider(abc.ABC):
    @abc.abstractmethod
    def embed_text(self, text: str) -> List[float]:
        """Generate embedding vector for a single string."""
        pass

    @abc.abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a list of strings."""
        pass


class MockDeterministicEmbeddingProvider(BaseEmbeddingProvider):
    """
    Generates a deterministic 1536-dimensional normalized float vector from text.
    Provides offline testing where identical/similar texts produce mathematically consistent embeddings.
    """
    def __init__(self, dimension: int = 1536):
        self.dimension = dimension

    def embed_text(self, text: str) -> List[float]:
        clean_text = (text or "").strip().lower()
        words = clean_text.split()
        vector = [0.0] * self.dimension

        if not words:
            vector[0] = 1.0
            return vector

        # Hash words and character bigrams into vector coordinates
        for idx, word in enumerate(words):
            h = int(hashlib.sha256(word.encode("utf-8")).hexdigest(), 16)
            pos = h % self.dimension
            weight = 1.0 / (1.0 + idx * 0.05)
            vector[pos] += weight

            # Bigrams
            if len(word) > 2:
                for b in range(len(word) - 1):
                    bh = int(hashlib.md5(word[b:b+2].encode("utf-8")).hexdigest(), 16)
                    vector[bh % self.dimension] += 0.25

        # L2 Normalize vector
        norm = math.sqrt(sum(x * x for x in vector))
        if norm > 0:
            return [x / norm for x in vector]
        return [1.0 / math.sqrt(self.dimension)] * self.dimension

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.embed_text(t) for t in texts]


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    def __init__(self, api_key: str, model: str = "text-embedding-3-small"):
        from openai import OpenAI
        self.client = OpenAI(api_key=api_key)
        self.model = model

    def embed_text(self, text: str) -> List[float]:
        response = self.client.embeddings.create(
            input=[text],
            model=self.model,
        )
        return response.data[0].embedding

    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []
        response = self.client.embeddings.create(
            input=texts,
            model=self.model,
        )
        return [d.embedding for d in response.data]


def get_embedding_provider() -> BaseEmbeddingProvider:
    provider = settings.EMBEDDING_PROVIDER.lower().strip()
    if provider == "openai" and settings.OPENAI_API_KEY:
        return OpenAIEmbeddingProvider(
            api_key=settings.OPENAI_API_KEY,
            model=settings.OPENAI_EMBEDDING_MODEL
        )
    return MockDeterministicEmbeddingProvider(dimension=settings.EMBEDDING_DIMENSION)

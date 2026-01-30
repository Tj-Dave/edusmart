from pydantic import BaseModel
from typing import List, Dict

class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    query: str
    bloom_level: str
    prompt: str
    response: str

class IngestResponse(BaseModel):
    query: str
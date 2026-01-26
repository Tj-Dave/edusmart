from pydantic import BaseModel


class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    query: str
    bloom_level: str
    competency: str
    response: str

class IngestResponse(BaseModel):
    query: str
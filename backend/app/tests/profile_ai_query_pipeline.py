#!/usr/bin/env python3
"""
AI Query Pipeline Profiler
Measures timing of each step in the query processing pipeline
"""
import time
import sys
from pathlib import Path
from uuid import uuid4
from dataclasses import dataclass, field
from typing import Optional

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.core.config import settings
from app.services.bloom_detector import BloomDetector
from app.services.competency_mapper import CompetencyMapper
from app.services.rag_engine import RAGEngine
from app.services.prompt_engine import PromptEngine
from app.services.llm.llama_cpp_client import LLMClient
from app.services.embedder.e5_embedder import E5Embedder
from app.db.vector_store import VectorStore


@dataclass
class PipelineMetrics:
    """Stores timing metrics for each pipeline step"""
    session_fetch: float = 0.0
    store_user_msg: float = 0.0
    memory_context: float = 0.0
    bloom_detection: float = 0.0
    competency_mapping: float = 0.0
    rag_retrieval: float = 0.0
    prompt_building: float = 0.0
    llm_generation: float = 0.0
    store_assistant_msg: float = 0.0
    memory_summarize: float = 0.0
    total: float = 0.0
    
    def print_report(self):
        """Print formatted timing report"""
        print("\n" + "="*60)
        print("AI QUERY PIPELINE PROFILING REPORT")
        print("="*60)
        print(f"{'Step':<30} {'Time (s)':<12} {'%':<8}")
        print("-"*60)
        
        steps = [
            ("Session Fetch", self.session_fetch),
            ("Store User Message", self.store_user_msg),
            ("Memory Context Build", self.memory_context),
            ("Bloom Detection", self.bloom_detection),
            ("Competency Mapping", self.competency_mapping),
            ("RAG Retrieval", self.rag_retrieval),
            ("Prompt Building", self.prompt_building),
            ("LLM Generation", self.llm_generation),
            ("Store Assistant Message", self.store_assistant_msg),
            ("Memory Summarization", self.memory_summarize),
        ]
        
        for name, duration in steps:
            pct = (duration / self.total * 100) if self.total > 0 else 0
            print(f"{name:<30} {duration:>10.4f}  {pct:>6.2f}%")
        
        print("-"*60)
        print(f"{'TOTAL PIPELINE TIME':<30} {self.total:>10.4f}")
        print("="*60 + "\n")


class PipelineProfiler:
    """Profiles the AI query pipeline without database dependencies"""
    
    def __init__(self):
        print("Initializing pipeline components...")
        self.embedder = E5Embedder()
        self.bloom_detector = BloomDetector()
        self.competency_mapper = CompetencyMapper(self.embedder)
        self.vector_store = VectorStore()
        self.rag_engine = RAGEngine(self.vector_store, self.embedder)
        self.llm_client = LLMClient()
        print("✓ All components initialized\n")
    
    def profile_query(self, query: str, course_id: str = "test_course") -> PipelineMetrics:
        """Profile a single query through the pipeline"""
        metrics = PipelineMetrics()
        start_total = time.perf_counter()
        
        print(f"Profiling query: '{query[:60]}...'")
        print("-"*60)
        
        # Step 0: Session fetch (simulated)
        start = time.perf_counter()
        session_id = uuid4()
        user_id = "test_user"
        metrics.session_fetch = time.perf_counter() - start
        print(f"✓ Session fetch: {metrics.session_fetch:.4f}s")
        
        # Step 1: Store user message (simulated)
        start = time.perf_counter()
        # In real pipeline: crud_chats.append_message()
        time.sleep(0.001)  # Simulate DB write
        metrics.store_user_msg = time.perf_counter() - start
        print(f"✓ Store user message: {metrics.store_user_msg:.4f}s")
        
        # Step 2: Memory context (simulated)
        start = time.perf_counter()
        memory_block = ""  # Simulated empty memory
        metrics.memory_context = time.perf_counter() - start
        print(f"✓ Memory context: {metrics.memory_context:.4f}s")
        
        # Step 3: Bloom detection
        start = time.perf_counter()
        bloom_level = self.bloom_detector.detect(query)
        metrics.bloom_detection = time.perf_counter() - start
        print(f"✓ Bloom detection: {metrics.bloom_detection:.4f}s → {bloom_level}")
        
        # Step 4: Competency mapping
        start = time.perf_counter()
        competency = self.competency_mapper.map(query)
        metrics.competency_mapping = time.perf_counter() - start
        print(f"✓ Competency mapping: {metrics.competency_mapping:.4f}s → {len(competency)} matches")
        
        # Step 5: RAG retrieval
        start = time.perf_counter()
        try:
            context_chunks = self.rag_engine.retrieve(query, course_id=course_id)
        except Exception as e:
            print(f"  ⚠ RAG retrieval failed: {e}")
            context_chunks = []
        metrics.rag_retrieval = time.perf_counter() - start
        print(f"✓ RAG retrieval: {metrics.rag_retrieval:.4f}s → {len(context_chunks)} chunks")
        
        # Step 6: Prompt building
        start = time.perf_counter()
        final_prompt = PromptEngine.build_prompt(
            query=query,
            bloom_level=bloom_level,
            competency=competency,
            context=context_chunks,
            memory=memory_block,
        )
        metrics.prompt_building = time.perf_counter() - start
        print(f"✓ Prompt building: {metrics.prompt_building:.4f}s → {len(final_prompt)} chars")
        
        # Step 7: LLM generation
        start = time.perf_counter()
        response_text = self.llm_client.generate(final_prompt)
        metrics.llm_generation = time.perf_counter() - start
        print(f"✓ LLM generation: {metrics.llm_generation:.4f}s → {len(response_text)} chars")
        
        # Step 8: Store assistant message (simulated)
        start = time.perf_counter()
        time.sleep(0.001)  # Simulate DB write
        metrics.store_assistant_msg = time.perf_counter() - start
        print(f"✓ Store assistant message: {metrics.store_assistant_msg:.4f}s")
        
        # Step 9: Memory summarization (simulated)
        start = time.perf_counter()
        # In real pipeline: memory_manager.maybe_summarize()
        metrics.memory_summarize = time.perf_counter() - start
        print(f"✓ Memory summarization: {metrics.memory_summarize:.4f}s")
        
        metrics.total = time.perf_counter() - start_total
        return metrics


def main():
    """Run profiling tests"""
    test_queries = [
        "What is photosynthesis?",
        "Explain how to solve quadratic equations",
        "Compare democracy and autocracy",
        "Design a water filtration system for rural communities",
    ]
    
    profiler = PipelineProfiler()
    all_metrics = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'='*60}")
        print(f"TEST {i}/{len(test_queries)}")
        print(f"{'='*60}")
        
        metrics = profiler.profile_query(query)
        all_metrics.append(metrics)
        metrics.print_report()
    
    # Summary statistics
    if len(all_metrics) > 1:
        print("\n" + "="*60)
        print("AGGREGATE STATISTICS")
        print("="*60)
        
        avg_total = sum(m.total for m in all_metrics) / len(all_metrics)
        avg_llm = sum(m.llm_generation for m in all_metrics) / len(all_metrics)
        avg_rag = sum(m.rag_retrieval for m in all_metrics) / len(all_metrics)
        avg_bloom = sum(m.bloom_detection for m in all_metrics) / len(all_metrics)
        avg_comp = sum(m.competency_mapping for m in all_metrics) / len(all_metrics)
        
        print(f"Average Total Time:      {avg_total:.4f}s")
        print(f"Average LLM Generation:  {avg_llm:.4f}s ({avg_llm/avg_total*100:.1f}%)")
        print(f"Average RAG Retrieval:   {avg_rag:.4f}s ({avg_rag/avg_total*100:.1f}%)")
        print(f"Average Bloom Detection: {avg_bloom:.4f}s ({avg_bloom/avg_total*100:.1f}%)")
        print(f"Average Competency Map:  {avg_comp:.4f}s ({avg_comp/avg_total*100:.1f}%)")
        print("="*60 + "\n")


if __name__ == "__main__":
    main()

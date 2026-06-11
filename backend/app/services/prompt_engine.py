from typing import List, Dict
from typing import Any

class PromptEngine:
    """Builds structured prompts for LLM based on pedagogical context"""
    
    @staticmethod
    def build_prompt(query: str, bloom_level: str, competency: List[Dict], context: List[str], memory: str) -> str:
        """Build optimized prompt aligned with CBC values and pedagogical best practices"""
        
        # Format competencies concisely
        comp_text = PromptEngine._format_competencies(competency)
        
        # Format context efficiently
        ctx_text = "\n".join(context[:3]) if context and context != ["no context"] else "No context available"
        
        # Format memory if present
        mem_text = f"\nPrevious context: {memory[:150]}..." if memory and memory.strip() else ""
        
        # Build CBC-aligned prompt
        return f"""You are EduScape AI, an AI Education assistant, aligned with Uganda's Competency-Based Curriculum (CBC) to assist develop critical thinkers, creative problem-solvers, and responsible citizens.

TASK: {PromptEngine._get_bloom_instruction(bloom_level)}
COMPETENCIES: {comp_text}
CONTEXT: {ctx_text}{mem_text}

QUERY: {query}

Provide a clear, pedagogically sound response that:
• Matches the {bloom_level} cognitive level
• Develops CBC competencies through practical examples
• Connects learning to real-world applications
• Encourages critical thinking and problem-solving
• Does not directly answer the question, but guides the student to discover the answer themselves through hints and explanations.

Do not Justify your response and how it links to the bloom level and competencies. Focus on providing a helpful, student-friendly answer that fosters learning and curiosity without directly answering the question.

Response:"""

    @staticmethod
    def build_harag_prompt(
        *,
        query: str,
        bloom_level: str,
        competency: List[Dict] | None,
        harag_package: Any,
        memory: str,
    ) -> tuple[str, dict]:
        """Build a structured prompt from the HA-RAG retrieval package."""
        comp_text = PromptEngine._format_competencies(competency or [])
        summaries = getattr(harag_package, "summaries", []) or []
        parents = getattr(harag_package, "parents", []) or []

        summary_lines = []
        for idx, summary in enumerate(summaries[:4], start=1):
            summary_lines.append(f"S{idx}. {summary.h1_title}: {summary.summary_text}")

        evidence_lines = []
        citation_lines = []
        for idx, parent in enumerate(parents[:4], start=1):
            anchor = parent.citation_anchor or {}
            title = anchor.get("title") or anchor.get("h1") or f"Parent {idx}"
            evidence_lines.append(f"P{idx} [{title}]\n{parent.text}")
            citation_lines.append(
                f"P{idx}: document={parent.document_id}, parent={parent.parent_id}, heading={title}, score={parent.score}"
            )

        mem_text = f"\nPrevious conversation context:\n{memory[:800]}" if memory and memory.strip() else ""
        prompt = f"""You are EduScape AI, an AI education assistant aligned with Uganda's Competency-Based Curriculum (CBC).

Bloom task: {PromptEngine._get_bloom_instruction(bloom_level)}
CBC competencies: {comp_text}

H1 summary context:
{chr(10).join(summary_lines) if summary_lines else "No H1 summaries retrieved."}

Parent chunk evidence:
{chr(10).join(evidence_lines) if evidence_lines else "No lecturer document evidence retrieved."}

Citation anchors:
{chr(10).join(citation_lines) if citation_lines else "No citation anchors available."}{mem_text}

Student query:
{query}

Respond in a student-friendly way. Use the parent chunk evidence as the grounding source when it is relevant. Guide the student with explanations, hints, and practical examples instead of simply giving a bare answer. If the evidence is insufficient, say what is missing rather than inventing details.

Response:"""
        trace = {
            "summary_count": len(summaries),
            "parent_count": len(parents),
            "citation_anchors": citation_lines,
            "prompt_preview": prompt[:2000],
        }
        return prompt, trace
    
    @staticmethod
    def _format_competencies(competency: List[Dict]) -> str:
        """Extract high-confidence competencies"""
        if not competency:
            return "General CBC learning support"
        
        high_conf = [c['value'] for c in competency if c.get('confidence', 0) > 0.75]
        return ", ".join(high_conf[:2]) if high_conf else "General CBC learning support"
    
    @staticmethod
    def _get_bloom_instruction(bloom_level: str) -> str:
        """Get Bloom's level-specific instruction"""
        instructions = {
            'Remember': 'Help recall key facts and concepts',
            'Understand': 'Explain concepts with clear examples',
            'Apply': 'Guide practical problem-solving',
            'Analyze': 'Break down and examine relationships',
            'Evaluate': 'Support critical assessment',
            'Create': 'Facilitate synthesis of new ideas'
        }
        return instructions.get(bloom_level, 'Provide educational support')

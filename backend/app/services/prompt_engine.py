from typing import List, Dict

class PromptEngine:
    """Builds structured prompts for LLM based on pedagogical context"""
    
    @staticmethod
    def build_prompt(query: str, bloom_level: str, competency: List[Dict], context: List[str]) -> str:
        """Build final prompt incorporating all pipeline components"""
        
        # Extract competency values and format them (only confidence > 0.8)
        if competency:
            high_confidence_competencies = [c for c in competency if c.get('confidence', 0) > 0.8]
            if high_confidence_competencies:
                competency_list = [f"{c['value']} (confidence: {c['confidence']})" for c in high_confidence_competencies]
                competency_text = "\n- ".join(competency_list)
                competency_text = "- " + competency_text
            else:
                competency_text = "- General Learning Support"
        else:
            competency_text = "- General Learning Support"
        
        # Format context
        context_text = "\n".join(context) if context and context != ["no context"] else "No specific context available."
        
        # Build structured prompt
        prompt = f"""You are an AI learning assistant aligned with Uganda's Competency-Based Curriculum (CBC).

COGNITIVE LEVEL: {bloom_level}
RELEVANT COMPETENCIES:
{competency_text}

CONTEXT:
{context_text}

STUDENT QUERY: {query}

Provide a clear, pedagogically appropriate response that:
1. Addresses the {bloom_level} cognitive level
2. Supports development of the identified competencies
3. Uses the provided context when relevant
4. Is educational and curriculum-aligned

Response:"""
        
        return prompt
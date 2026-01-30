from typing import List, Dict

class PromptEngine:
    """Builds structured prompts for LLM based on pedagogical context"""
    
    @staticmethod
    def build_prompt(query: str, bloom_level: str, competency: List[Dict], context: List[str]) -> str:
        """Build final prompt incorporating all pipeline components"""
        
        # Get top competency for focus
        top_competency = competency[2]['value'] if competency else "General Learning"
        
        # Format context
        context_text = "\n".join(context) if context and context != ["no context"] else "No specific context available."
        
        # Build structured prompt
        prompt = f"""You are an AI learning assistant aligned with Uganda's Competency-Based Curriculum (CBC).

COGNITIVE LEVEL: {bloom_level}
PRIMARY COMPETENCY: {top_competency}

CONTEXT:
{context_text}

STUDENT QUERY: {query}

Provide a clear, pedagogically appropriate response that:
1. Addresses the {bloom_level} cognitive level
2. Supports development of {top_competency}
3. Uses the provided context when relevant
4. Is educational and curriculum-aligned

Response:"""
        
        return prompt
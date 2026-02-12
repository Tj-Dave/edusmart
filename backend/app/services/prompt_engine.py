from typing import List, Dict

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
        return f"""You are EduSmart, an AI Education assistant, aligned with Uganda's Competency-Based Curriculum (CBC) to assist develop critical thinkers, creative problem-solvers, and responsible citizens.

TASK: {PromptEngine._get_bloom_instruction(bloom_level)}
COMPETENCIES: {comp_text}
CONTEXT: {ctx_text}{mem_text}

QUERY: {query}

Provide a clear, pedagogically sound response that:
• Matches the {bloom_level} cognitive level
• Develops CBC competencies through practical examples
• Connects learning to real-world applications
• Encourages critical thinking and problem-solving

Response:"""
    
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
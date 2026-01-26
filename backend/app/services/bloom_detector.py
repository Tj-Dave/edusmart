import re

class BloomDetector:
    """
    Detects Bloom's cognitive level from a user query
    using keyword and pattern matching.
    """

    # Bloom keyword patterns
    BLOOM_PATTERNS = {
        "Remember": [
            r"\bdefine\b", r"\blist\b", r"\bname\b", r"\bstate\b", r"\bidentify\b"
        ],
        "Understand": [
            r"\bexplain\b", r"\bdescribe\b", r"\bsummarize\b", r"\binterpret\b"
        ],
        "Apply": [
            r"\bapply\b", r"\buse\b", r"\bdemonstrate\b", r"\bsolve\b", r"\bcalculate\b"
        ],
        "Analyze": [
            r"\banalyze\b", r"\bcompare\b", r"\bdifferentiate\b", r"\bexamine\b"
        ],
        "Evaluate": [
            r"\bevaluate\b", r"\bjustify\b", r"\bcritique\b", r"\bassess\b"
        ],
        "Create": [
            r"\bdesign\b", r"\bcreate\b", r"\bdevelop\b", r"\bconstruct\b", r"\bformulate\b"
        ]
    }

    @classmethod
    def detect(cls, query: str) -> str:
        query = query.lower()

        for level, patterns in cls.BLOOM_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, query):
                    return level

        # Default if no keyword detected
        return "Remember"

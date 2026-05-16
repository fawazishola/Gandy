"""
Shared types for verification frameworks
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional


@dataclass
class VerificationResult:
    """Result of a verification check"""
    status: str  # "passed" or "failed"
    message: str
    details: Dict[str, Any]
    counterexample: Optional[Dict[str, Any]] = None


def validate_verification_result(result: Any) -> bool:
    """Validate that result matches VerificationResult structure"""
    if not isinstance(result, dict):
        return False
    required_fields = {'status', 'message', 'details'}
    return all(field in result for field in required_fields)


def ensure_verification_result(result: Any) -> Dict[str, Any]:
    """Ensure result is a valid verification result dict"""
    if validate_verification_result(result):
        return result
    return {
        "status": "failed",
        "message": "Invalid verification result format",
        "details": {"original_result": str(result)},
        "counterexample": None
    }

# Made with Bob

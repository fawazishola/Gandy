"""
Bob Shell Output Parser
Parses Bob's stdout into structured formats: JSON, SMT2, or Solidity
"""

import json
import re
from dataclasses import dataclass
from typing import Optional, Dict, Any, Literal


@dataclass
class ParsedOutput:
    """Structured representation of parsed Bob output"""
    type: Literal["json", "smt2", "solidity", "text", "unknown"]
    content: Any  # Parsed content (dict for JSON, str for others)
    raw: str  # Original stdout
    valid: bool  # Whether parsing succeeded
    error: Optional[str] = None  # Error message if parsing failed


def parse(stdout: str) -> ParsedOutput:
    """
    Parse Bob Shell stdout and detect format type.
    
    Args:
        stdout: Raw stdout string from Bob
        
    Returns:
        ParsedOutput dataclass with parsed content and metadata
    """
    if not stdout or not stdout.strip():
        return ParsedOutput(
            type="unknown",
            content=None,
            raw=stdout,
            valid=False,
            error="Empty output"
        )
    
    stdout_stripped = stdout.strip()
    
    # Try JSON first (most common structured output)
    if stdout_stripped.startswith('{') or stdout_stripped.startswith('['):
        try:
            content = json.loads(stdout_stripped)
            return ParsedOutput(
                type="json",
                content=content,
                raw=stdout,
                valid=True
            )
        except json.JSONDecodeError as e:
            return ParsedOutput(
                type="json",
                content=None,
                raw=stdout,
                valid=False,
                error=f"Invalid JSON: {str(e)}"
            )
    
    # Check for SMT2 format
    smt2_indicators = [
        r'\(set-logic\s+',
        r'\(declare-fun\s+',
        r'\(declare-const\s+',
        r'\(assert\s+',
        r'\(check-sat\)',
        r'\(get-model\)'
    ]
    
    if any(re.search(pattern, stdout, re.IGNORECASE) for pattern in smt2_indicators):
        # Validate basic SMT2 structure
        if '(set-logic' in stdout.lower() or '(declare-' in stdout.lower():
            return ParsedOutput(
                type="smt2",
                content=stdout_stripped,
                raw=stdout,
                valid=True
            )
        else:
            return ParsedOutput(
                type="smt2",
                content=stdout_stripped,
                raw=stdout,
                valid=False,
                error="Incomplete SMT2 specification"
            )
    
    # Check for Solidity code
    solidity_indicators = [
        r'pragma\s+solidity\s+[\^~>=<]*\d+\.\d+\.\d+',
        r'contract\s+\w+\s*\{',
        r'function\s+\w+\s*\(',
        r'mapping\s*\(',
        r'event\s+\w+\s*\('
    ]
    
    if any(re.search(pattern, stdout, re.IGNORECASE) for pattern in solidity_indicators):
        # Validate basic Solidity structure
        if re.search(r'pragma\s+solidity', stdout, re.IGNORECASE):
            return ParsedOutput(
                type="solidity",
                content=stdout_stripped,
                raw=stdout,
                valid=True
            )
        else:
            return ParsedOutput(
                type="solidity",
                content=stdout_stripped,
                raw=stdout,
                valid=False,
                error="Missing pragma directive"
            )
    
    # Default to text
    return ParsedOutput(
        type="text",
        content=stdout_stripped,
        raw=stdout,
        valid=True
    )


def extract_game_model(stdout: str) -> Optional[Dict[str, Any]]:
    """
    Extract game theory model from Bob output.
    
    Looks for JSON with game theory fields: players, strategies, payoff_matrix, etc.
    
    Args:
        stdout: Raw stdout from Bob
        
    Returns:
        Dict containing game model, or None if not found/invalid
    """
    parsed = parse(stdout)
    
    if parsed.type != "json" or not parsed.valid:
        return None
    
    content = parsed.content
    
    # Check if it's a game theory model
    game_theory_fields = {'players', 'strategies', 'payoff_matrix', 'payoff_structure', 'matrix'}
    
    candidates = []
    
    if isinstance(content, dict):
        # Check if it has game theory structure
        if any(field in content for field in game_theory_fields):
            if _validate_game_model(content):
                candidates.append((content, _count_game_fields(content)))
        
        # Check nested structures
        for key, value in content.items():
            if isinstance(value, dict) and any(field in value for field in game_theory_fields):
                if _validate_game_model(value):
                    candidates.append((value, _count_game_fields(value)))
    
    # Return most complete model
    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]
    
    return None


def _validate_game_model(model: Dict[str, Any]) -> bool:
    """Validate game model has required structure"""
    if 'players' not in model:
        return False
    if not isinstance(model['players'], list) or len(model['players']) < 2:
        return False
    if 'strategies' not in model:
        return False
    # Accept strategies as list or dict
    if not isinstance(model['strategies'], (list, dict)):
        return False
    # Accept 'matrix' or 'payoff_matrix'
    if 'payoff_matrix' not in model and 'matrix' not in model:
        return False
    return True


def _count_game_fields(model: Dict[str, Any]) -> int:
    """Count how many game theory fields are present"""
    game_theory_fields = {'players', 'strategies', 'payoff_matrix', 'payoff_structure', 'dominant_strategies'}
    return sum(1 for field in game_theory_fields if field in model)


def extract_z3_spec(stdout: str) -> Optional[str]:
    """
    Extract Z3 SMT2 specification from Bob output.
    
    Args:
        stdout: Raw stdout from Bob
        
    Returns:
        SMT2 specification string, or None if not found/invalid
    """
    parsed = parse(stdout)
    
    if parsed.type != "smt2":
        # Try to find SMT2 code blocks in text
        smt2_pattern = r'```(?:smt2|smtlib)?\s*(.*?)```'
        matches = re.findall(smt2_pattern, stdout, re.DOTALL | re.IGNORECASE)
        
        if matches:
            spec = matches[0].strip()
            if _validate_smt2_spec(spec):
                return spec
        return None
    
    if not parsed.valid:
        return None
    
    spec = parsed.content
    if not _validate_smt2_spec(spec):
        return None
    
    return spec


def _validate_smt2_spec(spec: str) -> bool:
    """Validate SMT2 spec has minimum required elements"""
    if not spec or not spec.strip():
        return False
    # Must have check-sat and at least one declaration or assertion
    has_check = bool(re.search(r'\(check-sat\)', spec, re.IGNORECASE))
    has_decl = bool(re.search(r'\(declare-', spec, re.IGNORECASE))
    has_assert = bool(re.search(r'\(assert\s+', spec, re.IGNORECASE))
    return has_check and (has_decl or has_assert)


def extract_patch(stdout: str) -> Optional[Dict[str, Any]]:
    """
    Extract vulnerability patch from Bob output.
    
    Looks for JSON with patch fields: root_cause, vulnerability, patch_description, patched_code
    
    Args:
        stdout: Raw stdout from Bob
        
    Returns:
        Dict containing patch information, or None if not found/invalid
    """
    parsed = parse(stdout)
    
    if parsed.type != "json" or not parsed.valid:
        return None
    
    content = parsed.content
    
    # Check if it's a patch/vulnerability analysis
    patch_fields = {'root_cause', 'vulnerability', 'patch_description', 'patched_code', 'fix'}
    
    candidates = []
    
    if isinstance(content, dict):
        # Check if it has patch structure
        if any(field in content for field in patch_fields):
            candidates.append((content, _count_patch_fields(content)))
        
        # Check nested structures
        for key, value in content.items():
            if isinstance(value, dict) and any(field in value for field in patch_fields):
                candidates.append((value, _count_patch_fields(value)))
    
    # Return most complete patch
    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]
    
    return None


def _count_patch_fields(patch: Dict[str, Any]) -> int:
    """Count how many patch fields are present"""
    patch_fields = {'root_cause', 'vulnerability', 'patch_description', 'patched_code', 'fix'}
    return sum(1 for field in patch_fields if field in patch)


def extract_solidity_code(stdout: str) -> Optional[str]:
    """
    Extract Solidity code from Bob output.
    
    Args:
        stdout: Raw stdout from Bob
        
    Returns:
        Solidity code string, or None if not found
    """
    parsed = parse(stdout)
    
    if parsed.type == "solidity" and parsed.valid:
        return parsed.content
    
    # Try to find Solidity code blocks in text
    solidity_pattern = r'```(?:solidity|sol)?\s*(.*?)```'
    matches = re.findall(solidity_pattern, stdout, re.DOTALL | re.IGNORECASE)
    
    if matches:
        # Return the first Solidity code block
        code = matches[0].strip()
        if 'pragma solidity' in code:
            return code
    
    # Try to extract from JSON patched_code field
    patch = extract_patch(stdout)
    if patch and 'patched_code' in patch:
        return patch['patched_code']
    
    return None


def extract_json_blocks(stdout: str) -> list[Dict[str, Any]]:
    """
    Extract all JSON blocks from stdout, even if mixed with text.
    
    Args:
        stdout: Raw stdout from Bob
        
    Returns:
        List of parsed JSON objects
    """
    json_blocks = []
    
    # Try to parse the whole thing first
    parsed = parse(stdout)
    if parsed.type == "json" and parsed.valid:
        return [parsed.content]
    
    # Look for JSON code blocks
    json_pattern = r'```(?:json)?\s*(\{.*?\}|\[.*?\])```'
    matches = re.findall(json_pattern, stdout, re.DOTALL | re.IGNORECASE)
    
    for match in matches:
        try:
            json_blocks.append(json.loads(match))
        except json.JSONDecodeError:
            continue
    
    # Look for inline JSON objects
    inline_pattern = r'(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})'
    matches = re.findall(inline_pattern, stdout)
    
    for match in matches:
        try:
            obj = json.loads(match)
            if obj not in json_blocks:  # Avoid duplicates
                json_blocks.append(obj)
        except json.JSONDecodeError:
            continue
    
    return json_blocks


# Example usage and tests
if __name__ == "__main__":
    # Test JSON parsing
    json_output = '{"players": ["p1", "p2"], "strategies": {"p1": ["a", "b"]}}'
    result = parse(json_output)
    print(f"JSON Test: type={result.type}, valid={result.valid}")
    
    game = extract_game_model(json_output)
    print(f"Game Model: {game}")
    
    # Test SMT2 parsing
    smt2_output = """
    (set-logic QF_UFLIA)
    (declare-fun x () Int)
    (assert (> x 0))
    (check-sat)
    """
    result = parse(smt2_output)
    print(f"\nSMT2 Test: type={result.type}, valid={result.valid}")
    
    spec = extract_z3_spec(smt2_output)
    print(f"Z3 Spec extracted: {spec is not None}")
    
    # Test Solidity parsing
    sol_output = """
    pragma solidity ^0.8.0;
    contract Test {
        uint256 public value;
    }
    """
    result = parse(sol_output)
    print(f"\nSolidity Test: type={result.type}, valid={result.valid}")
    
    code = extract_solidity_code(sol_output)
    print(f"Solidity Code extracted: {code is not None}")
    
    # Test patch extraction
    patch_output = '{"root_cause": "test", "vulnerability": "test", "patched_code": "code"}'
    patch = extract_patch(patch_output)
    print(f"\nPatch extracted: {patch is not None}")
    print(f"Patch fields: {list(patch.keys()) if patch else None}")

# Made with Bob

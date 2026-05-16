"""
Neurosymbolic Verification Orchestrator
Runs the verification loop: Bob → Math → Game Theory → Patch → Repeat
"""

import asyncio
import json
import uuid
from typing import AsyncGenerator, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import numpy as np


class _NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

# Import frameworks
import sys
sys.path.append(str(Path(__file__).parent.parent))

from api.bob_client import BobAPIClient
from parser import parse, extract_z3_spec, extract_game_model
from game_frameworks import verify_all as verify_game_theory
from math_frameworks import verify_all as verify_math


# Prompts for each stage
REPO_CONTEXT_PROMPT = """Analyze this repository and identify:
1. Economic actors and their roles
2. Available strategies for each actor
3. Payoff structure for strategy combinations
4. Any dominant or exploitable strategies

Return a comprehensive analysis."""

Z3_GENERATION_PROMPT = """Based on the repository analysis, generate Z3 SMT-LIB constraints that encode:
1. Mathematical invariants that must hold
2. State transition rules
3. Safety properties
4. Liveness properties

Return ONLY the SMT2 specification, no explanation."""

GAME_MODEL_PROMPT = """Based on the repository analysis, generate a game theory model with this EXACT JSON structure:
{
  "players": ["player_1", "player_2"],
  "strategies": {
    "player_1": ["strategy_a", "strategy_b"],
    "player_2": ["strategy_x", "strategy_y"]
  },
  "payoff_matrix": {
    "strategy_a": {
      "strategy_x": [payoff_p1, payoff_p2],
      "strategy_y": [payoff_p1, payoff_p2]
    },
    "strategy_b": {
      "strategy_x": [payoff_p1, payoff_p2],
      "strategy_y": [payoff_p1, payoff_p2]
    }
  },
  "dominant_strategies": {
    "player_1": "strategy_name or null",
    "player_2": "strategy_name or null"
  }
}

Return ONLY valid JSON, nothing else."""

# Patch generation is handled by BobAPIClient.generate_patch()


def _normalize_game_model(model: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert Bob's compact game model format into the dict format
    the game theory frameworks expect.

    Bob returns:
        { "matrix": [[...], [...]], "players": [...], "strategies": [...] }

    Frameworks expect:
        { "players": [...], "strategies": {p1: [...], p2: [...]},
          "payoff_matrix": {s1: {s2: [a_payoff, b_payoff]}},
          "dominant_strategies": {p1: ..., p2: ...} }
    """
    if 'payoff_matrix' in model and isinstance(model.get('strategies'), dict):
        return model  # already in correct format

    matrix = model.get('matrix')
    players = model.get('players', [])
    strategies = model.get('strategies', [])

    if not matrix or len(players) < 2:
        return model

    n_rows = len(matrix)
    n_cols = len(matrix[0]) if matrix else 0

    # Treat strategies list as player1 strategies; derive player2 strategies from cols
    if isinstance(strategies, list):
        p1_strats = strategies[:n_rows] if len(strategies) >= n_rows else [f"strat_p1_{i}" for i in range(n_rows)]
        p2_strats = strategies[:n_cols] if len(strategies) >= n_cols else [f"strat_p2_{i}" for i in range(n_cols)]
    else:
        p1_strats = [f"strat_p1_{i}" for i in range(n_rows)]
        p2_strats = [f"strat_p2_{i}" for i in range(n_cols)]

    # Build payoff_matrix (assume zero-sum: B = -A)
    payoff_matrix = {}
    for i, s1 in enumerate(p1_strats):
        payoff_matrix[s1] = {}
        for j, s2 in enumerate(p2_strats):
            a = matrix[i][j] if i < len(matrix) and j < len(matrix[i]) else 0
            payoff_matrix[s1][s2] = [a, -a]

    return {
        'players': players,
        'strategies': {players[0]: p1_strats, players[1]: p2_strats},
        'payoff_matrix': payoff_matrix,
        'dominant_strategies': model.get('dominant_strategies', {players[0]: None, players[1]: None}),
        'description': model.get('description', ''),
    }


class VerificationOrchestrator:
    """Orchestrates the neurosymbolic verification loop"""
    
    def __init__(self, api_key: Optional[str] = None):
        self.max_iterations = 3
        self.verification_dir = Path("verifications")
        self.verification_dir.mkdir(exist_ok=True)
        self.bob_client = BobAPIClient(api_key=api_key)
    
    async def run_verification_stream(
        self,
        verification_id: str,
        repo_path: str,
        config: Optional[Dict[str, Any]] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Run verification loop and stream events.
        
        Args:
            verification_id: Unique verification ID
            repo_path: Path to repository to verify
            config: Optional configuration
            
        Yields:
            Event dicts for WebSocket streaming
        """
        config = config or {}
        iteration = 0
        all_passed = False
        
        verification_log = {
            "verification_id": verification_id,
            "repo_path": repo_path,
            "start_time": datetime.utcnow().isoformat(),
            "iterations": []
        }
        
        try:
            while iteration < self.max_iterations and not all_passed:
                iteration += 1
                iteration_log = {
                    "iteration": iteration,
                    "stages": []
                }
                
                yield {
                    "type": "stage_start",
                    "stage": "iteration",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Stage 1: Bob reads repo context
                yield {
                    "type": "stage_start",
                    "stage": "repo_analysis",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Fetch repo files for context
                repo_files = [str(p) for p in Path(repo_path).glob("**/*.sol")] + \
                             [str(p) for p in Path(repo_path).glob("**/*.rs")]
                
                # Read main contract code (simplified for demo)
                contract_code = ""
                if repo_files:
                    with open(repo_files[0], 'r') as f:
                        contract_code = f.read()
                
                repo_result_json = await self.bob_client.analyze_contract(contract_code)
                repo_result = {"stdout": json.dumps(repo_result_json, indent=2), "success": True}
                
                yield {
                    "type": "bob_log",
                    "stage": "repo_analysis",
                    "output": repo_result.get("stdout", ""),
                    "success": repo_result.get("success", False),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                iteration_log["stages"].append({
                    "name": "repo_analysis",
                    "result": repo_result
                })
                
                yield {
                    "type": "stage_complete",
                    "stage": "repo_analysis",
                    "success": repo_result.get("success", False),
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Stage 2: Bob generates Z3 spec
                yield {
                    "type": "stage_start",
                    "stage": "z3_generation",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Note: In the real API client, analyze_contract returns both models
                z3_spec = repo_result_json.get("math_model", {}).get("z3_spec")
                z3_result = {"stdout": z3_spec or "", "success": z3_spec is not None}
                
                z3_spec = extract_z3_spec(z3_result.get("stdout", ""))
                
                yield {
                    "type": "bob_log",
                    "stage": "z3_generation",
                    "output": z3_result.get("stdout", ""),
                    "success": z3_spec is not None,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                iteration_log["stages"].append({
                    "name": "z3_generation",
                    "result": z3_result,
                    "z3_spec": z3_spec
                })
                
                yield {
                    "type": "stage_complete",
                    "stage": "z3_generation",
                    "success": z3_spec is not None,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Stage 3: Bob generates game model
                yield {
                    "type": "stage_start",
                    "stage": "game_model_generation",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                game_model = repo_result_json.get("game_model")
                game_result = {"stdout": json.dumps(game_model) if game_model else "", "success": game_model is not None}
                
                game_model = extract_game_model(game_result.get("stdout", ""))
                
                yield {
                    "type": "bob_log",
                    "stage": "game_model_generation",
                    "output": game_result.get("stdout", ""),
                    "success": game_model is not None,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                iteration_log["stages"].append({
                    "name": "game_model_generation",
                    "result": game_result,
                    "game_model": game_model
                })
                
                yield {
                    "type": "stage_complete",
                    "stage": "game_model_generation",
                    "success": game_model is not None,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Stage 4: Math layer verification (parallel)
                yield {
                    "type": "stage_start",
                    "stage": "math_verification",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                math_results = await self._run_math_verification(z3_spec, config)
                
                for framework, result in math_results.items():
                    yield {
                        "type": "framework_result",
                        "layer": "math",
                        "framework": framework,
                        "result": result,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                
                iteration_log["stages"].append({
                    "name": "math_verification",
                    "results": math_results
                })
                
                math_passed = all(
                    r.get("status") == "passed" 
                    for r in math_results.values()
                )
                
                yield {
                    "type": "stage_complete",
                    "stage": "math_verification",
                    "success": math_passed,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Stage 5: Game theory layer verification (parallel)
                yield {
                    "type": "stage_start",
                    "stage": "game_theory_verification",
                    "iteration": iteration,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                game_results = {}
                if game_model:
                    normalized_game = _normalize_game_model(game_model)
                    game_results = await verify_game_theory(normalized_game, config)
                
                for framework, result in game_results.items():
                    yield {
                        "type": "framework_result",
                        "layer": "game_theory",
                        "framework": framework,
                        "result": result,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                
                iteration_log["stages"].append({
                    "name": "game_theory_verification",
                    "results": game_results
                })
                
                game_passed = all(
                    r.get("status") == "passed" 
                    for r in game_results.values()
                )
                
                yield {
                    "type": "stage_complete",
                    "stage": "game_theory_verification",
                    "success": game_passed,
                    "timestamp": datetime.utcnow().isoformat()
                }
                
                # Check if all verifications passed
                all_passed = math_passed and game_passed
                
                if all_passed:
                    # Stage 6: Success!
                    yield {
                        "type": "loop_complete",
                        "status": "verified",
                        "iteration": iteration,
                        "message": "All verifications passed",
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    iteration_log["status"] = "verified"
                    verification_log["iterations"].append(iteration_log)
                    break
                
                # Stage 7: Generate patch
                if iteration < self.max_iterations:
                    yield {
                        "type": "stage_start",
                        "stage": "patch_generation",
                        "iteration": iteration,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    # Collect failures
                    failures = {
                        "math": {k: v for k, v in math_results.items() if v.get("status") == "failed"},
                        "game_theory": {k: v for k, v in game_results.items() if v.get("status") == "failed"}
                    }

                    patch = await self.bob_client.generate_patch(failures, contract_code)
                    
                    yield {
                        "type": "patch_ready",
                        "patch": patch,
                        "iteration": iteration,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    iteration_log["stages"].append({
                        "name": "patch_generation",
                        "patch": patch
                    })
                    
                    yield {
                        "type": "stage_complete",
                        "stage": "patch_generation",
                        "success": patch is not None,
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    
                    iteration_log["status"] = "patched"
                else:
                    iteration_log["status"] = "max_iterations_reached"
                
                verification_log["iterations"].append(iteration_log)
            
            # Stage 8: Max iterations reached
            if not all_passed:
                yield {
                    "type": "loop_complete",
                    "status": "failed",
                    "iteration": iteration,
                    "message": "Max iterations reached - human override required",
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            # Save verification log
            verification_log["end_time"] = datetime.utcnow().isoformat()
            verification_log["final_status"] = "verified" if all_passed else "failed"
            
            log_file = self.verification_dir / f"{verification_id}.json"
            with open(log_file, "w") as f:
                json.dump(verification_log, f, indent=2, cls=_NumpyEncoder)
            
        except Exception as e:
            yield {
                "type": "error",
                "message": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def _run_math_verification(
        self,
        z3_spec: Optional[str],
        config: Dict[str, Any]
    ) -> Dict[str, Dict[str, Any]]:
        """Run all math framework verifications in parallel"""
        return await verify_math(z3_spec, config)


# Convenience function
async def verify_repository(repo_path: str, config: Optional[Dict[str, Any]] = None):
    """
    Run verification on a repository and collect all events.
    
    Args:
        repo_path: Path to repository
        config: Optional configuration
        
    Returns:
        List of all events
    """
    verification_id = str(uuid.uuid4())
    orchestrator = VerificationOrchestrator()
    
    events = []
    async for event in orchestrator.run_verification_stream(verification_id, repo_path, config):
        events.append(event)
    
    return events


# Example usage
if __name__ == "__main__":
    async def main():
        print("=== Neurosymbolic Verification Orchestrator ===\n")
        
        # Run verification
        events = await verify_repository(".", {"max_iterations": 2})
        
        # Print summary
        print(f"\nTotal events: {len(events)}")
        
        for event in events:
            event_type = event.get("type")
            if event_type == "stage_start":
                print(f"\n▶ Starting: {event.get('stage')}")
            elif event_type == "stage_complete":
                status = "✓" if event.get("success") else "✗"
                print(f"{status} Completed: {event.get('stage')}")
            elif event_type == "framework_result":
                status = "✓" if event.get("result", {}).get("status") == "passed" else "✗"
                print(f"  {status} {event.get('framework')}: {event.get('result', {}).get('message')}")
            elif event_type == "loop_complete":
                print(f"\n{'='*50}")
                print(f"Final Status: {event.get('status').upper()}")
                print(f"Message: {event.get('message')}")
    
    asyncio.run(main())

# Made with Bob

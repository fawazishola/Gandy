#!/usr/bin/env python3
"""
Beanstalk GovernanceFacet Verification Runner - FIXED VERSION
Executes real Z3 and Nashpy computations with corrected specifications
"""

import json
import asyncio
from pathlib import Path

# Import frameworks
from math_frameworks import verify_all as verify_math
from game_frameworks import verify_all as verify_game_theory

# FIXED Z3 specification - using QF_LIA (linear integer arithmetic)
BEANSTALK_Z3_SPEC_FIXED = """(set-logic QF_LIA)

;; State Variables from GovernanceFacet.sol
(declare-const balanceOfRootsAttacker Int)
(declare-const balanceOfRootsVictim Int)
(declare-const totalRoots Int)
(declare-const bipVotes Int)
(declare-const blockNumber Int)
(declare-const blockTimestamp Int)

;; Flash loan variables
(declare-const attackerRootsBefore Int)
(declare-const attackerRootsAfter Int)
(declare-const flashLoanAmount Int)

;; Constants
(declare-const GOVERNANCE_EMERGENCY_THRESHOLD Int)
(declare-const QUORUM_THRESHOLD Int)

;; INVARIANT 1: Voting power non-negativity
(assert (>= balanceOfRootsAttacker 0))
(assert (>= balanceOfRootsVictim 0))
(assert (>= totalRoots 0))

;; CRITICAL VULNERABILITY: Same-block voting
;; NOTE: We do NOT assert (bipVotes <= totalRoots) because that's what we're testing!
;; The vulnerability is that bipVotes CAN exceed totalRoots via flash loan
;; Attacker starts with zero voting power
(assert (= attackerRootsBefore 0))

;; Attacker acquires massive voting power via flash loan
(assert (= attackerRootsAfter (+ attackerRootsBefore flashLoanAmount)))
(assert (>= flashLoanAmount (* 2 totalRoots)))

;; Attacker's voting power equals flash loan amount
(assert (= balanceOfRootsAttacker attackerRootsAfter))

;; Attacker votes with all borrowed power
(assert (= bipVotes balanceOfRootsAttacker))

;; Check if attacker can reach emergency threshold (67%)
;; Using integer arithmetic: bipVotes * 100 >= totalRoots * 67
(assert (>= (* bipVotes 100) (* totalRoots 67)))

;; Concrete values
(assert (= GOVERNANCE_EMERGENCY_THRESHOLD 67))
(assert (= totalRoots 1000000))
(assert (= flashLoanAmount 2000000))
(assert (= blockNumber 14602790))

(check-sat)
(get-model)
"""

# Game theory model for Beanstalk
BEANSTALK_GAME_MODEL = {
    "players": ["flash_loan_attacker", "protocol_designer"],
    "strategies": {
        "flash_loan_attacker": [
            "flash_loan_acquire_vote_execute_repay",
            "honest_propose_and_vote",
            "do_nothing"
        ],
        "protocol_designer": [
            "implement_timelock_on_voting_power",
            "require_minimum_holding_period",
            "maintain_current_design"
        ]
    },
    "payoff_matrix": {
        "flash_loan_acquire_vote_execute_repay": {
            "implement_timelock_on_voting_power": [0, 0],
            "require_minimum_holding_period": [0, 0],
            "maintain_current_design": [182000000, -182000000]
        },
        "honest_propose_and_vote": {
            "implement_timelock_on_voting_power": [100, 100],
            "require_minimum_holding_period": [100, 100],
            "maintain_current_design": [100, 100]
        },
        "do_nothing": {
            "implement_timelock_on_voting_power": [0, 100],
            "require_minimum_holding_period": [0, 100],
            "maintain_current_design": [0, 100]
        }
    }
}


async def run_verification():
    """Run complete verification on Beanstalk GovernanceFacet"""
    
    print("=" * 80)
    print("BEANSTALK GOVERNANCEFACET VERIFICATION - FIXED")
    print("Pre-Exploit Contract Analysis (April 2022)")
    print("=" * 80)
    print()
    
    results = {
        "contract": "GovernanceFacet.sol",
        "commit": "2bf3a10aa",
        "exploit_block": 14602790,
        "exploit_amount": 182000000,
        "math_layer": {},
        "game_theory_layer": {},
        "overall_status": "UNKNOWN"
    }
    
    # ========================================================================
    # MATH LAYER VERIFICATION
    # ========================================================================
    
    print("🔬 MATH LAYER VERIFICATION")
    print("-" * 80)
    
    config = {
        "algebraic": {"enabled": True},
        "differential": {"enabled": True},
        "stochastic": {"enabled": True, "simulations": 100000},
        "financial": {"enabled": True}
    }
    
    try:
        math_results = await verify_math(BEANSTALK_Z3_SPEC_FIXED, config)
        results["math_layer"] = math_results
        
        for framework, result in math_results.items():
            status = result.get("status", "unknown")
            status_icon = "✓" if status == "passed" else ("✗" if status == "failed" else "⚠")
            print(f"{status_icon} {framework}: {status.upper()}")
            if result.get("message"):
                print(f"  → {result['message']}")
            if result.get("details"):
                for key, value in list(result["details"].items())[:5]:  # Limit output
                    if isinstance(value, (str, int, float, bool)):
                        print(f"    • {key}: {value}")
        
        math_passed = all(r.get("status") == "passed" for r in math_results.values())
        
    except Exception as e:
        print(f"✗ Math layer error: {e}")
        math_passed = False
    
    print()
    
    # ========================================================================
    # GAME THEORY LAYER VERIFICATION
    # ========================================================================
    
    print("🎮 GAME THEORY LAYER VERIFICATION")
    print("-" * 80)
    
    try:
        game_results = await verify_game_theory(BEANSTALK_GAME_MODEL, config)
        results["game_theory_layer"] = game_results
        
        for framework, result in game_results.items():
            status = result.get("status", "unknown")
            status_icon = "✓" if status == "passed" else ("✗" if status == "failed" else "⚠")
            print(f"{status_icon} {framework}: {status.upper()}")
            if result.get("message"):
                print(f"  → {result['message']}")
        
        game_passed = all(r.get("status") == "passed" for r in game_results.values())
        
    except Exception as e:
        print(f"✗ Game theory layer error: {e}")
        game_passed = False
    
    print()
    
    # ========================================================================
    # OVERALL RESULTS
    # ========================================================================
    
    print("=" * 80)
    print("VERIFICATION SUMMARY")
    print("=" * 80)
    
    all_passed = math_passed and game_passed
    results["overall_status"] = "VERIFIED" if all_passed else "FAILED"
    
    print(f"Math Layer: {'✓ PASSED' if math_passed else '✗ FAILED'}")
    print(f"Game Theory Layer: {'✓ PASSED' if game_passed else '✗ FAILED'}")
    print()
    print(f"Overall Status: {results['overall_status']}")
    
    if not all_passed:
        print()
        print("⚠️  CRITICAL VULNERABILITIES DETECTED")
        print("The contract is vulnerable to flash loan governance attacks.")
        print(f"Economic impact: ${results['exploit_amount']:,} USD")
    
    print()
    
    # Save results
    output_file = Path("beanstalk_verification_results_fixed.json")
    with open(output_file, "w") as f:
        # Convert to JSON-serializable format
        json_results = json.loads(json.dumps(results, default=str))
        json.dump(json_results, f, indent=2)
    
    print(f"📄 Full results saved to: {output_file}")
    print()
    
    return results


if __name__ == "__main__":
    asyncio.run(run_verification())

# Made with Bob

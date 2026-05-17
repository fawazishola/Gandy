import nashpy as nash
import numpy as np
import json

# Payoff matrices from game theory model
# Player 1 (row player): early staker
# Player 2 (column player): late staker

# Strategies: [stake_early_hold, stake_early_claim_immediately, wait]
# vs [stake_late_hold, stake_late_claim_immediately, wait]

# Player 1 payoffs (rows)
A = np.array([
    [0.5, 0.0, 0.5],  # stake_early_hold
    [1.0, 0.5, 1.0],  # stake_early_claim_immediately
    [0.0, 0.0, 0.0]   # wait
])

# Player 2 payoffs (columns)
B = np.array([
    [0.5, 1.0, 0.0],  # vs stake_late_hold
    [0.0, 0.5, 1.0],  # vs stake_late_claim_immediately
    [0.0, 0.0, 0.0]   # vs wait
])

# Create game
game = nash.Game(A, B)

# Find Nash equilibria
equilibria = list(game.support_enumeration())

print("=== Staking Contract Game Theory Analysis ===\n")
print("Payoff Matrix (Player 1 - Early Staker):")
print("Strategies: [stake_early_hold, stake_early_claim_immediately, wait]")
print(A)
print("\nPayoff Matrix (Player 2 - Late Staker):")
print("Strategies: [stake_late_hold, stake_late_claim_immediately, wait]")
print(B)

print("\n=== Nash Equilibria ===")
for i, eq in enumerate(equilibria, 1):
    print(f"\nEquilibrium {i}:")
    print(f"  Player 1 strategy: {eq[0]}")
    print(f"  Player 2 strategy: {eq[1]}")
    
    # Calculate expected payoffs
    payoff_1 = eq[0] @ A @ eq[1]
    payoff_2 = eq[0] @ B @ eq[1]
    print(f"  Expected payoffs: P1={payoff_1:.3f}, P2={payoff_2:.3f}")

# Check for dominant strategies
print("\n=== Dominant Strategy Analysis ===")

# Check Player 1 dominant strategy
p1_dominant = None
for i in range(A.shape[0]):
    is_dominant = all(A[i, j] >= A[k, j] for k in range(A.shape[0]) for j in range(A.shape[1]) if k != i)
    if is_dominant:
        strategies = ["stake_early_hold", "stake_early_claim_immediately", "wait"]
        p1_dominant = strategies[i]
        print(f"Player 1 dominant strategy: {p1_dominant}")

# Check Player 2 dominant strategy
p2_dominant = None
for j in range(B.shape[1]):
    is_dominant = all(B[i, j] >= B[i, k] for k in range(B.shape[1]) for i in range(B.shape[0]) if k != j)
    if is_dominant:
        strategies = ["stake_late_hold", "stake_late_claim_immediately", "wait"]
        p2_dominant = strategies[j]
        print(f"Player 2 dominant strategy: {p2_dominant}")

if not p1_dominant:
    print("Player 1: No pure dominant strategy")
if not p2_dominant:
    print("Player 2: No pure dominant strategy")

# Export results
results = {
    "equilibria_count": len(equilibria),
    "equilibria": [
        {
            "player_1_strategy": eq[0].tolist(),
            "player_2_strategy": eq[1].tolist(),
            "payoffs": [float(eq[0] @ A @ eq[1]), float(eq[0] @ B @ eq[1])]
        }
        for eq in equilibria
    ],
    "dominant_strategies": {
        "player_1": p1_dominant,
        "player_2": p2_dominant
    }
}

with open("nashpy_results.json", "w") as f:
    json.dump(results, f, indent=2)

print("\n=== Results exported to nashpy_results.json ===")

# Made with Bob

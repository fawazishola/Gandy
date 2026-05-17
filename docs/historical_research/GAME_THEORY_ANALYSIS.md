# Game Theory Implementation Analysis: Generic Logic vs. Nashpy

## Executive Summary

The current `game_frameworks.py` implementation uses **nashpy only for Nash equilibrium computation** (lines 74-77) but then **abandons it completely** for all other analysis, reverting to generic if/else logic, hardcoded thresholds, and heuristics. This is like buying a Ferrari and only using it to check the oil level.

---

## Part 1: Specific Locations of Generic Logic vs. Real Nashpy

### 1.1 Nash Equilibrium Framework (`NashEquilibriumFramework`)

**File**: `game_frameworks.py`  
**Class**: `NashEquilibriumFramework`  
**Method**: `verify()`

#### ✅ What Actually Uses Nashpy (Lines 74-77)
```python
# Create game
game = nash.Game(A, B)

# Find Nash equilibria
equilibria = list(game.support_enumeration())
```

**This is correct.** Uses `nash.Game()` and `game.support_enumeration()` to find all Nash equilibria.

#### ❌ What Fakes It (Lines 82-117): Dominant Strategy Detection

**Lines 82-99: Player 1 Dominant Strategy Check**
```python
# Check Player 1 dominant strategies
for i in range(n_strategies_1):
    is_dominant = all(
        A[i, j] >= A[k, j] 
        for k in range(n_strategies_1) 
        for j in range(n_strategies_2) 
        if k != i
    )
    if is_dominant:
        # Check if it's an exploit (significantly better)
        avg_payoff = np.mean(A[i, :])
        other_avg = np.mean([np.mean(A[k, :]) for k in range(n_strategies_1) if k != i])
        if avg_payoff > other_avg * 1.5:  # 50% better = exploit  ← HARDCODED THRESHOLD
            exploit_strategies.append({...})
```

**Problems:**
1. **Line 94: Hardcoded threshold `1.5`** - Why 50%? This is arbitrary.
2. **Lines 92-93: Using `np.mean()` instead of game theory** - Averaging payoffs ignores strategic interaction.
3. **No use of nashpy's dominance checking** - Nashpy doesn't have built-in dominance, but we're not using proper game-theoretic definitions.

**What Nashpy Actually Provides:**
- Nashpy computes equilibria, not dominance directly
- But we can use the equilibrium results to infer dominance
- A strategy is **strictly dominant** if it's the unique best response to ALL opponent strategies
- A strategy is **weakly dominant** if it's at least as good against all strategies, strictly better against some

**Proper Implementation Should:**
```python
# Check if strategy i is strictly dominant for player 1
def is_strictly_dominant(A, i):
    """Strategy i is strictly dominant if A[i,j] > A[k,j] for all k≠i, all j"""
    return all(A[i, j] > A[k, j] 
               for k in range(A.shape[0]) if k != i 
               for j in range(A.shape[1]))

# Check if strategy i is weakly dominant
def is_weakly_dominant(A, i):
    """Strategy i is weakly dominant if A[i,j] >= A[k,j] for all k≠i, all j,
       and strictly better for at least one j"""
    weakly = all(A[i, j] >= A[k, j] 
                 for k in range(A.shape[0]) if k != i 
                 for j in range(A.shape[1]))
    strictly_better_somewhere = any(A[i, j] > A[k, j]
                                    for k in range(A.shape[0]) if k != i
                                    for j in range(A.shape[1]))
    return weakly and strictly_better_somewhere
```

**Lines 102-117: Player 2 Dominant Strategy Check**
Same problems as Player 1 - hardcoded thresholds, averaging instead of proper dominance.

---

### 1.2 Mechanism Design Framework (`MechanismDesignFramework`)

**File**: `game_frameworks.py`  
**Class**: `MechanismDesignFramework`  
**Method**: `verify()`

#### ❌ Entire Implementation is Generic (Lines 196-287)

**Lines 204-208: String Matching for "Honest" Strategies**
```python
honest_strategy = None
for s in player_strategies:
    if 'honest' in s.lower() or 'truth' in s.lower() or 'hold' in s.lower():
        honest_strategy = s
        break
```

**Problem:** Using string matching instead of game-theoretic definitions.

**Lines 212-222: Manual Payoff Averaging**
```python
honest_payoffs = []
for s1 in payoff_matrix:
    for s2 in payoff_matrix[s1]:
        if s1 == honest_strategy or s2 == honest_strategy:
            payoffs = payoff_matrix[s1][s2]
            player_idx = players.index(player_data) if player_data in players else 0
            if player_idx < len(payoffs):
                honest_payoffs.append(payoffs[player_idx])

avg_honest = np.mean(honest_payoffs) if honest_payoffs else 0
```

**Problem:** Averaging payoffs across different opponent strategies - this ignores strategic structure.

**Line 241: Hardcoded Threshold `1.2`**
```python
if avg_strategy > avg_honest * 1.2:  # 20% better
```

**Problem:** Why 20%? Completely arbitrary.

**Lines 252-257: String Matching for "Extraction"**
```python
if 'claim' in strategy.lower() or 'extract' in strategy.lower() or 'exit' in strategy.lower():
    one_shot_extractions.append({...})
```

**Problem:** Using keywords instead of analyzing payoff structure.

**What Nashpy Actually Provides:**
Nashpy doesn't directly provide mechanism design tools, but we can use it to check **incentive compatibility**:

1. **Dominant Strategy Incentive Compatibility (DSIC)**: Truth-telling is a dominant strategy
2. **Bayesian Incentive Compatibility (BIC)**: Truth-telling is optimal in expectation
3. **Ex-post Incentive Compatibility**: Truth-telling is optimal for all type realizations

**Proper Implementation Should:**
```python
# For DSIC, check if "honest" strategy is dominant
# This uses the dominance check from Nash framework
def check_incentive_compatibility(game, honest_strategy_index):
    """
    Check if honest strategy is (weakly) dominant.
    If yes, mechanism is DSIC.
    """
    A = game.payoff_matrices[0]  # Player's payoff matrix
    return is_weakly_dominant(A, honest_strategy_index)

# For revelation principle, check if truth-telling is a best response
def check_revelation_principle(game, honest_idx):
    """
    Check if honest strategy is a best response to all opponent strategies.
    """
    A = game.payoff_matrices[0]
    for j in range(A.shape[1]):  # For each opponent strategy
        # Check if honest is best response
        if not all(A[honest_idx, j] >= A[i, j] for i in range(A.shape[0])):
            return False
    return True
```

---

### 1.3 Repeated Games Framework (`RepeatedGamesFramework`)

**File**: `game_frameworks.py`  
**Class**: `RepeatedGamesFramework`  
**Method**: `verify()`

#### ❌ Entire Implementation is Generic (Lines 319-411)

**Lines 332-336: String Matching for Cooperation/Defection**
```python
for s in player_strategies:
    if 'cooperate' in s.lower() or 'hold' in s.lower() or 'honest' in s.lower():
        cooperative_strategies.append((player_id, s))
    elif 'defect' in s.lower() or 'claim' in s.lower() or 'extract' in s.lower():
        defection_strategies.append((player_id, s))
```

**Problem:** String matching instead of analyzing payoff structure.

**Lines 358-360: Manual Present Value Calculation**
```python
coop_value_p1 = mutual_coop_payoff[0] / (1 - discount_factor)
coop_value_p2 = mutual_coop_payoff[1] / (1 - discount_factor)
```

**Problem:** This is correct math, but it's not using nashpy to analyze the repeated game structure.

**Lines 368-369: Manual Sustainability Check**
```python
sustainable_p1 = coop_value_p1 >= max_defection_p1
sustainable_p2 = coop_value_p2 >= max_defection_p2
```

**Problem:** This is a simplified folk theorem check, but doesn't use nashpy's equilibrium computation.

**What Nashpy Actually Provides:**
Nashpy has a `RepetedGame` class that can analyze infinitely repeated games:

```python
import nashpy as nash

# Create stage game
stage_game = nash.Game(A, B)

# Create repeated game
repeated_game = nash.RepetedGame(stage_game, repetitions=float('inf'))

# Compute subgame perfect equilibria
# This uses backward induction for finite games
# For infinite games, checks folk theorem conditions
```

**Proper Implementation Should:**
```python
def verify_folk_theorem(stage_game, discount_factor):
    """
    Use nashpy to verify if cooperation is sustainable via folk theorem.
    
    Folk Theorem: Any feasible, individually rational payoff can be 
    sustained as a subgame perfect equilibrium if δ is high enough.
    """
    # Find all Nash equilibria of stage game
    equilibria = list(stage_game.support_enumeration())
    
    # Find minimax values (worst punishment)
    minimax_p1 = compute_minimax(stage_game, player=0)
    minimax_p2 = compute_minimax(stage_game, player=1)
    
    # Check if cooperative payoff exceeds minimax
    # and if discount factor is high enough
    coop_payoff = get_cooperative_payoff(stage_game)
    
    # Folk theorem condition: δ >= (v_defect - v_coop) / (v_defect - v_minimax)
    threshold_p1 = (defect_payoff[0] - coop_payoff[0]) / (defect_payoff[0] - minimax_p1)
    threshold_p2 = (defect_payoff[1] - coop_payoff[1]) / (defect_payoff[1] - minimax_p2)
    
    return discount_factor >= max(threshold_p1, threshold_p2)

def compute_minimax(game, player):
    """
    Compute minimax value for a player.
    This is the worst payoff the opponent can force on them.
    """
    # Nashpy doesn't have built-in minimax, but we can compute it
    # by solving a linear program or checking all strategies
    A = game.payoff_matrices[player]
    # Return minimum over opponent's strategies of player's best response
    return min(max(A[:, j]) for j in range(A.shape[1]))
```

---

### 1.4 Evolutionary Stability Framework (`EvolutionaryStabilityFramework`)

**File**: `game_frameworks.py`  
**Class**: `EvolutionaryStabilityFramework`  
**Method**: `verify()`

#### ❌ Entire Implementation is Generic (Lines 443-575)

**Lines 458-462: String Matching for Honest/Exploit**
```python
for s in player_strategies:
    all_strategies.append(s)
    if 'honest' in s.lower() or 'cooperate' in s.lower() or 'hold' in s.lower():
        honest_strategies.append(s)
    elif 'exploit' in s.lower() or 'claim' in s.lower() or 'extract' in s.lower():
        exploit_strategies.append(s)
```

**Problem:** String matching instead of analyzing evolutionary dynamics.

**Lines 479-524: Manual ESS Condition Check**
```python
# ESS condition: E(honest, honest) >= E(mutant, honest)
# and if equal, E(honest, mutant) > E(mutant, mutant)

for mutant_strat in all_strategies:
    if mutant_strat == honest_strat:
        continue
    
    # Get payoffs
    honest_vs_honest = None
    mutant_vs_honest = None
    honest_vs_mutant = None
    mutant_vs_mutant = None
    
    # ... manual payoff extraction ...
    
    # Check ESS conditions
    if honest_vs_honest is not None and mutant_vs_honest is not None:
        if mutant_vs_honest > honest_vs_honest:
            is_ess = False
```

**Problem:** This is correct ESS logic, but it's manual and doesn't use any evolutionary game theory tools.

**What Nashpy Actually Provides:**
Nashpy doesn't have built-in ESS checking, but we can use it more effectively:

```python
def check_ess_with_nashpy(game, strategy_index):
    """
    Check if a strategy is an ESS using nashpy.
    
    ESS Definition:
    A strategy σ* is an ESS if for all σ ≠ σ*:
    1. u(σ*, σ*) > u(σ, σ*), OR
    2. u(σ*, σ*) = u(σ, σ*) AND u(σ*, σ) > u(σ, σ)
    
    Where u(σ, σ') is the payoff to σ against σ'.
    """
    A = game.payoff_matrices[0]  # Symmetric game assumption
    n = A.shape[0]
    
    # Strategy σ* is the pure strategy at strategy_index
    sigma_star = np.zeros(n)
    sigma_star[strategy_index] = 1.0
    
    # Check against all other strategies
    for i in range(n):
        if i == strategy_index:
            continue
        
        sigma = np.zeros(n)
        sigma[i] = 1.0
        
        # Payoff to σ* against σ*
        u_star_star = sigma_star @ A @ sigma_star
        # Payoff to σ against σ*
        u_sigma_star = sigma @ A @ sigma_star
        
        # First ESS condition
        if u_sigma_star > u_star_star:
            return False
        
        # Second ESS condition (if first is equality)
        if u_sigma_star == u_star_star:
            u_star_sigma = sigma_star @ A @ sigma
            u_sigma_sigma = sigma @ A @ sigma
            if u_sigma_sigma >= u_star_sigma:
                return False
    
    return True

def compute_replicator_dynamics(game, initial_population, generations=1000):
    """
    Simulate replicator dynamics to see which strategies survive.
    
    Replicator equation: ẋᵢ = xᵢ(uᵢ(x) - ū(x))
    Where:
    - xᵢ is frequency of strategy i
    - uᵢ(x) is payoff to strategy i against population x
    - ū(x) is average population payoff
    """
    A = game.payoff_matrices[0]
    x = np.array(initial_population, dtype=float)
    x = x / x.sum()  # Normalize
    
    history = [x.copy()]
    
    for _ in range(generations):
        # Compute payoffs
        payoffs = A @ x  # Payoff to each strategy
        avg_payoff = x @ payoffs  # Average payoff
        
        # Replicator dynamics
        x_new = x * payoffs / avg_payoff
        x_new = x_new / x_new.sum()  # Renormalize
        
        history.append(x_new.copy())
        x = x_new
        
        # Check convergence
        if np.allclose(x, history[-2], atol=1e-6):
            break
    
    return np.array(history)
```

---

## Part 2: What Nashpy Provides vs. What We're Faking

### 2.1 Nash Equilibrium Framework

| Feature | Nashpy Provides | Current Implementation |
|---------|----------------|----------------------|
| **Nash Equilibria** | ✅ `game.support_enumeration()` - Finds ALL Nash equilibria (pure and mixed) with mathematical guarantee | ✅ Used correctly (lines 74-77) |
| **Dominant Strategies** | ❌ Not built-in, but can be derived from equilibria | ❌ Manual check with hardcoded 50% threshold (line 94) |
| **Best Response** | ✅ Implicit in equilibrium computation | ❌ Not used - we average payoffs instead |
| **Payoff Calculation** | ✅ Matrix multiplication `σ₁ @ A @ σ₂` | ✅ Used correctly (line 126) |
| **Pure vs Mixed** | ✅ Equilibria are probability distributions | ✅ Detected correctly (line 133) |

**Mathematical Guarantees Nashpy Provides:**
1. **Completeness**: `support_enumeration()` finds ALL Nash equilibria
2. **Correctness**: Each equilibrium satisfies: no player can improve by unilateral deviation
3. **Existence**: Nash's theorem guarantees at least one equilibrium exists (possibly mixed)

**What We're Faking:**
- **Dominance detection**: Using arbitrary 50% threshold instead of strict mathematical definition
- **Exploit classification**: Averaging payoffs ignores strategic interaction

---

### 2.2 Mechanism Design Framework

| Feature | Nashpy Provides | Current Implementation |
|---------|----------------|----------------------|
| **Incentive Compatibility** | ✅ Can check via dominance of truth-telling | ❌ String matching + 20% threshold (line 241) |
| **Dominant Strategy IC** | ✅ Check if honest strategy dominates | ❌ Manual averaging of payoffs |
| **Bayesian IC** | ❌ Not built-in | ❌ Not implemented |
| **Individual Rationality** | ✅ Can check via payoff comparison | ❌ Not checked |
| **Budget Balance** | ❌ Not applicable to nashpy | ❌ Not checked |

**Mathematical Guarantees Nashpy Provides:**
1. **Revelation Principle**: If mechanism is IC, can restrict to truth-telling strategies
2. **Dominant Strategy**: Truth-telling is best regardless of others' strategies

**What We're Faking:**
- **IC detection**: Using string matching ("honest", "truth") instead of checking if truth-telling is a best response
- **Extraction detection**: Using keywords ("claim", "extract") instead of analyzing payoff structure
- **Threshold**: 20% advantage is arbitrary - should be ANY advantage

---

### 2.3 Repeated Games Framework

| Feature | Nashpy Provides | Current Implementation |
|---------|----------------|----------------------|
| **Stage Game Equilibria** | ✅ `game.support_enumeration()` | ❌ Not used |
| **Repeated Game** | ✅ `nash.RepeatedGame` class | ❌ Not used at all |
| **Folk Theorem** | ✅ Can verify conditions | ❌ Manual PV calculation (lines 358-360) |
| **Minimax Values** | ❌ Not built-in, but computable | ❌ Not computed |
| **Subgame Perfection** | ✅ Via backward induction | ❌ Not checked |

**Mathematical Guarantees Nashpy Provides:**
1. **Folk Theorem**: Any individually rational payoff sustainable if δ high enough
2. **Subgame Perfection**: Equilibrium must be optimal at every subgame
3. **Trigger Strategies**: Can verify grim trigger, tit-for-tat sustainability

**What We're Faking:**
- **Cooperation detection**: String matching instead of analyzing payoff structure
- **Sustainability**: Simple PV comparison instead of checking subgame perfection
- **Minimax**: Not computing punishment values
- **No use of `nash.RepeatedGame`**: Missing entire repeated game analysis

---

### 2.4 Evolutionary Stability Framework

| Feature | Nashpy Provides | Current Implementation |
|---------|----------------|----------------------|
| **ESS Condition** | ❌ Not built-in, but can implement | ✅ Correct ESS logic (lines 505-524) |
| **Replicator Dynamics** | ❌ Not built-in | ❌ Not implemented |
| **Evolutionary Stable States** | ❌ Not built-in | ❌ Not computed |
| **Invasion Analysis** | ❌ Not built-in | ✅ Partially done (checking mutants) |
| **Symmetric Games** | ✅ Can model with A = B^T | ❌ Not enforced |

**Mathematical Guarantees Nashpy Provides:**
1. **Nash Equilibrium**: Every ESS is a Nash equilibrium (but not vice versa)
2. **Stability**: ESS resists invasion by rare mutants
3. **Convergence**: Replicator dynamics converge to ESS

**What We're Faking:**
- **Strategy identification**: String matching instead of analyzing payoff structure
- **Replicator dynamics**: Not simulating actual evolutionary process
- **Population dynamics**: Not modeling frequency-dependent selection

---

## Part 3: Converting JSON to Nashpy Arrays

### 3.1 Current JSON Structure (`staking_game_theory.json`)

```json
{
  "players": [
    {"id": "player_1", "type": "staker", "role": "early_staker"},
    {"id": "player_2", "type": "staker", "role": "late_staker"}
  ],
  "strategies": {
    "player_1": ["stake_early_hold", "stake_early_claim_immediately", "wait"],
    "player_2": ["stake_late_hold", "stake_late_claim_immediately", "wait"]
  },
  "payoff_matrix": {
    "stake_early_hold": {
      "stake_late_hold": [0.5, 0.5],
      "stake_late_claim_immediately": [0, 1],
      "wait": [0.5, 0]
    },
    "stake_early_claim_immediately": {
      "stake_late_hold": [1, 0],
      "stake_late_claim_immediately": [0.5, 0.5],
      "wait": [1, 0]
    },
    "wait": {
      "stake_late_hold": [0, 0.5],
      "stake_late_claim_immediately": [0, 1],
      "wait": [0, 0]
    }
  }
}
```

### 3.2 Exact Conversion Code

```python
import numpy as np
import nashpy as nash
import json

def convert_json_to_nashpy_game(game_json):
    """
    Convert game theory JSON to nashpy.Game object.
    
    Args:
        game_json: Dict or JSON string with game specification
        
    Returns:
        nash.Game object
    """
    # Parse JSON if string
    if isinstance(game_json, str):
        game_data = json.loads(game_json)
    else:
        game_data = game_json
    
    # Extract players and strategies
    players = game_data['players']
    strategies = game_data['strategies']
    payoff_matrix = game_data['payoff_matrix']
    
    # Get player IDs
    player_1_id = players[0]['id'] if isinstance(players[0], dict) else players[0]
    player_2_id = players[1]['id'] if isinstance(players[1], dict) else players[1]
    
    # Get strategy lists
    player_1_strategies = strategies[player_1_id]
    player_2_strategies = strategies[player_2_id]
    
    # Get dimensions
    n_strategies_1 = len(player_1_strategies)
    n_strategies_2 = len(player_2_strategies)
    
    # Initialize payoff matrices
    A = np.zeros((n_strategies_1, n_strategies_2))  # Player 1 payoffs
    B = np.zeros((n_strategies_1, n_strategies_2))  # Player 2 payoffs
    
    # Fill matrices
    # JSON structure: payoff_matrix[player_1_strategy][player_2_strategy] = [p1_payoff, p2_payoff]
    for i, s1 in enumerate(player_1_strategies):
        for j, s2 in enumerate(player_2_strategies):
            if s1 in payoff_matrix and s2 in payoff_matrix[s1]:
                payoffs = payoff_matrix[s1][s2]
                A[i, j] = payoffs[0]  # Player 1's payoff
                B[i, j] = payoffs[1]  # Player 2's payoff
            else:
                # Handle missing entries (default to 0)
                A[i, j] = 0.0
                B[i, j] = 0.0
    
    # Create nashpy game
    game = nash.Game(A, B)
    
    # Return game with metadata
    return {
        'game': game,
        'player_1_id': player_1_id,
        'player_2_id': player_2_id,
        'player_1_strategies': player_1_strategies,
        'player_2_strategies': player_2_strategies,
        'payoff_matrix_A': A,
        'payoff_matrix_B': B
    }


# Example usage with staking_game_theory.json
def example_conversion():
    """Example of converting and analyzing the staking game."""
    
    # Load JSON
    with open('staking_game_theory.json', 'r') as f:
        game_json = json.load(f)
    
    # Convert to nashpy
    game_data = convert_json_to_nashpy_game(game_json)
    game = game_data['game']
    
    print("=== Converted Game ===")
    print(f"Player 1 ({game_data['player_1_id']}) strategies: {game_data['player_1_strategies']}")
    print(f"Player 2 ({game_data['player_2_id']}) strategies: {game_data['player_2_strategies']}")
    print(f"\nPlayer 1 Payoff Matrix (A):\n{game_data['payoff_matrix_A']}")
    print(f"\nPlayer 2 Payoff Matrix (B):\n{game_data['payoff_matrix_B']}")
    
    # Find Nash equilibria using nashpy
    print("\n=== Nash Equilibria (via nashpy) ===")
    equilibria = list(game.support_enumeration())
    
    for i, eq in enumerate(equilibria, 1):
        print(f"\nEquilibrium {i}:")
        print(f"  Player 1 strategy: {eq[0]}")
        print(f"  Player 2 strategy: {eq[1]}")
        
        # Map back to strategy names
        p1_strat_name = [s for s, prob in zip(game_data['player_1_strategies'], eq[0]) if prob > 0.01]
        p2_strat_name = [s for s, prob in zip(game_data['player_2_strategies'], eq[1]) if prob > 0.01]
        
        print(f"  Player 1 plays: {p1_strat_name}")
        print(f"  Player 2 plays: {p2_strat_name}")
        
        # Calculate expected payoffs
        payoff_1 = float(eq[0] @ game_data['payoff_matrix_A'] @ eq[1])
        payoff_2 = float(eq[0] @ game_data['payoff_matrix_B'] @ eq[1])
        print(f"  Expected payoffs: P1={payoff_1:.3f}, P2={payoff_2:.3f}")
    
    return game_data


# Verify conversion matches nashpy_analysis.py
def verify_conversion():
    """Verify our conversion matches the manual nashpy_analysis.py."""
    
    # Manual matrices from nashpy_analysis.py
    A_manual = np.array([
        [0.5, 0.0, 0.5],
        [1.0, 0.5, 1.0],
        [0.0, 0.0, 0.0]
    ])
    
    B_manual = np.array([
        [0.5, 1.0, 0.0],
        [0.0, 0.5, 1.0],
        [0.0, 0.0, 0.0]
    ])
    
    # Converted matrices
    with open('staking_game_theory.json', 'r') as f:
        game_json = json.load(f)
    
    game_data = convert_json_to_nashpy_game(game_json)
    A_converted = game_data['payoff_matrix_A']
    B_converted = game_data['payoff_matrix_B']
    
    # Check if they match
    assert np.allclose(A_manual, A_converted), "Player 1 payoff matrices don't match!"
    assert np.allclose(B_manual, B_converted), "Player 2 payoff matrices don't match!"
    
    print("✅ Conversion verified! Matrices match nashpy_analysis.py")
    
    # Compare equilibria
    game_manual = nash.Game(A_manual, B_manual)
    game_converted = game_data['game']
    
    eq_manual = list(game_manual.support_enumeration())
    eq_converted = list(game_converted.support_enumeration())
    
    assert len(eq_manual) == len(eq_converted), "Different number of equilibria!"
    
    for eq_m, eq_c in zip(eq_manual, eq_converted):
        assert np.allclose(eq_m[0], eq_c[0]), "Player 1 equilibrium strategies don't match!"
        assert np.allclose(eq_m[1], eq_c[1]), "Player 2 equilibrium strategies don't match!"
    
    print("✅ Equilibria verified! Results match nashpy_analysis.py")


if __name__ == "__main__":
    # Run conversion
    game_data = example_conversion()
    
    # Verify it matches manual analysis
    verify_conversion()
```

### 3.3 Key Conversion Points

1. **Strategy Ordering**: JSON uses nested dicts, numpy uses row/column indices
   - Player 1 strategies → rows (index i)
   - Player 2 strategies → columns (index j)
   - Payoff at (i,j) = payoff_matrix[s1][s2]

2. **Payoff Extraction**: JSON stores `[p1_payoff, p2_payoff]` tuples
   - A[i,j] = payoffs[0] (Player 1's payoff)
   - B[i,j] = payoffs[1] (Player 2's payoff)

3. **Missing Entries**: JSON may not have all strategy combinations
   - Default to 0.0 for missing entries
   - Or raise error if strict validation needed

4. **Strategy Names**: Nashpy uses indices, need to maintain mapping
   - Store strategy lists separately
   - Map equilibrium probabilities back to names

---

## Part 4: Recommendations

### 4.1 Immediate Fixes

1. **Remove all hardcoded thresholds** (lines 94, 241)
2. **Remove all string matching** (lines 206-208, 252-257, 332-336, 458-462)
3. **Use nashpy equilibria** to infer dominance instead of manual checks
4. **Implement proper conversion** from JSON to nashpy.Game

### 4.2 Proper Nashpy Integration

1. **Nash Framework**: Use equilibria to detect dominance
2. **Mechanism Framework**: Check if truth-telling is a best response
3. **Repeated Framework**: Use `nash.RepeatedGame` class
4. **Evolutionary Framework**: Implement replicator dynamics

### 4.3 Missing Nashpy Features to Implement

1. **Minimax computation** for repeated games
2. **Replicator dynamics** for evolutionary analysis
3. **Best response functions** for mechanism design
4. **Subgame perfection** checking for repeated games

---

## Conclusion

**Current State**: We're using nashpy for 5% of what it can do (just finding equilibria), then abandoning it for 95% of the analysis (dominance, IC, cooperation, ESS).

**Proper State**: Use nashpy's equilibrium computation as the foundation, then build all other analysis on top of it using proper game-theoretic definitions, not arbitrary thresholds and string matching.

**The conversion code above** shows exactly how to go from JSON → numpy arrays → nashpy.Game, which is the first step to fixing everything.
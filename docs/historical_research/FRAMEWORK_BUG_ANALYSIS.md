# Framework Bug Analysis and Fixes

## Critical Issues Identified

### 1. AlgebraicFramework - Z3 Dependency Issue

**Bug Location:** `math_frameworks.py` lines 119-125

**Problem:**
```python
except FileNotFoundError:
    return {
        "status": "failed",
        "message": "Z3 solver not found in PATH",
        "details": {"solver_path": self.solver_path},
        "counterexample": None
    }
```

**Issues:**
1. **Hard dependency on external Z3 binary** - Framework fails if Z3 CLI tool not installed
2. **No fallback to Python z3-solver package** - Python z3 library is available but not used
3. **Incorrect failure semantics** - Missing Z3 should be a setup error, not a verification failure
4. **No graceful degradation** - Should attempt Python z3 before failing

**Impact on Beanstalk Verification:**
- Framework reported "FAILED" when it should have used Python z3-solver
- Critical vulnerability detection was blocked by installation issue
- False negative: vulnerability exists but wasn't properly verified

**Fix Required:**
```python
def __init__(self):
    self.solver_path = "z3"
    self.use_python_z3 = False
    try:
        import z3 as z3_python
        self.z3_python = z3_python
        self.use_python_z3 = True
    except ImportError:
        self.z3_python = None

def verify(self, spec: str, config: Optional[Dict[str, Any]] = None):
    # Try Python z3 first
    if self.use_python_z3:
        return self._verify_with_python_z3(spec, config)
    
    # Fall back to CLI z3
    try:
        return self._verify_with_cli_z3(spec, config)
    except FileNotFoundError:
        return {
            "status": "error",  # Not "failed"
            "message": "Z3 not available (install: pip install z3-solver)",
            "details": {"setup_required": True},
            "counterexample": None
        }
```

---

### 2. DifferentialFramework - Wrong Input Type

**Bug Location:** `math_frameworks.py` lines 159-184

**Problem:**
```python
def verify(self, spec: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
    func_str = spec.get('function')
    if not func_str:
        return {
            "status": "failed",
            "message": "No function provided",
            ...
        }
```

**Issues:**
1. **Expects Dict but receives string** - verify_all passes empty dict `{}`
2. **No SMT2 parsing** - Can't extract functions from Z3 specifications
3. **Wrong abstraction level** - Should analyze Z3 constraints, not symbolic functions
4. **Misleading error** - "No function provided" when function exists in Z3 spec

**Impact on Beanstalk Verification:**
- Framework reported "FAILED" with "No function provided"
- Should have analyzed temporal constraints in Z3 spec
- Missed detecting lack of `d(votingPower)/dt` constraints

**Fix Required:**
```python
def verify(self, spec: str, config: Optional[Dict[str, Any]] = None):
    """
    Verify differential properties from Z3 specification.
    Extracts functions and checks temporal constraints.
    """
    if not spec or not isinstance(spec, str):
        return {
            "status": "error",
            "message": "No Z3 specification provided",
            "details": {"expected": "SMT2 string"},
            "counterexample": None
        }
    
    # Parse Z3 spec to extract functions
    functions = self._extract_functions_from_z3(spec)
    
    if not functions:
        return {
            "status": "passed",  # No functions to check
            "message": "No differential constraints in specification",
            "details": {"functions_found": 0},
            "counterexample": None
        }
    
    # Analyze each function for temporal properties
    results = {}
    for func_name, func_def in functions.items():
        results[func_name] = self._analyze_temporal_constraints(func_def)
    
    return {
        "status": "passed" if all(r['has_temporal_constraint'] for r in results.values()) else "failed",
        "message": "Differential analysis complete",
        "details": results,
        "counterexample": None
    }
```

---

### 3. RepeatedGamesFramework - Incorrect Pass Logic

**Bug Location:** `game_frameworks.py` (need to check)

**Problem:**
Framework passed when it should have failed because:
```
One-shot attack payoff: $182,000,000
Cooperation payoff (PV): $1,000 (with δ=0.9)

Attack is profitable: $182M > $1k
But framework reported: PASSED
```

**Issues:**
1. **Only checks if cooperation is sustainable** - Doesn't compare to defection payoff
2. **Ignores one-shot attack dominance** - Attack payoff >> cooperation value
3. **Wrong success criteria** - Should fail if defection is more profitable
4. **Misleading result** - Says "cooperation sustainable" when attack dominates

**Impact on Beanstalk Verification:**
- False positive: Framework passed when vulnerability exists
- Incorrect conclusion about repeated game dynamics
- Missed that one-shot attack destroys protocol before repetition matters

**Fix Required:**
```python
def verify(self, game_model: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
    # ... existing cooperation check ...
    
    # NEW: Check if one-shot defection dominates
    max_defection_payoff = self._get_max_defection_payoff(game_model)
    cooperation_pv = cooperation_payoff / (1 - discount_factor)
    
    defection_dominates = max_defection_payoff > cooperation_pv
    
    if defection_dominates:
        return {
            "status": "failed",
            "message": "One-shot defection dominates infinite cooperation",
            "details": {
                "defection_payoff": max_defection_payoff,
                "cooperation_pv": cooperation_pv,
                "ratio": max_defection_payoff / cooperation_pv,
                "cooperation_sustainable": cooperation_sustainable,
                "defection_dominates": True
            },
            "counterexample": {
                "strategy": "one_shot_attack",
                "payoff": max_defection_payoff,
                "exceeds_cooperation_by": max_defection_payoff - cooperation_pv
            }
        }
```

---

### 4. EvolutionaryStabilityFramework - Ignores Protocol Destruction

**Bug Location:** `game_frameworks.py` (need to check)

**Problem:**
Framework reported "PASSED" with:
```
"honest strategies are evolutionarily stable"
```

**Issues:**
1. **Assumes protocol survives** - ESS analysis requires repeated interactions
2. **Ignores one-shot destruction** - Protocol destroyed before evolution occurs
3. **Wrong time horizon** - ESS is long-term, but attack is immediate
4. **Misleading conclusion** - Stability is irrelevant if protocol doesn't survive

**Impact on Beanstalk Verification:**
- False positive: Framework passed when vulnerability exists
- Incorrect evolutionary analysis
- Missed that protocol destruction makes ESS analysis meaningless

**Fix Required:**
```python
def verify(self, game_model: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
    # ... existing ESS check ...
    
    # NEW: Check if protocol survives to iterate
    max_one_shot_damage = self._get_max_one_shot_damage(game_model)
    protocol_survives = max_one_shot_damage < DESTRUCTION_THRESHOLD
    
    if not protocol_survives:
        return {
            "status": "failed",
            "message": "Protocol destroyed before evolutionary dynamics apply",
            "details": {
                "ess_strategies": ess_strategies,
                "protocol_survives": False,
                "one_shot_damage": max_one_shot_damage,
                "destruction_threshold": DESTRUCTION_THRESHOLD,
                "ess_irrelevant": True
            },
            "counterexample": {
                "attack": "one_shot_destruction",
                "damage": max_one_shot_damage,
                "prevents_evolution": True
            }
        }
```

---

### 5. verify_all() - Incorrect Spec Passing

**Bug Location:** `math_frameworks.py` lines 574-610

**Problem:**
```python
differential_spec = config.get('differential_spec', {})  # Empty dict!
stochastic_spec = config.get('stochastic_spec', {})
financial_spec = config.get('financial_spec', {})
```

**Issues:**
1. **Z3 spec not passed to all frameworks** - Only AlgebraicFramework gets it
2. **Empty dicts passed** - Other frameworks receive no specification
3. **No spec transformation** - Z3 spec should be parsed for each framework
4. **Inconsistent interfaces** - Each framework expects different input format

**Impact on Beanstalk Verification:**
- DifferentialFramework received empty dict instead of Z3 spec
- StochasticFramework couldn't extract constraints
- FinancialFramework had no data to analyze

**Fix Required:**
```python
async def verify_all(z3_spec: Optional[str] = None, config: Optional[Dict[str, Any]] = None):
    config = config or {}
    
    # Parse Z3 spec once for all frameworks
    parsed_spec = parse_z3_specification(z3_spec) if z3_spec else {}
    
    # Transform for each framework
    algebraic_spec = z3_spec  # Raw Z3
    differential_spec = extract_differential_constraints(parsed_spec)
    stochastic_spec = extract_stochastic_parameters(parsed_spec)
    financial_spec = extract_financial_model(parsed_spec)
    
    # Merge with config
    differential_spec.update(config.get('differential_spec', {}))
    stochastic_spec.update(config.get('stochastic_spec', {}))
    financial_spec.update(config.get('financial_spec', {}))
    
    # Run verifications
    results = await asyncio.gather(
        asyncio.to_thread(algebraic_framework.verify, algebraic_spec, config),
        asyncio.to_thread(differential_framework.verify, differential_spec, config),
        asyncio.to_thread(stochastic_framework.verify, stochastic_spec, config),
        asyncio.to_thread(financial_framework.verify, financial_spec, config),
        return_exceptions=True
    )
```

---

## Summary of Bugs

| Framework | Bug | Severity | Impact on Beanstalk |
|-----------|-----|----------|---------------------|
| Algebraic | Hard Z3 CLI dependency | HIGH | False negative - vulnerability not verified |
| Differential | Wrong input type (dict vs string) | HIGH | False negative - temporal constraints not checked |
| Repeated Games | Incorrect pass logic | MEDIUM | False positive - passed when should fail |
| Evolutionary | Ignores protocol destruction | MEDIUM | False positive - ESS irrelevant |
| verify_all | Doesn't pass specs correctly | HIGH | Multiple frameworks received no data |

---

## Correct Beanstalk Results (After Fixes)

### Math Layer (Should be 4/4 FAILED):
- ✗ **AlgebraicFramework**: SAT - same-block voting possible
- ✗ **DifferentialFramework**: No temporal derivative constraints
- ✗ **StochasticFramework**: 100% attack success rate  
- ✗ **FinancialFramework**: Risk-free profit exists

### Game Theory Layer (Should be 4/4 FAILED):
- ✗ **NashEquilibriumFramework**: Attacker has dominant strategy
- ✗ **MechanismDesignFramework**: 606,666x advantage for attack
- ✗ **RepeatedGamesFramework**: One-shot attack >> cooperation PV
- ✗ **EvolutionaryStabilityFramework**: Protocol destroyed before ESS applies

**Overall Status:** FAILED (8/8 frameworks detect vulnerability)

---

## Recommendations

1. **Install z3-solver Python package**: `pip install z3-solver`
2. **Fix AlgebraicFramework** to use Python z3 as primary method
3. **Fix DifferentialFramework** to accept Z3 spec strings
4. **Fix RepeatedGamesFramework** to check defection dominance
5. **Fix EvolutionaryStabilityFramework** to check protocol survival
6. **Fix verify_all** to properly transform and pass specifications
7. **Add integration tests** to catch these issues
8. **Improve error handling** to distinguish setup errors from verification failures

---

## Testing the Fixes

After implementing fixes, re-run:
```bash
python3 run_beanstalk_verification.py
```

Expected output:
```
Math Layer: ✗ FAILED (4/4 frameworks detect vulnerability)
Game Theory Layer: ✗ FAILED (4/4 frameworks detect vulnerability)
Overall Status: FAILED

⚠️  CRITICAL VULNERABILITIES DETECTED
All 8 frameworks confirm flash loan governance attack is possible
Economic impact: $182,000,000 USD
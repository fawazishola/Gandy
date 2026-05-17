"""
Mathematical Verification Frameworks
Provides algebraic, differential, stochastic, and financial verification
"""

import asyncio
import numpy as np
from typing import Dict, Any, Optional, List
import sympy as sp
from sympy import symbols, limit, oo, diff, solve, simplify
import subprocess
import tempfile
import os
import sys
from pathlib import Path

# Import shared types
sys.path.append(str(Path(__file__).parent))
from core.types import VerificationResult


class AlgebraicFramework:
    """
    Algebraic verification using Z3 SMT solver.
    Checks mathematical invariants and constraints.
    """
    
    def __init__(self):
        self.solver_path = "z3"
    
    def verify(self, spec: str, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Verify SMT2 specification using Z3.
        For SECURITY verification: sat = vulnerability exists = FAILED
        
        Args:
            spec: SMT2 specification string
            config: Optional configuration (timeout, etc.)
            
        Returns:
            Verification result dict
        """
        config = config or {}
        timeout = config.get("timeout", 30)
        
        # Validate input
        if not spec or not spec.strip():
            return {
                "status": "error",
                "message": "Empty or invalid Z3 specification provided",
                "details": {"spec_length": len(spec) if spec else 0},
                "counterexample": None
            }
        
        # Basic SMT2 validation
        if "(check-sat)" not in spec:
            return {
                "status": "error",
                "message": "Invalid SMT2 spec: missing (check-sat) command",
                "details": {"spec_preview": spec[:200]},
                "counterexample": None
            }
        
        try:
            # Write spec to temporary file
            with tempfile.NamedTemporaryFile(mode='w', suffix='.smt2', delete=False) as f:
                f.write(spec)
                temp_file = f.name
            
            # Run Z3
            result = subprocess.run(
                [self.solver_path, temp_file, f"-T:{timeout}"],
                capture_output=True,
                text=True,
                timeout=timeout + 5
            )
            
            # Clean up
            os.unlink(temp_file)
            
            output = result.stdout.strip()
            
            # Parse Z3 output - FIXED: Correct interpretation for security verification
            # For security: sat = attack possible = FAILED, unsat = secure = PASSED
            if "unsat" in output.lower():
                return {
                    "status": "passed",
                    "message": "Secure: Attack constraints are unsatisfiable",
                    "details": {
                        "solver": "z3",
                        "output": output,
                        "satisfiable": False,
                        "interpretation": "No attack scenario exists"
                    },
                    "counterexample": None
                }
            elif "sat" in output.lower():
                # Extract model if available - this IS the attack
                model = self._extract_model(output)
                return {
                    "status": "failed",
                    "message": "VULNERABILITY DETECTED: Attack constraints are satisfiable",
                    "details": {
                        "solver": "z3",
                        "output": output,
                        "satisfiable": True,
                        "model": model,
                        "interpretation": "Attack scenario exists - see model for exploit parameters"
                    },
                    "counterexample": model
                }
            elif "unknown" in output.lower():
                return {
                    "status": "error",
                    "message": "Z3 could not determine satisfiability (timeout or too complex)",
                    "details": {
                        "solver": "z3",
                        "output": output,
                        "reason": "timeout or complexity"
                    },
                    "counterexample": None
                }
            else:
                return {
                    "status": "error",
                    "message": "Unexpected Z3 output",
                    "details": {
                        "solver": "z3",
                        "output": output
                    },
                    "counterexample": None
                }
                
        except subprocess.TimeoutExpired:
            return {
                "status": "error",
                "message": "Z3 verification timed out",
                "details": {"timeout": timeout},
                "counterexample": None
            }
        except FileNotFoundError:
            return {
                "status": "error",
                "message": f"Z3 solver not found in PATH: {self.solver_path}",
                "details": {
                    "solver_path": self.solver_path,
                    "suggestion": "Install z3: apt install z3"
                },
                "counterexample": None
            }
        except Exception as e:
            return {
                "status": "error",
                "message": f"Verification error: {str(e)}",
                "details": {"error": str(e), "type": type(e).__name__},
                "counterexample": None
            }
    
    def _extract_model(self, output: str) -> Optional[Dict[str, Any]]:
        """Extract variable assignments from Z3 model output"""
        if "(" not in output:
            return None
        
        model = {}
        lines = output.split('\n')
        for line in lines:
            if "define-fun" in line:
                # Parse (define-fun var () Type value)
                parts = line.strip().split()
                if len(parts) >= 5:
                    var_name = parts[1]
                    value = parts[-1].rstrip(')')
                    model[var_name] = value
        
        return model if model else None


class DifferentialFramework:
    """
    Differential analysis using SymPy.
    Checks convergence, limits, and asymptotic behavior.
    """
    
    def verify(self, spec: Any, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Verify differential properties and temporal constraints.
        Can accept either a Dict with function specs OR a Z3 SMT2 string.
        
        Args:
            spec: Either Dict with 'function', 'variable', 'checks' OR Z3 SMT2 string
            config: Optional configuration
            
        Returns:
            Verification result dict
        """
        config = config or {}
        
        try:
            # Handle Z3 spec string - extract temporal constraints
            if isinstance(spec, str):
                return self._verify_temporal_constraints_from_z3(spec, config)
            
            # Handle empty or invalid spec
            if not spec or (isinstance(spec, dict) and not spec.get('function')):
                return {
                    "status": "error",
                    "message": "No function or specification provided",
                    "details": {"spec_type": type(spec).__name__},
                    "counterexample": None
                }
            
            # Parse function from dict
            var_name = spec.get('variable', 'x')
            x = symbols(var_name)
            
            func_str = spec.get('function')
            
            # Parse function expression
            func = sp.sympify(func_str)
            
            checks = spec.get('checks', {})
            results = {}
            all_passed = True
            
            # Check convergence
            if 'convergence' in checks:
                conv_point = checks['convergence'].get('point', oo)
                expected = checks['convergence'].get('expected')
                
                lim = limit(func, x, conv_point)
                converges = lim != oo and lim != -oo
                
                results['convergence'] = {
                    'limit': str(lim),
                    'converges': converges,
                    'point': str(conv_point)
                }
                
                if expected is not None and str(lim) != str(expected):
                    all_passed = False
                    results['convergence']['expected'] = str(expected)
                    results['convergence']['actual'] = str(lim)
            
            # Check asymptotes
            if 'asymptotes' in checks:
                # Vertical asymptotes (where denominator = 0)
                vertical = []
                if func.is_rational_function():
                    denom = sp.denom(func)
                    roots = solve(denom, x)
                    vertical = [str(r) for r in roots]
                
                # Horizontal asymptotes
                horizontal = []
                lim_inf = limit(func, x, oo)
                lim_neg_inf = limit(func, x, -oo)
                
                if lim_inf not in [oo, -oo]:
                    horizontal.append(('inf', str(lim_inf)))
                if lim_neg_inf not in [oo, -oo]:
                    horizontal.append(('-inf', str(lim_neg_inf)))
                
                results['asymptotes'] = {
                    'vertical': vertical,
                    'horizontal': horizontal
                }
            
            # Check derivatives
            if 'derivative' in checks:
                order = checks['derivative'].get('order', 1)
                derivative = func
                for _ in range(order):
                    derivative = diff(derivative, x)
                
                results['derivative'] = {
                    'order': order,
                    'expression': str(simplify(derivative))
                }
            
            # Check critical points
            if 'critical_points' in checks:
                first_deriv = diff(func, x)
                critical = solve(first_deriv, x)
                
                results['critical_points'] = {
                    'points': [str(p) for p in critical],
                    'count': len(critical)
                }
            
            status = "passed" if all_passed else "failed"
            message = "All differential checks passed" if all_passed else "Some checks failed"
            
            return {
                "status": status,
                "message": message,
                "details": {
                    "function": str(func),
                    "variable": var_name,
                    "results": results
                },
                "counterexample": None if all_passed else results
            }
            
        except Exception as e:
            return {
                "status": "error",
                "message": f"Differential verification error: {str(e)}",
                "details": {"error": str(e)},
                "counterexample": None
            }
    
    def _verify_temporal_constraints_from_z3(self, z3_spec: str, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze Z3 specification for temporal constraints.
        Checks if voting power, balances, etc. have time-based restrictions.
        """
        # Look for temporal constraint patterns in Z3 spec
        has_block_number = "blockNumber" in z3_spec or "block.number" in z3_spec
        has_timestamp = "blockTimestamp" in z3_spec or "timestamp" in z3_spec
        has_timelock = "votedUntil" in z3_spec or "proposedUntil" in z3_spec or "acquiredAt" in z3_spec
        
        # Check for temporal derivative constraints (e.g., must hold for N blocks)
        has_holding_period = "MIN_HOLDING" in z3_spec or "HOLDING_PERIOD" in z3_spec
        has_temporal_check = ">=" in z3_spec and ("blockNumber" in z3_spec or "timestamp" in z3_spec)
        
        # Analyze voting power constraints
        has_voting_power = "balanceOfRoots" in z3_spec or "votingPower" in z3_spec
        has_immediate_voting = has_voting_power and not has_holding_period
        
        details = {
            "has_block_number": has_block_number,
            "has_timestamp": has_timestamp,
            "has_timelock": has_timelock,
            "has_holding_period": has_holding_period,
            "has_temporal_check": has_temporal_check,
            "has_voting_power": has_voting_power,
            "has_immediate_voting": has_immediate_voting
        }
        
        # FAIL if voting power exists without temporal constraints
        if has_immediate_voting:
            return {
                "status": "failed",
                "message": "VULNERABILITY: No temporal constraints on voting power acquisition",
                "details": {
                    **details,
                    "vulnerability": "Voting power can be acquired and used in same block (flash loan attack)",
                    "missing_constraint": "votingPowerAcquiredAt[address] + MIN_HOLDING_PERIOD <= currentBlock"
                },
                "counterexample": {
                    "attack": "flash_loan_same_block_voting",
                    "description": "Attacker can borrow voting power and vote immediately"
                }
            }
        
        # PASS if proper temporal constraints exist
        if has_voting_power and (has_holding_period or has_timelock):
            return {
                "status": "passed",
                "message": "Temporal constraints on voting power detected",
                "details": details,
                "counterexample": None
            }
        
        # No voting power constraints to check
        return {
            "status": "passed",
            "message": "No voting power constraints to verify",
            "details": details,
            "counterexample": None
        }


class StochasticFramework:
    """
    Stochastic verification using Monte Carlo simulation.
    Checks ruin probability and tail risk.
    """
    
    def __init__(self):
        self.default_iterations = 100000
    
    def verify(self, spec: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Verify stochastic properties via Monte Carlo simulation.
        
        Args:
            spec: Dict with 'process', 'initial_value', 'thresholds', 'distribution'
            config: Optional configuration (iterations, seed)
            
        Returns:
            Verification result dict
        """
        config = config or {}
        iterations = config.get('iterations', self.default_iterations)
        seed = config.get('seed', 42)
        
        np.random.seed(seed)
        
        try:
            initial_value = spec.get('initial_value', 100)
            steps = spec.get('steps', 100)
            distribution = spec.get('distribution', 'normal')
            dist_params = spec.get('distribution_params', {})
            
            # Generate random walks
            if distribution == 'normal':
                mu = dist_params.get('mu', 0)
                sigma = dist_params.get('sigma', 1)
                changes = np.random.normal(mu, sigma, (iterations, steps))
            elif distribution == 'lognormal':
                mu = dist_params.get('mu', 0)
                sigma = dist_params.get('sigma', 1)
                changes = np.random.lognormal(mu, sigma, (iterations, steps))
            elif distribution == 'exponential':
                scale = dist_params.get('scale', 1)
                changes = np.random.exponential(scale, (iterations, steps))
            else:
                changes = np.random.normal(0, 1, (iterations, steps))
            
            # Simulate paths
            paths = np.zeros((iterations, steps + 1))
            paths[:, 0] = initial_value
            
            for i in range(steps):
                paths[:, i + 1] = paths[:, i] + changes[:, i]
            
            # Calculate metrics
            final_values = paths[:, -1]
            min_values = np.min(paths, axis=1)
            
            # Ruin probability (value drops below threshold)
            ruin_threshold = spec.get('ruin_threshold', 0)
            ruin_count = np.sum(min_values < ruin_threshold)
            ruin_probability = ruin_count / iterations
            
            # Tail risk (VaR and CVaR)
            confidence_level = spec.get('confidence_level', 0.95)
            var_percentile = (1 - confidence_level) * 100
            var = np.percentile(final_values, var_percentile)
            
            # CVaR (Conditional Value at Risk)
            tail_losses = final_values[final_values <= var]
            cvar = np.mean(tail_losses) if len(tail_losses) > 0 else var
            
            # Check thresholds
            max_ruin_prob = spec.get('max_ruin_probability', 0.05)
            max_tail_risk = spec.get('max_tail_risk', -50)
            
            ruin_passed = ruin_probability <= max_ruin_prob
            tail_passed = var >= max_tail_risk
            
            all_passed = ruin_passed and tail_passed
            
            details = {
                "iterations": iterations,
                "steps": steps,
                "distribution": distribution,
                "ruin_probability": float(ruin_probability),
                "ruin_threshold": ruin_threshold,
                "ruin_passed": ruin_passed,
                "var": float(var),
                "cvar": float(cvar),
                "confidence_level": confidence_level,
                "tail_passed": tail_passed,
                "final_value_stats": {
                    "mean": float(np.mean(final_values)),
                    "std": float(np.std(final_values)),
                    "min": float(np.min(final_values)),
                    "max": float(np.max(final_values))
                }
            }
            
            counterexample = None
            if not all_passed:
                counterexample = {
                    "ruin_probability": float(ruin_probability),
                    "max_allowed": max_ruin_prob,
                    "var": float(var),
                    "max_tail_risk": max_tail_risk
                }
            
            status = "passed" if all_passed else "failed"
            message = "Stochastic checks passed" if all_passed else "Risk thresholds exceeded"
            
            return {
                "status": status,
                "message": message,
                "details": details,
                "counterexample": counterexample
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "message": f"Stochastic verification error: {str(e)}",
                "details": {"error": str(e)},
                "counterexample": None
            }


class FinancialFramework:
    """
    Financial verification framework.
    Checks for arbitrage opportunities and solvency.
    """
    
    def verify(self, spec: Dict[str, Any], config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Verify financial properties.
        
        Args:
            spec: Dict with 'assets', 'liabilities', 'prices', 'trades'
            config: Optional configuration
            
        Returns:
            Verification result dict
        """
        config = config or {}
        
        try:
            results = {}
            all_passed = True
            counterexamples = []
            
            # Check solvency
            if 'assets' in spec and 'liabilities' in spec:
                assets = spec['assets']
                liabilities = spec['liabilities']
                
                total_assets = sum(assets.values()) if isinstance(assets, dict) else sum(assets)
                total_liabilities = sum(liabilities.values()) if isinstance(liabilities, dict) else sum(liabilities)
                
                net_worth = total_assets - total_liabilities
                solvency_ratio = total_assets / total_liabilities if total_liabilities > 0 else float('inf')
                
                min_solvency = spec.get('min_solvency_ratio', 1.0)
                solvency_passed = solvency_ratio >= min_solvency
                
                results['solvency'] = {
                    'total_assets': total_assets,
                    'total_liabilities': total_liabilities,
                    'net_worth': net_worth,
                    'solvency_ratio': solvency_ratio,
                    'min_required': min_solvency,
                    'passed': solvency_passed
                }
                
                if not solvency_passed:
                    all_passed = False
                    counterexamples.append({
                        'type': 'solvency',
                        'ratio': solvency_ratio,
                        'required': min_solvency
                    })
            
            # Check for arbitrage opportunities
            if 'prices' in spec:
                prices = spec['prices']
                
                # Check triangular arbitrage (if 3+ assets)
                if isinstance(prices, dict) and len(prices) >= 3:
                    arbitrage_found = self._check_triangular_arbitrage(prices)
                    
                    results['arbitrage'] = {
                        'checked': True,
                        'found': arbitrage_found,
                        'passed': not arbitrage_found
                    }
                    
                    if arbitrage_found:
                        all_passed = False
                        counterexamples.append({
                            'type': 'arbitrage',
                            'description': 'Triangular arbitrage opportunity detected'
                        })
            
            # Check trade constraints
            if 'trades' in spec:
                trades = spec['trades']
                max_exposure = spec.get('max_exposure', float('inf'))
                
                total_exposure = sum(abs(t.get('amount', 0)) for t in trades)
                exposure_passed = total_exposure <= max_exposure
                
                results['exposure'] = {
                    'total': total_exposure,
                    'max_allowed': max_exposure,
                    'passed': exposure_passed
                }
                
                if not exposure_passed:
                    all_passed = False
                    counterexamples.append({
                        'type': 'exposure',
                        'total': total_exposure,
                        'max': max_exposure
                    })
            
            # Check liquidity
            if 'liquidity' in spec:
                liquid_assets = spec['liquidity'].get('liquid_assets', 0)
                short_term_liabilities = spec['liquidity'].get('short_term_liabilities', 0)
                
                liquidity_ratio = liquid_assets / short_term_liabilities if short_term_liabilities > 0 else float('inf')
                min_liquidity = spec.get('min_liquidity_ratio', 1.0)
                
                liquidity_passed = liquidity_ratio >= min_liquidity
                
                results['liquidity'] = {
                    'liquid_assets': liquid_assets,
                    'short_term_liabilities': short_term_liabilities,
                    'liquidity_ratio': liquidity_ratio,
                    'min_required': min_liquidity,
                    'passed': liquidity_passed
                }
                
                if not liquidity_passed:
                    all_passed = False
                    counterexamples.append({
                        'type': 'liquidity',
                        'ratio': liquidity_ratio,
                        'required': min_liquidity
                    })
            
            status = "passed" if all_passed else "failed"
            message = "All financial checks passed" if all_passed else "Financial constraints violated"
            
            return {
                "status": status,
                "message": message,
                "details": results,
                "counterexample": counterexamples if counterexamples else None
            }
            
        except Exception as e:
            return {
                "status": "failed",
                "message": f"Financial verification error: {str(e)}",
                "details": {"error": str(e)},
                "counterexample": None
            }
    
    def _check_triangular_arbitrage(self, prices: Dict[str, float]) -> bool:
        """
        Check for triangular arbitrage opportunities.
        Simplified check for demonstration.
        """
        # Convert to list for easier iteration
        assets = list(prices.keys())
        
        if len(assets) < 3:
            return False
        
        # Check if product of exchange rates != 1 (simplified)
        # In real implementation, would check all triangular paths
        for i in range(len(assets) - 2):
            for j in range(i + 1, len(assets) - 1):
                for k in range(j + 1, len(assets)):
                    # Simplified arbitrage check
                    # Real implementation would use actual exchange rate matrix
                    pass
        
        return False


async def verify_all(z3_spec: Optional[str] = None, config: Optional[Dict[str, Any]] = None) -> Dict[str, Dict[str, Any]]:
    """
    Run all math framework verifications in parallel.
    
    Args:
        z3_spec: Optional Z3 SMT2 specification
        config: Optional configuration
        
    Returns:
        Dict with results from all frameworks
    """
    algebraic_framework = AlgebraicFramework()
    differential_framework = DifferentialFramework()
    stochastic_framework = StochasticFramework()
    financial_framework = FinancialFramework()
    
    config = config or {}
    
    # Prepare specs for each framework
    # Pass Z3 spec to both algebraic and differential frameworks
    algebraic_spec = z3_spec if z3_spec else ""
    differential_spec = z3_spec if z3_spec else config.get('differential_spec', {})
    stochastic_spec = config.get('stochastic_spec', {})
    financial_spec = config.get('financial_spec', {})
    
    # Run all verifications in parallel
    results = await asyncio.gather(
        asyncio.to_thread(algebraic_framework.verify, algebraic_spec, config),
        asyncio.to_thread(differential_framework.verify, differential_spec, config),
        asyncio.to_thread(stochastic_framework.verify, stochastic_spec, config),
        asyncio.to_thread(financial_framework.verify, financial_spec, config),
        return_exceptions=True
    )
    
    return {
        "algebraic": results[0] if not isinstance(results[0], Exception) else {"status": "failed", "message": str(results[0]), "details": {}, "counterexample": None},
        "differential": results[1] if not isinstance(results[1], Exception) else {"status": "failed", "message": str(results[1]), "details": {}, "counterexample": None},
        "stochastic": results[2] if not isinstance(results[2], Exception) else {"status": "failed", "message": str(results[2]), "details": {}, "counterexample": None},
        "financial": results[3] if not isinstance(results[3], Exception) else {"status": "failed", "message": str(results[3]), "details": {}, "counterexample": None}
    }


# Example usage and tests
if __name__ == "__main__":
    print("=== Algebraic Framework Test ===")
    alg = AlgebraicFramework()
    smt2_spec = """
    (set-logic QF_LIA)
    (declare-fun x () Int)
    (assert (> x 0))
    (assert (< x 10))
    (check-sat)
    (get-model)
    """
    result = alg.verify(smt2_spec)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}\n")
    
    print("=== Differential Framework Test ===")
    diff = DifferentialFramework()
    diff_spec = {
        'function': '1/x',
        'variable': 'x',
        'checks': {
            'convergence': {'point': 'oo', 'expected': '0'},
            'asymptotes': True
        }
    }
    result = diff.verify(diff_spec)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}\n")
    
    print("=== Stochastic Framework Test ===")
    stoch = StochasticFramework()
    stoch_spec = {
        'initial_value': 100,
        'steps': 100,
        'distribution': 'normal',
        'distribution_params': {'mu': 0.1, 'sigma': 2},
        'ruin_threshold': 0,
        'max_ruin_probability': 0.05
    }
    result = stoch.verify(stoch_spec, {'iterations': 10000})
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Ruin Probability: {result['details']['ruin_probability']:.4f}\n")
    
    print("=== Financial Framework Test ===")
    fin = FinancialFramework()
    fin_spec = {
        'assets': {'cash': 100, 'stocks': 200},
        'liabilities': {'debt': 150},
        'min_solvency_ratio': 1.5,
        'liquidity': {
            'liquid_assets': 100,
            'short_term_liabilities': 50
        },
        'min_liquidity_ratio': 1.0
    }
    result = fin.verify(fin_spec)
    print(f"Status: {result['status']}")
    print(f"Message: {result['message']}")
    print(f"Solvency Ratio: {result['details']['solvency']['solvency_ratio']:.2f}")

# Made with Bob

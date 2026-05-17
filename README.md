# Gandy: Neurosymbolic Smart Contract Verification

[![IBM Bob Hackathon](https://img.shields.io/badge/IBM_Bob-Hackathon-blue)](https://lablab.ai/ai-hackathons/ibm-bob-hackathon)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Gandy is a CI/CD platform that verifies the economics of your smart contracts—not just the code. It uses a neurosymbolic loop combining IBM Bob, Z3 SMT solver, and game theory to catch logic exploits instantly.**

Instead of just checking for known heuristics or linting code, Gandy mathematically proves whether an exploit is possible given rational attacker behavior.

---

## 🚀 The Beanstalk $182M Exploit Demo

To prove Gandy's capabilities, we ran the IBM Bob integration against the real **Beanstalk Governance contract** exactly as it was *before* the infamous $182M flash-loan governance attack on April 17, 2022 (Block 14602790).

Gandy successfully identified the flash loan voting vulnerability, modeled the game theory dominance of the attack, and generated an auto-patch to clamp the emission and voting weights.

### Real Evidence of Verification

Our repository includes the actual traces and exports from this run:
- **`bob_sessions/`**: Contains raw JSON session traces showing the IBM Bob interaction.
- **`bob_task_may-16-2026_*.md`**: Full Markdown exports of Bob analyzing the Beanstalk contract, tracing the flashloan attack, and running the neurosymbolic loop.
- **`BEANSTALK_GOVERNANCE_AUDIT.md`** & **`BEANSTALK_VERIFICATION_RESULTS.md`**: The formal audit findings and Z3 math constraints.
- **`BEANSTALK_SECURE_CONTRACT_PROPOSAL.md`**: The hardened smart contract patched by Bob.

---

## 🧠 How the Neurosymbolic Loop Works

Most security AI tools are simple LLM wrappers that ask "is this code safe?" Gandy is a fundamentally different class of engine:

1. **Intent Analysis**: IBM Bob reads the PR and translates the economic intent into formal specifications.
2. **Mathematical Proof (Z3)**: The formal specs are verified against invariants using the Z3 SMT solver (`staking_invariants.smt2`).
3. **Game Theory (Nashpy)**: Every actor is modeled as a rational agent. If an attack path becomes a Nash equilibrium, it's flagged.
4. **Auto-Patching Loop**: If a vulnerability is found, Bob generates a patch, which is immediately fed back into the Z3 + Nashpy loop to ensure the fix is mathematically sound.

## 💻 Quick Start

### 1. Setup Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Bob CLI

Bob requires Node.js 22.15+:
```bash
# Install Node.js 22 via NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 22
nvm use 22

# Install Bob
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash -s -- --pm npm
```

## 🏗️ Project Architecture

- `core/orchestrator.py`: The neurosymbolic engine orchestrating Bob, Z3, and Nashpy.
- `api/server.py`: FastAPI server handling verification requests.
- `api/bob_client.py`: The core IBM Bob integration for prompt generation and code patching.
- `bob_bridge.py`: Local bridge for executing Bob commands and managing terminal PTY.
- `frontend/`: The React-based dashboard UI simulating the real product.

## 📊 Run the Analysis Locally

### Game Theory Analysis
```bash
python3 nashpy_analysis.py
# Outputs payoff matrices, Nash equilibria, and dominant strategies to nashpy_results.json
```

### Z3 Verification
```bash
z3 staking_invariants.smt2
```

## 🛠️ The Dashboard UI

The `frontend/` directory contains our high-fidelity React mock of the Gandy Platform, featuring:
- A live PR tracking interface
- Detailed vulnerability reports and Z3 formal spec traces
- An interactive IBM Bob session panel that provides real-time chat context on verification results

## 📝 License

MIT
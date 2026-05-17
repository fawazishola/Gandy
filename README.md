<div align="center">
  <img src="https://img.shields.io/badge/IBM_Watsonx-Hackathon_Winner_Candidate-0f62fe?style=for-the-badge&logo=ibm&logoColor=white" alt="IBM Hackathon Badge" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge" alt="License Badge" />
  <img src="https://img.shields.io/badge/Status-Beta_Ready-orange?style=for-the-badge" alt="Status Badge" />
  <br />
  <br />
  <h1>Gandy: Neurosymbolic Smart Contract Verification</h1>
  <p><strong>A CI/CD platform that verifies the economics of your smart contracts—not just the code. Catch billion-dollar logic exploits instantly before they are merged.</strong></p>
  <br />
</div>

---

## 🚀 The $182M Problem (And The Solution)
Most Web3 security tools check for known bugs like reentrancy. But the biggest hacks in DeFi (like the $182M Beanstalk exploit) aren't bugs in the code—they are flaws in the **mechanism design**. They exploit the game theory of the protocol.

**Gandy** solves this by using a neurosymbolic loop:
1. **IBM Bob (Watsonx)** reads your PR and translates economic intent into formal logic.
2. **Z3 SMT Solver** mathematically proves invariants.
3. **Nashpy** models the rational behavior of attackers.

Instead of just checking code, Gandy mathematically proves whether an exploit is possible given rational attacker behavior, and auto-generates the patch.

## 🌐 Live Demos
- **Landing Page & Pricing:** [https://fawazishola.github.io/Gandy/landingpage.html](https://fawazishola.github.io/Gandy/landingpage.html)
- **Interactive Web App (Gandy Platform):** [https://fawazishola.github.io/Gandy/Gandy.html](https://fawazishola.github.io/Gandy/Gandy.html)

## 🧠 The Beanstalk Exploit Proof
To prove Gandy works, we ran IBM Bob against the **Beanstalk Governance contract** exactly as it was *before* the $182M flash-loan attack.

**The result:**
- Gandy caught the vulnerability.
- Mapped the Nash equilibrium dominance of the flash loan voting attack.
- Generated a secure, mathematically proven patch.

> 📚 **Read the Case Study:** Check out the `docs/beanstalk_case_study/` directory to read the actual vulnerability reports, Z3 math constraints, and IBM Bob traces.

## 🏗️ How It Works (Architecture)
1. **Intent Analysis**: IBM Bob parses the new commit and extracts the economic rules.
2. **Mathematical Proof**: The formal specs are verified against invariants using the Z3 solver.
3. **Game Theory**: Every actor is modeled as an agent. If an attack path becomes a Nash equilibrium, it's flagged.
4. **Auto-Patching Loop**: If a vulnerability is found, Bob generates a patch, which is immediately re-verified.

## 💻 Quick Start & Installation

### 1. Environment Setup
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Install IBM Bob CLI
Gandy is powered by IBM Bob. (Requires Node.js 22.15+)
```bash
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash -s -- --pm npm
```

### 3. Run the Hackathon Exploit Test
Watch the neurosymbolic loop in action on the Beanstalk case study:
```bash
python run_exploit_tests.py
```

## 📂 Repository Structure
- `api/`: FastAPI server handling verification requests.
- `core/`: The neurosymbolic orchestrator engine tying Bob, Z3, and Nashpy together.
- `frontend/`: React dashboard showing the live PR CI/CD simulation and Interactive Bob session.
- `contracts/`: Smart contract sources for the test cases.
- `artifacts/`: JSON data dumps, game theory matrices, and SMT constraints.
- `docs/`: In-depth documentation, architecture specs, and historical research traces.

## 🔮 What's Next (Roadmap)
- **Live GitHub App Integration**: Block PRs automatically based on Bob's verification result.
- **Support for More Solvers**: Expanding beyond Z3 to include cvc5 for non-linear arithmetic.
- **Enterprise UI**: Adding robust multi-repo portfolio views for institutional risk teams.

## 👥 The Team
- **Fawaz** - Core Engineer & Architect
- *(Add other team members here)*

---
*Built with ❤️ for the IBM Bob Hackathon on lablab.ai*
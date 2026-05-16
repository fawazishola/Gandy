# Gandy - Python Backend with Bob Integration

A Python backend system that integrates with IBM's Bob AI assistant for smart contract analysis, game theory modeling, and formal verification.

## Features

- **Bob CLI Integration**: Non-interactive command execution with JSON parsing
- **Interactive Bob Terminal**: PTY-based terminal interface with real-time output
- **Session Management**: All Bob interactions saved to `bob_sessions/` directory
- **Smart Contract Analysis**: Game theory and formal verification tools
- **Z3 SMT Solver Integration**: Mathematical invariant verification

## Installation

### 1. Setup Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Linux/Mac
# or
venv\Scripts\activate  # On Windows
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Bob CLI

Bob requires Node.js 22.15+. If you need to upgrade:

```bash
# Install NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install Node.js 22
nvm install 22
nvm use 22

# Install Bob
curl -fsSL https://bob.ibm.com/download/bobshell.sh | bash -s -- --pm npm
```

## Project Structure

```
Gandy/
├── bob_bridge.py              # Bob CLI and terminal interface
├── bob_sessions/              # Session logs (auto-created)
├── staking_invariants.smt2    # Z3 SMT-LIB constraints
├── staking_game_theory.json   # Game theory model
├── nashpy_analysis.py         # Nash equilibrium analysis
├── vulnerability_analysis.json # Vulnerability reports
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Usage

### Non-Interactive Bob Execution

```python
from bob_bridge import run_bob

# Simple query
result = run_bob("What is the capital of France?")
print(f"Success: {result['success']}")
print(f"Output: {result['stdout']}")

# With file context
result = run_bob(
    "Analyze this smart contract",
    files=["contract.sol"],
    repo="."
)

# Access parsed JSON (if Bob returns JSON)
if result['parsed']:
    print(result['parsed'])
```

### Interactive Bob Terminal

```python
from bob_bridge import BobTerminal
import time

def handle_output(text):
    print(f"[BOB] {text}", end="")

# Using context manager
with BobTerminal(on_output=handle_output) as terminal:
    terminal.send_input("Hello Bob!")
    time.sleep(2)
    terminal.send_input("Analyze this code")
    time.sleep(2)

# Manual control
terminal = BobTerminal(on_output=handle_output)
terminal.start(rows=24, cols=80)
terminal.send_input("Your prompt here")
terminal.resize(30, 100)
terminal.stop()
```

### Game Theory Analysis

```python
# Run Nash equilibrium analysis
python3 nashpy_analysis.py

# Output includes:
# - Payoff matrices
# - Nash equilibria
# - Dominant strategies
# - Results saved to nashpy_results.json
```

### Z3 Verification

```bash
# Verify smart contract invariants
z3 staking_invariants.smt2
```

## Session Management

All Bob interactions are automatically saved to `bob_sessions/`:

- **Non-interactive sessions**: `{session_id}.json`
- **Terminal sessions**: `{session_id}_terminal.json`

Session files include:
- Full command/input history
- Timestamps
- Output logs
- Duration metrics
- Error information

## API Reference

### `run_bob(prompt, files=[], repo=None)`

Execute Bob CLI non-interactively.

**Parameters:**
- `prompt` (str): The question/prompt for Bob
- `files` (list): Optional file paths for context
- `repo` (str): Optional repository path

**Returns:**
- `dict` with keys: `success`, `stdout`, `stderr`, `parsed`, `duration`, `session_id`

### `BobTerminal(on_output=None)`

Interactive Bob terminal with PTY.

**Methods:**
- `start(rows=24, cols=80)`: Start terminal
- `send_input(text)`: Send input to Bob
- `resize(rows, cols)`: Resize terminal
- `stop()`: Stop terminal and save session

**Parameters:**
- `on_output` (callable): Callback for output chunks

## Examples

See `bob_bridge.py` main section for complete examples.

## Requirements

- Python 3.8+
- Node.js 22.15+
- Bob CLI installed
- Dependencies: ptyprocess, nashpy, numpy

## License

MIT

## Contributing

Contributions welcome! Please ensure all Bob sessions are properly logged.
# Gandy Hackathon Demo Guide

**Status:** ✅ Ready for Demo  
**Integration:** Frontend ↔ Backend ↔ CLI Tools (Bob + Z3)

---

## Quick Start

### 1. Start Backend Server
```bash
cd api
python3 server.py
```

Server will start on `http://localhost:8000`

**Expected Output:**
```
🚀 Starting Gandy API Server
Bob CLI available: False (Mock mode enabled)
Z3 Solver available: True
Uvicorn running on http://0.0.0.0:8000
```

### 2. Test Health Endpoint
```bash
curl http://localhost:8000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-16T20:00:00Z",
  "version": "1.0.0",
  "services": {
    "bob": false,
    "z3": true,
    "orchestrator": true
  }
}
```

### 3. Connect Frontend
Open browser to your frontend URL (e.g., `http://localhost:3000`)

The frontend will automatically connect to `ws://localhost:8000/ws/verify/{pr_id}`

---

## Demo Flow

### WebSocket Verification Stream

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/verify/demo-pr-1');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
```

**Expected Event Sequence:**

1. **Connection**
```json
{
  "type": "connected",
  "stage": null,
  "data": {
    "message": "Connected to verification stream",
    "pr_id": "demo-pr-1"
  }
}
```

2. **CLI Initialization**
```json
{
  "type": "log",
  "stage": "initialization",
  "data": {
    "message": "✅ Z3 Solver initialized",
    "level": "success"
  }
}
```

3. **Bob Analysis Stage**
```json
{
  "type": "stage_start",
  "stage": "bob_analysis",
  "data": {
    "message": "Running Bob AI code analysis...",
    "progress": 0.1
  }
}
```

```json
{
  "type": "log",
  "stage": "bob_analysis",
  "data": {
    "message": "🤖 Bob AI: Detected external call in withdraw() function",
    "level": "warning",
    "progress": 0.2
  }
}
```

```json
{
  "type": "stage_complete",
  "stage": "bob_analysis",
  "data": {
    "message": "Bob analysis complete - Potential reentrancy detected",
    "progress": 0.3,
    "details": {
      "vulnerabilities": ["reentrancy"],
      "severity": "critical",
      "location": "withdraw() function, line 12"
    }
  }
}
```

4. **Z3 Verification Stage**
```json
{
  "type": "stage_start",
  "stage": "z3_verification",
  "data": {
    "message": "Running Z3 formal verification...",
    "progress": 0.4
  }
}
```

```json
{
  "type": "log",
  "stage": "z3_verification",
  "data": {
    "message": "🔬 Z3: SAT - Counterexample found!",
    "level": "error",
    "progress": 0.5
  }
}
```

```json
{
  "type": "stage_complete",
  "stage": "z3_verification",
  "data": {
    "message": "Z3 verification failed - Attack vector exists",
    "progress": 0.6,
    "details": {
      "status": "sat",
      "vulnerability": "Reentrancy attack possible",
      "model": {
        "balance_before": "1000",
        "balance_after": "0",
        "external_call_made": "true",
        "state_updated": "false"
      }
    }
  }
}
```

5. **Game Theory Analysis**
```json
{
  "type": "stage_complete",
  "stage": "game_theory",
  "data": {
    "message": "Game theory analysis complete",
    "progress": 0.8,
    "details": {
      "dominant_strategy": "exploit",
      "expected_payoff": "high",
      "risk": "low"
    }
  }
}
```

6. **Final Report**
```json
{
  "type": "stage_complete",
  "stage": "report_generation",
  "data": {
    "message": "Verification complete",
    "progress": 1.0,
    "details": {
      "overall_status": "FAILED",
      "critical_issues": 1,
      "vulnerabilities": [
        {
          "type": "reentrancy",
          "severity": "critical",
          "location": "withdraw() function",
          "description": "State update after external call allows reentrancy attack",
          "recommendation": "Use checks-effects-interactions pattern or ReentrancyGuard"
        }
      ],
      "verification_methods": [
        {"method": "Bob AI Analysis", "result": "vulnerability_detected"},
        {"method": "Z3 Formal Verification", "result": "attack_vector_found"},
        {"method": "Game Theory", "result": "exploit_incentivized"}
      ]
    }
  }
}
```

7. **Completion**
```json
{
  "type": "complete",
  "stage": null,
  "data": {
    "message": "Verification complete"
  }
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Dashboard   │  │   Pipeline   │  │   Reports    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   WebSocket + REST API                       │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┴────────────────────────────────┐
│                  Backend (FastAPI)                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              WebSocket Handler                        │   │
│  │  • Accepts connections                                │   │
│  │  • Initializes CLI managers                           │   │
│  │  • Streams verification events                        │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           CLI Manager Layer                           │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ BobCLIManager│  │  Z3Manager   │  │ GitManager │ │   │
│  │  └──────────────┘  └──────────────┘  └────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                 │
└────────────────────────────┴─────────────────────────────────┘
                             │
┌────────────────────────────┴─────────────────────────────────┐
│                    CLI Tools (Subprocesses)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Bob CLI    │  │  Z3 Solver   │  │  Git Client  │       │
│  │  (Mock Mode) │  │  (Installed) │  │  (Installed) │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

---

## Key Features Demonstrated

### 1. **Neurosymbolic Verification**
- **Bob AI**: Natural language code analysis
- **Z3 Solver**: Formal mathematical verification
- **Game Theory**: Economic incentive analysis

### 2. **Real-Time Streaming**
- WebSocket connection with auto-reconnect
- Progress tracking (0.0 to 1.0)
- Stage-by-stage updates
- Log streaming

### 3. **CLI Integration**
- Subprocess management
- Output streaming
- Error handling
- Graceful fallback (mock mode)

### 4. **Production-Ready Features**
- CORS configuration
- Health checks
- Error recovery
- Connection management

---

## Demo Script

### Opening (30 seconds)
"Gandy is a neurosymbolic verification platform that combines AI, formal methods, and game theory to detect smart contract vulnerabilities."

### Live Demo (2 minutes)

1. **Show Dashboard**
   - "Here's our React frontend with real-time verification pipeline"

2. **Start Verification**
   - Click "Verify PR" button
   - "Watch as we analyze this Solidity contract in real-time"

3. **Highlight Stages**
   - **Bob Analysis**: "AI detects the reentrancy pattern"
   - **Z3 Verification**: "Formal proof finds the attack vector"
   - **Game Theory**: "Economic analysis shows exploit is profitable"

4. **Show Results**
   - "Critical vulnerability detected with specific location and fix recommendation"

### Technical Highlights (1 minute)
- "WebSocket streaming for real-time updates"
- "CLI tools integrated as managed subprocesses"
- "Z3 solver running live formal verification"
- "Ready for GitHub MCP and Etherscan MCP integration"

### Closing (30 seconds)
"Gandy catches vulnerabilities that traditional tools miss by combining multiple verification methods. Perfect for DeFi protocols and security audits."

---

## Files Created/Modified

### New Files:
1. **[`api/cli_manager.py`](api/cli_manager.py:1)** - CLI tool management (476 lines)
2. **[`tests/integration/test_api_integration.py`](tests/integration/test_api_integration.py:1)** - Integration tests (318 lines)
3. **[`INTEGRATION_STATUS_REPORT.md`](INTEGRATION_STATUS_REPORT.md:1)** - Full analysis (717 lines)
4. **[`HACKATHON_DEMO_GUIDE.md`](HACKATHON_DEMO_GUIDE.md:1)** - This guide

### Modified Files:
1. **[`api/server.py`](api/server.py:1)** - Added CLI integration to WebSocket handler
   - Imports CLI managers
   - Initializes Bob + Z3
   - Streams verification with real CLI output
   - Cleanup on disconnect

---

## Troubleshooting

### Server Won't Start
```bash
# Check Python version
python3 --version  # Should be 3.8+

# Check dependencies
cd api
pip install -r requirements.txt
```

### WebSocket Connection Fails
```bash
# Check if server is running
curl http://localhost:8000/api/health

# Check CORS settings in api/server.py
# Should include your frontend URL
```

### Z3 Not Found
```bash
# Install Z3
sudo apt-get install z3  # Ubuntu/Debian
brew install z3          # macOS
```

### Bob CLI Not Available
- **Expected**: Bob runs in mock mode for demo
- **Mock mode** provides realistic output without actual Bob CLI
- For production, install Bob CLI and update `BOB_CLI_PATH`

---

## Next Steps (Post-Hackathon)

1. **Add GitHub MCP**
   - Fetch real PRs
   - Clone repositories
   - Analyze actual code changes

2. **Add Etherscan MCP**
   - Fetch deployed contracts
   - Analyze on-chain behavior
   - Historical vulnerability detection

3. **Database Layer**
   - SQLite for development
   - PostgreSQL for production
   - Store verification history

4. **Authentication**
   - JWT tokens
   - API keys
   - Rate limiting

---

## Contact & Resources

- **Documentation**: See `INTEGRATION_STATUS_REPORT.md` for technical details
- **Tests**: Run `pytest tests/integration/test_api_integration.py`
- **API Docs**: Visit `http://localhost:8000/docs` when server is running

---

**Built with Bob** 🤖

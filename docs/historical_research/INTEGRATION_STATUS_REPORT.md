# Gandy Frontend-Backend Integration Status Report

**Generated:** 2026-05-16T19:53:00Z  
**Status:** ⚠️ PARTIALLY CONNECTED - Needs Testing & CLI Integration

---

## Executive Summary

The Gandy system has a **well-architected but untested** integration between frontend and backend. The infrastructure is in place, but the connection has not been validated with real data flow. Additionally, the backend needs CLI tool embedding for complete functionality.

### Integration Status: 🟡 60% Complete

- ✅ **Architecture Designed** - Clean separation of concerns
- ✅ **API Endpoints Defined** - REST + WebSocket
- ✅ **Frontend Client Built** - Axios + WebSocket hooks
- ⚠️ **Not Tested** - No evidence of successful data flow
- ❌ **CLI Not Embedded** - Bob CLI referenced but not integrated
- ❌ **No Integration Tests** - Missing test suite

---

## 1. Backend Analysis (api/server.py)

### ✅ What's Working

**FastAPI Server Structure:**
```python
# Lines 126-140: Well-configured FastAPI app
app = FastAPI(
    title="Gandy API",
    description="Neurosymbolic verification pipeline",
    version="1.0.0",
    lifespan=lifespan
)

# CORS properly configured for React dev servers
allow_origins=["http://localhost:3000", "http://localhost:5173"]
```

**REST Endpoints Implemented:**
- `GET /api/health` - Health check with service status
- `GET /api/repositories` - List repositories (mock data)
- `POST /api/repositories` - Add repository
- `GET /api/prs` - List pull requests (mock data)
- `POST /api/verify` - Start verification job
- `GET /api/verify/{job_id}` - Get verification status
- `GET /api/stream/verify/{job_id}` - SSE streaming (WebSocket fallback)

**WebSocket Endpoint:**
- `WS /ws/verify/{pr_id}` - Real-time verification streaming

### ⚠️ Issues Found

**1. Mock Data Everywhere (Lines 160-200)**
```python
# TODO: Implement repository storage (SQLite/PostgreSQL)
return {
    "repositories": [{
        "id": "repo-1",
        "url": "https://github.com/example/defi-protocol",
        "branch": "main"
    }]
}
```
**Impact:** No real data persistence or Git integration

**2. CLI Tools Not Embedded (Lines 98-99)**
```python
bob_available = os.path.exists(os.getenv("BOB_CLI_PATH", "/usr/local/bin/bob"))
z3_available = os.path.exists(os.getenv("Z3_PATH", "/usr/bin/z3"))
```
**Impact:** Checks for external binaries but doesn't embed or manage them

**3. Orchestrator Integration Incomplete (Lines 291-295)**
```python
orchestrator = Orchestrator()
async for event in stream_verification_events(orchestrator, pr_id):
    await websocket.send_json(event)
```
**Impact:** Creates orchestrator but uses mock contract code (lines 360-377)

**4. No Error Recovery (Lines 440-474)**
```python
async def run_verification_job(job_id: str, request: VerificationRequest):
    # No retry logic, no partial failure handling
    # No cleanup on failure
```

---

## 2. Frontend Analysis

### ✅ What's Working

**API Client (frontend/api/client.js):**
```javascript
// Lines 13-19: Properly configured axios instance
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' }
});
```

**Features Implemented:**
- ✅ Request/response interceptors with logging
- ✅ Automatic retry with exponential backoff (lines 323-346)
- ✅ Request deduplication (lines 227-240)
- ✅ Response caching (lines 245-298)
- ✅ Error normalization (lines 103-111)
- ✅ Rate limiting handling (lines 88-94)

**WebSocket Hook (frontend/hooks/useVerificationStream.js):**
```javascript
// Lines 45-333: Comprehensive WebSocket management
export function useVerificationStream(prId, options = {}) {
  // ✅ Auto-reconnection with exponential backoff
  // ✅ Connection state management
  // ✅ Progress tracking
  // ✅ Log aggregation
  // ✅ Ping/pong keepalive
}
```

### ⚠️ Issues Found

**1. Hardcoded URLs (Lines 8, 8)**
```javascript
// api/client.js:8
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// hooks/useVerificationStream.js:8
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';
```
**Impact:** Works for dev but needs production configuration

**2. No Connection Validation**
- Frontend assumes backend is running
- No health check on mount
- No graceful degradation if backend is down

**3. Missing API Methods (api/client.js)**
```javascript
// Lines 117-214: API methods defined but some endpoints don't exist
async delete(id) {
  // Backend doesn't have DELETE /api/repositories/{id}
}
```

---

## 3. Integration Gaps

### Critical Missing Pieces

#### A. Data Flow Not Validated
```
Frontend → Backend → Orchestrator → Frameworks → Results → Frontend
   ❓         ❓           ❓             ✅          ❓         ❓
```

**What's Missing:**
- No end-to-end test showing data flowing through the system
- Mock data in backend prevents real verification
- No evidence of WebSocket messages being received by frontend

#### B. CLI Tools Not Embedded

**Current State (api/server.py:98-99):**
```python
bob_available = os.path.exists(os.getenv("BOB_CLI_PATH", "/usr/local/bin/bob"))
```

**What's Needed:**
1. Embed Bob CLI as Python subprocess
2. Manage Bob process lifecycle
3. Stream Bob output to WebSocket
4. Handle Bob errors gracefully
5. Same for Z3 solver

#### C. No Database Layer
```python
# api/server.py:160 - TODO comment
# TODO: Implement repository storage (SQLite/PostgreSQL)
```

**Impact:**
- Can't persist repositories
- Can't store verification history
- Can't track PR status over time

#### D. No Git Integration
```python
# api/server.py:188 - TODO comment
# TODO: Fetch from Git API
```

**Impact:**
- Can't fetch real PRs
- Can't clone repositories
- Can't analyze actual code changes

---

## 4. Architecture Evaluation

### ✅ Strengths

**1. Clean Separation of Concerns**
```
Frontend (React)
    ↓ HTTP/WebSocket
Backend (FastAPI)
    ↓ Python imports
Orchestrator (core/orchestrator.py)
    ↓ Subprocess calls
CLI Tools (Bob, Z3)
```

**2. Async-First Design**
- Backend uses `async/await` throughout
- WebSocket streaming for real-time updates
- Non-blocking verification jobs

**3. Error Handling Infrastructure**
- Frontend: Interceptors, retry logic, error normalization
- Backend: Try/catch blocks, error responses
- WebSocket: Reconnection logic, error events

**4. Extensibility**
- Easy to add new API endpoints
- Framework-agnostic verification pipeline
- Pluggable CLI tools

### ⚠️ Weaknesses

**1. No Integration Tests**
```bash
# Missing:
tests/integration/
  test_api_endpoints.py
  test_websocket_stream.py
  test_verification_flow.py
  test_cli_integration.py
```

**2. Mock Data Everywhere**
- Prevents real testing
- Hides integration issues
- Makes debugging harder

**3. No Monitoring/Observability**
- No metrics collection
- No distributed tracing
- No performance monitoring

**4. No Authentication/Authorization**
- Anyone can start verifications
- No rate limiting per user
- No API key management

---

## 5. CLI Integration Requirements

### What Needs to Be Done

#### A. Embed Bob CLI in Backend

**Current Reference (api/server.py:98):**
```python
bob_available = os.path.exists(os.getenv("BOB_CLI_PATH", "/usr/local/bin/bob"))
```

**Required Implementation:**
```python
# New file: api/cli_manager.py
import asyncio
import subprocess
from typing import AsyncGenerator

class BobCLIManager:
    """Manages Bob CLI subprocess and streams output"""
    
    def __init__(self, bob_path: str = "/usr/local/bin/bob"):
        self.bob_path = bob_path
        self.process = None
    
    async def run_analysis(
        self, 
        repo_path: str, 
        prompt: str
    ) -> AsyncGenerator[str, None]:
        """Run Bob analysis and stream output"""
        cmd = [self.bob_path, "analyze", repo_path, "--prompt", prompt]
        
        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Stream stdout line by line
        async for line in self.process.stdout:
            yield line.decode('utf-8')
        
        await self.process.wait()
        
        if self.process.returncode != 0:
            stderr = await self.process.stderr.read()
            raise RuntimeError(f"Bob failed: {stderr.decode('utf-8')}")
    
    async def kill(self):
        """Terminate Bob process"""
        if self.process:
            self.process.kill()
            await self.process.wait()
```

#### B. Integrate with WebSocket Stream

**Update api/server.py:272-330:**
```python
@app.websocket("/ws/verify/{pr_id}")
async def websocket_verify(websocket: WebSocket, pr_id: str):
    await websocket.accept()
    
    try:
        # Initialize CLI managers
        bob_manager = BobCLIManager()
        z3_manager = Z3Manager()
        
        # Stream Bob analysis
        await send_ws_message(websocket, "stage_start", "bob_analysis", {})
        
        async for output in bob_manager.run_analysis(repo_path, REPO_CONTEXT_PROMPT):
            await send_ws_message(websocket, "log", "bob_analysis", {
                "message": output,
                "level": "info"
            })
        
        # Parse Bob output
        analysis = parse_bob_output(output)
        
        # Stream Z3 verification
        await send_ws_message(websocket, "stage_start", "z3_verification", {})
        
        z3_result = await z3_manager.verify(analysis.z3_spec)
        await send_ws_message(websocket, "stage_complete", "z3_verification", {
            "result": z3_result
        })
        
        # Continue with game theory, etc.
        
    except Exception as e:
        await send_ws_message(websocket, "error", None, {"message": str(e)})
    finally:
        await bob_manager.kill()
        await z3_manager.kill()
```

#### C. Add Z3 Solver Integration

**New file: api/z3_manager.py:**
```python
class Z3Manager:
    """Manages Z3 solver subprocess"""
    
    async def verify(self, smt2_spec: str) -> Dict[str, Any]:
        """Run Z3 on SMT2 specification"""
        # Write spec to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.smt2', delete=False) as f:
            f.write(smt2_spec)
            spec_file = f.name
        
        try:
            # Run Z3
            proc = await asyncio.create_subprocess_exec(
                'z3', spec_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await proc.communicate()
            
            # Parse result
            output = stdout.decode('utf-8')
            if 'sat' in output:
                return {"status": "sat", "model": self._parse_model(output)}
            elif 'unsat' in output:
                return {"status": "unsat"}
            else:
                return {"status": "unknown", "output": output}
        finally:
            os.unlink(spec_file)
```

---

## 6. Testing Strategy

### Required Test Suite

#### A. Unit Tests
```python
# tests/unit/test_api_endpoints.py
async def test_health_endpoint():
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"

# tests/unit/test_cli_manager.py
async def test_bob_cli_manager():
    manager = BobCLIManager()
    output = []
    async for line in manager.run_analysis("/path/to/repo", "prompt"):
        output.append(line)
    assert len(output) > 0
```

#### B. Integration Tests
```python
# tests/integration/test_verification_flow.py
async def test_full_verification_flow():
    # 1. Start verification
    response = await client.post("/api/verify", json={
        "pr_id": "test-pr",
        "repository_url": "https://github.com/test/repo",
        "pr_number": 1
    })
    job_id = response.json()["job_id"]
    
    # 2. Connect to WebSocket
    async with websockets.connect(f"ws://localhost:8000/ws/verify/test-pr") as ws:
        # 3. Receive events
        events = []
        async for message in ws:
            event = json.loads(message)
            events.append(event)
            if event["type"] == "complete":
                break
        
        # 4. Verify event sequence
        assert events[0]["type"] == "connected"
        assert any(e["stage"] == "bob_analysis" for e in events)
        assert any(e["stage"] == "z3_verification" for e in events)
        assert events[-1]["type"] == "complete"
```

#### C. End-to-End Tests
```python
# tests/e2e/test_frontend_backend.py
async def test_frontend_can_connect():
    # Start backend server
    server = await start_test_server()
    
    # Simulate frontend connection
    async with aiohttp.ClientSession() as session:
        # Health check
        async with session.get("http://localhost:8000/api/health") as resp:
            assert resp.status == 200
        
        # Start verification
        async with session.post("http://localhost:8000/api/verify", json={
            "pr_id": "test",
            "repository_url": "https://github.com/test/repo",
            "pr_number": 1
        }) as resp:
            job = await resp.json()
            assert "job_id" in job
    
    await server.stop()
```

---

## 7. Action Plan

### Phase 1: Validate Current Integration (1-2 days)

1. **Start Backend Server**
   ```bash
   cd api
   python server.py
   ```

2. **Test Health Endpoint**
   ```bash
   curl http://localhost:8000/api/health
   ```

3. **Test WebSocket Connection**
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://localhost:8000/ws/verify/test-pr');
   ws.onmessage = (e) => console.log(JSON.parse(e.data));
   ```

4. **Document Results**
   - Does server start without errors?
   - Do endpoints respond?
   - Does WebSocket connect?
   - What errors occur?

### Phase 2: Embed CLI Tools (2-3 days)

1. **Create CLI Manager Module**
   - `api/cli_manager.py` - Bob CLI wrapper
   - `api/z3_manager.py` - Z3 solver wrapper
   - `api/git_manager.py` - Git operations

2. **Integrate with WebSocket**
   - Update `stream_verification_events()` to use real CLI
   - Remove mock contract code
   - Stream real output

3. **Add Error Handling**
   - CLI not found
   - CLI crashes
   - Timeout handling
   - Resource cleanup

### Phase 3: Add Database Layer (2-3 days)

1. **Choose Database**
   - SQLite for simplicity
   - PostgreSQL for production

2. **Create Models**
   ```python
   # api/models.py
   class Repository(Base):
       id = Column(String, primary_key=True)
       url = Column(String, nullable=False)
       branch = Column(String, default="main")
       added_at = Column(DateTime, default=datetime.utcnow)
   
   class Verification(Base):
       id = Column(String, primary_key=True)
       pr_id = Column(String, nullable=False)
       status = Column(String, nullable=False)
       started_at = Column(DateTime)
       completed_at = Column(DateTime)
       result = Column(JSON)
   ```

3. **Update Endpoints**
   - Replace mock data with database queries
   - Add CRUD operations
   - Add filtering/pagination

### Phase 4: Add Integration Tests (1-2 days)

1. **Setup Test Infrastructure**
   ```python
   # tests/conftest.py
   @pytest.fixture
   async def test_client():
       async with AsyncClient(app=app, base_url="http://test") as client:
           yield client
   ```

2. **Write Tests**
   - Unit tests for each endpoint
   - Integration tests for verification flow
   - WebSocket tests

3. **Add CI/CD**
   ```yaml
   # .github/workflows/test.yml
   name: Test
   on: [push, pull_request]
   jobs:
     test:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v2
         - name: Run tests
           run: pytest tests/
   ```

### Phase 5: Production Readiness (2-3 days)

1. **Add Authentication**
   - JWT tokens
   - API keys
   - Rate limiting

2. **Add Monitoring**
   - Prometheus metrics
   - Logging aggregation
   - Error tracking (Sentry)

3. **Add Documentation**
   - API documentation (OpenAPI/Swagger)
   - Deployment guide
   - Architecture diagrams

---

## 8. Estimated Timeline

| Phase | Duration | Priority |
|-------|----------|----------|
| Phase 1: Validate Integration | 1-2 days | 🔴 Critical |
| Phase 2: Embed CLI Tools | 2-3 days | 🔴 Critical |
| Phase 3: Add Database | 2-3 days | 🟡 High |
| Phase 4: Integration Tests | 1-2 days | 🟡 High |
| Phase 5: Production Ready | 2-3 days | 🟢 Medium |
| **Total** | **8-13 days** | |

---

## 9. Conclusion

### Current State: 🟡 60% Complete

**What's Good:**
- ✅ Solid architecture and design
- ✅ Comprehensive error handling in frontend
- ✅ Async-first backend design
- ✅ WebSocket streaming infrastructure

**What's Missing:**
- ❌ No validation of data flow
- ❌ CLI tools not embedded
- ❌ No database persistence
- ❌ No integration tests
- ❌ Mock data everywhere

### Recommendation

**Start with Phase 1 (Validation)** to understand what actually works, then **immediately move to Phase 2 (CLI Integration)** since that's the core functionality. Phases 3-5 can be done in parallel or deferred based on priorities.

The system is **well-designed but untested**. With 1-2 weeks of focused work, it can become a fully functional, production-ready verification platform.

---

**Next Steps:**
1. Run backend server and test endpoints
2. Identify which CLI tool to embed first (Bob or Z3)
3. Create CLI manager module
4. Write integration tests
5. Deploy and monitor

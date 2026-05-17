# Frontend-Backend Integration Architecture

## Executive Summary

**Goal**: Connect React frontend to Python backend with minimal latency, maximum portability, and seamless real-time streaming.

**Architecture**: FastAPI + WebSocket + Server-Sent Events (SSE) hybrid approach with fallback mechanisms.

**Latency Target**: <100ms for API calls, <50ms for WebSocket messages, real-time streaming for verification pipeline.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         React Frontend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Dashboard   │  │  PR Detail   │  │  Repository Manager  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                  │                      │             │
│         └──────────────────┴──────────────────────┘             │
│                            │                                    │
│                   ┌────────▼────────┐                          │
│                   │  API Client     │                          │
│                   │  (axios/fetch)  │                          │
│                   └────────┬────────┘                          │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    HTTP/WebSocket
                             │
┌────────────────────────────▼─────────────────────────────────┐
│                      FastAPI Server                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  REST API    │  │  WebSocket   │  │  SSE Endpoint    │  │
│  │  Endpoints   │  │  Handler     │  │  (Fallback)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
│                   ┌────────▼────────┐                       │
│                   │  Orchestrator   │                       │
│                   │  (async)        │                       │
│                   └────────┬────────┘                       │
└────────────────────────────┼──────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │  Bob Bridge     │
                    │  Z3 Solver      │
                    │  Game Theory    │
                    └─────────────────┘
```

---

## Component Design

### 1. FastAPI Backend Server (`api/server.py`)

**Purpose**: Lightweight, async-first API server with WebSocket support.

**Key Features**:
- CORS enabled for local development
- WebSocket connection pooling
- Automatic reconnection handling
- Health check endpoints
- Rate limiting and authentication ready

**Endpoints**:
```python
# REST API
GET  /api/health              # Health check
GET  /api/repositories        # List repositories
POST /api/repositories        # Add repository
GET  /api/prs                 # List PRs
GET  /api/prs/{pr_id}         # Get PR details
POST /api/verify              # Start verification (returns job_id)
GET  /api/verify/{job_id}     # Get verification status

# WebSocket
WS   /ws/verify/{pr_id}       # Real-time verification stream

# SSE (Fallback)
GET  /api/stream/verify/{job_id}  # Server-sent events stream
```

**Why FastAPI?**
- Native async/await support (matches orchestrator)
- Built-in WebSocket support
- Automatic OpenAPI docs
- Pydantic validation (matches our types.py)
- 3x faster than Flask for async workloads

---

### 2. WebSocket Protocol (`api/websocket_protocol.py`)

**Message Format** (JSON):
```json
{
  "type": "stage_start|stage_complete|log|error|complete",
  "stage": "repo_analysis|z3_gen|game_gen|math_verify|...",
  "data": {
    "message": "Starting Z3 constraint generation...",
    "progress": 0.25,
    "timestamp": "2026-05-16T18:58:00Z",
    "details": { /* stage-specific data */ }
  }
}
```

**Connection Lifecycle**:
1. Client connects: `ws://localhost:8000/ws/verify/{pr_id}`
2. Server authenticates (optional)
3. Server starts verification stream
4. Server sends real-time updates
5. Server sends final result
6. Connection closes gracefully

**Reconnection Strategy**:
- Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
- Resume from last received stage
- Client stores job_id for recovery

---

### 3. React API Client (`frontend/api/client.js`)

**Purpose**: Centralized API communication with automatic retry and error handling.

**Features**:
- Axios instance with interceptors
- Automatic token refresh
- Request deduplication
- Response caching (for static data)
- Error normalization

**WebSocket Hook** (`frontend/hooks/useVerificationStream.js`):
```javascript
const { status, logs, results, error } = useVerificationStream(prId, {
  onStageComplete: (stage, data) => { /* update UI */ },
  onComplete: (finalResult) => { /* show success */ },
  onError: (error) => { /* handle error */ },
  autoReconnect: true,
  maxRetries: 5
});
```

---

### 4. State Management Strategy

**Option A: React Query (Recommended)**
- Automatic caching and invalidation
- Background refetching
- Optimistic updates
- Built-in loading/error states
- 10KB gzipped

**Option B: Zustand (Current)**
- Keep for local UI state
- Use React Query for server state
- Hybrid approach: best of both worlds

**Data Flow**:
```
User Action → API Client → FastAPI → Orchestrator → Bob/Z3/Game
                ↓                                        ↓
         React Query Cache                         Results
                ↓                                        ↓
         Component State ←─────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 hours)

**Files to Create**:
1. `api/server.py` - FastAPI application
2. `api/websocket_handler.py` - WebSocket connection manager
3. `api/routes/` - REST endpoint handlers
4. `frontend/api/client.js` - Axios client
5. `frontend/hooks/useVerificationStream.js` - WebSocket hook

**Tasks**:
- [ ] Set up FastAPI with CORS
- [ ] Create WebSocket connection pool
- [ ] Implement health check endpoint
- [ ] Create API client with interceptors
- [ ] Build WebSocket React hook

### Phase 2: Verification Pipeline Integration (3-4 hours)

**Files to Modify**:
1. `core/orchestrator.py` - Add WebSocket event emission
2. `frontend/pr-detail.jsx` - Replace mock engine with real hook
3. `frontend/pipeline.jsx` - Connect to real data streams

**Tasks**:
- [ ] Wrap `run_verification_stream()` with WebSocket sender
- [ ] Replace `usePipelineEngine` with `useVerificationStream`
- [ ] Connect `BobThread` to real Bob output
- [ ] Display real Z3 constraints from stream
- [ ] Show real game models from stream
- [ ] Render real framework results

### Phase 3: Data Endpoints (2 hours)

**Files to Create**:
1. `api/routes/repositories.py` - Repository CRUD
2. `api/routes/prs.py` - PR listing and details
3. `api/routes/reports.py` - Verification reports

**Tasks**:
- [ ] Implement repository listing/adding
- [ ] Create PR fetching from Git
- [ ] Build report storage and retrieval
- [ ] Add pagination and filtering

### Phase 4: Polish & Optimization (2 hours)

**Tasks**:
- [ ] Add request caching
- [ ] Implement connection pooling
- [ ] Add error boundaries in React
- [ ] Create loading skeletons
- [ ] Add retry mechanisms
- [ ] Implement rate limiting
- [ ] Add request deduplication

---

## Performance Optimizations

### 1. Connection Pooling
```python
# Reuse connections to Bob CLI
class BobConnectionPool:
    def __init__(self, max_connections=5):
        self.pool = asyncio.Queue(maxsize=max_connections)
        self.active = 0
```

### 2. Response Streaming
```python
# Stream large responses in chunks
async def stream_verification_result():
    async for chunk in orchestrator.run_verification_stream():
        yield f"data: {json.dumps(chunk)}\n\n"
```

### 3. Request Deduplication
```javascript
// Prevent duplicate verification requests
const pendingRequests = new Map();
if (pendingRequests.has(prId)) {
  return pendingRequests.get(prId);
}
```

### 4. Lazy Loading
```javascript
// Load components on demand
const PipelineView = lazy(() => import('./pipeline'));
```

---

## Portability Features

### 1. Environment Configuration
```bash
# .env file
BACKEND_URL=http://localhost:8000
WS_URL=ws://localhost:8000
BOB_CLI_PATH=/usr/local/bin/bob
Z3_PATH=/usr/bin/z3
```

### 2. Docker Compose
```yaml
version: '3.8'
services:
  backend:
    build: ./api
    ports: ["8000:8000"]
    environment:
      - BOB_CLI_PATH=/app/bob
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - REACT_APP_API_URL=http://backend:8000
```

### 3. Cross-Platform Support
- Use `pathlib` for file paths
- Environment variable fallbacks
- Platform detection for Bob CLI
- Graceful degradation

---

## Error Handling Strategy

### 1. Network Errors
```javascript
// Automatic retry with exponential backoff
const retryConfig = {
  retries: 3,
  retryDelay: (retryCount) => retryCount * 1000,
  retryCondition: (error) => error.code === 'ECONNREFUSED'
};
```

### 2. Verification Errors
```python
# Graceful failure with partial results
try:
    result = await orchestrator.run_verification()
except BobError as e:
    return PartialResult(
        completed_stages=completed,
        error=str(e),
        partial_data=collected_data
    )
```

### 3. WebSocket Disconnection
```javascript
// Automatic reconnection with state recovery
useEffect(() => {
  const ws = new WebSocket(url);
  ws.onclose = () => {
    setTimeout(() => reconnect(), backoff);
  };
}, []);
```

---

## Security Considerations

### 1. Authentication (Future)
- JWT tokens in HTTP headers
- WebSocket authentication via query param
- Token refresh mechanism

### 2. Rate Limiting
```python
from slowapi import Limiter
limiter = Limiter(key_func=get_remote_address)

@app.post("/api/verify")
@limiter.limit("5/minute")
async def verify_pr():
    ...
```

### 3. Input Validation
- Pydantic models for all inputs
- Path traversal prevention
- Command injection protection

---

## Testing Strategy

### 1. Backend Tests
```python
# tests/test_api.py
async def test_websocket_stream():
    async with websockets.connect(url) as ws:
        await ws.send(json.dumps({"pr_id": "123"}))
        response = await ws.recv()
        assert response["type"] == "stage_start"
```

### 2. Frontend Tests
```javascript
// tests/useVerificationStream.test.js
test('handles WebSocket messages', async () => {
  const { result } = renderHook(() => useVerificationStream('123'));
  await waitFor(() => expect(result.current.status).toBe('running'));
});
```

### 3. Integration Tests
- End-to-end verification flow
- Error recovery scenarios
- Performance benchmarks

---

## Deployment Checklist

- [ ] Environment variables configured
- [ ] CORS settings for production
- [ ] WebSocket proxy configured (nginx/caddy)
- [ ] SSL certificates installed
- [ ] Health check endpoints working
- [ ] Logging and monitoring enabled
- [ ] Error tracking (Sentry) configured
- [ ] Performance monitoring (DataDog) enabled

---

## Estimated Timeline

| Phase | Duration | Complexity |
|-------|----------|------------|
| Core Infrastructure | 2-3 hours | Medium |
| Pipeline Integration | 3-4 hours | High |
| Data Endpoints | 2 hours | Low |
| Polish & Optimization | 2 hours | Medium |
| **Total** | **9-11 hours** | **Medium-High** |

---

## Next Steps

1. **Immediate**: Create `api/server.py` with FastAPI skeleton
2. **Next**: Build WebSocket handler for verification streaming
3. **Then**: Create React hook to consume WebSocket
4. **Finally**: Replace mock data in `pr-detail.jsx` with real stream

**Start with**: `api/server.py` - the foundation for everything else.
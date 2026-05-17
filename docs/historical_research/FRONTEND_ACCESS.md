# Gandy Frontend Access Guide

## Backend Server Status: ✅ RUNNING

The backend API server is now running at:
- **API Base URL:** http://localhost:8000
- **Health Check:** http://localhost:8000/api/health
- **API Documentation:** http://localhost:8000/docs
- **WebSocket:** ws://localhost:8000/ws/verify/{pr_id}

---

## Frontend Options

### Option 1: Standalone HTML (Quickest)

Open the standalone HTML file directly in your browser:

```bash
# Open in default browser
xdg-open frontend/Gandy.standalone-src.html

# Or manually navigate to:
file:///home/fawaz/Documents/Gandy/frontend/Gandy.standalone-src.html
```

**This file includes:**
- Complete React app
- All components bundled
- No build step required
- Works immediately

### Option 2: React Dev Server (Recommended for Development)

If you have Node.js installed:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start dev server
npm run dev

# Frontend will be available at:
# http://localhost:5173 or http://localhost:3000
```

### Option 3: Simple HTTP Server

Serve the frontend directory with Python:

```bash
cd frontend
python3 -m http.server 3000

# Then open:
# http://localhost:3000/Gandy.html
```

---

## Quick Test

### Test Backend API:
```bash
curl http://localhost:8000/api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-05-16T20:12:45Z",
  "version": "1.0.0",
  "services": {
    "bob": false,
    "z3": true,
    "orchestrator": true
  }
}
```

### Test WebSocket Connection:

Open browser console and run:
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/verify/test-pr-1');

ws.onopen = () => console.log('✅ Connected!');
ws.onmessage = (e) => console.log('📨 Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('❌ Error:', e);

// You should see:
// ✅ Connected!
// 📨 Message: {type: "connected", data: {...}}
```

---

## Frontend Features

### 1. Dashboard
- Overview of repositories
- Recent verifications
- System status

### 2. Pipeline View
- Real-time verification streaming
- Progress tracking
- Stage-by-stage results

### 3. Reports
- Detailed vulnerability reports
- Bob AI analysis
- Z3 verification results
- Game theory findings

### 4. Repository Management
- Add repositories
- View pull requests
- Trigger verifications

---

## Demo Workflow

### Step 1: Open Frontend
Choose one of the options above to open the frontend.

### Step 2: Navigate to Pipeline
Click on "Pipeline" or "Verification" in the navigation.

### Step 3: Start Verification
- Click "Start Verification" or "Verify PR"
- Enter PR ID: `beanstalk-pr-1`
- Watch real-time analysis

### Step 4: View Results
You'll see:
1. **Bob AI Analysis** (Neural reasoning)
   - Structural analysis
   - Vulnerability detection
   - Semantic reasoning
   - Natural language report

2. **Z3 Verification** (Symbolic proof)
   - Formal verification
   - SAT/UNSAT result
   - Counterexample model

3. **Game Theory** (Economic analysis)
   - Nash equilibrium
   - Dominant strategies
   - Incentive compatibility

4. **Final Report**
   - Overall risk assessment
   - Detailed findings
   - Recommendations

---

## Troubleshooting

### Backend Not Responding
```bash
# Check if server is running
ps aux | grep uvicorn

# If not running, start it:
cd api
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Can't Connect to Backend
1. Check CORS settings in `api/server.py`:
   ```python
   allow_origins=["http://localhost:3000", "http://localhost:5173"]
   ```

2. Add your frontend URL if different:
   ```python
   allow_origins=["http://localhost:3000", "http://localhost:5173", "http://localhost:8080"]
   ```

### WebSocket Connection Fails
1. Check if backend is running: `curl http://localhost:8000/api/health`
2. Check browser console for errors
3. Verify WebSocket URL: `ws://localhost:8000/ws/verify/{pr_id}`

---

## API Endpoints

### REST API

**Health Check:**
```bash
GET http://localhost:8000/api/health
```

**List Repositories:**
```bash
GET http://localhost:8000/api/repositories
```

**Add Repository:**
```bash
POST http://localhost:8000/api/repositories
Content-Type: application/json

{
  "url": "https://github.com/BeanstalkFarms/Beanstalk",
  "branch": "main"
}
```

**List Pull Requests:**
```bash
GET http://localhost:8000/api/prs
```

**Start Verification:**
```bash
POST http://localhost:8000/api/verify
Content-Type: application/json

{
  "pr_id": "beanstalk-pr-1",
  "repository_url": "https://github.com/BeanstalkFarms/Beanstalk",
  "pr_number": 1
}
```

**Get Verification Status:**
```bash
GET http://localhost:8000/api/verify/{job_id}
```

### WebSocket API

**Connect:**
```javascript
const ws = new WebSocket('ws://localhost:8000/ws/verify/beanstalk-pr-1');
```

**Message Types:**
- `connected` - Initial connection
- `stage_start` - Verification stage begins
- `stage_complete` - Stage finished
- `log` - Progress log
- `error` - Error occurred
- `complete` - Verification complete

---

## Current Status

✅ **Backend:** Running on http://localhost:8000  
✅ **API:** Responding to requests  
✅ **WebSocket:** Ready for connections  
✅ **Bob AI:** Integrated and tested  
✅ **Z3 Solver:** Available  
⏳ **Frontend:** Choose an option above to start

---

## Next Steps

1. **Open Frontend** - Use one of the three options above
2. **Test Connection** - Verify backend connectivity
3. **Run Demo** - Start a verification on Beanstalk contract
4. **View Results** - See Bob AI detect the $182M vulnerability

---

## Support

If you encounter issues:
1. Check backend logs: `tail -f api/server.log` (if using nohup)
2. Check browser console for frontend errors
3. Verify all dependencies are installed
4. Ensure ports 8000 and 3000/5173 are not in use

---

**Backend is ready! Choose a frontend option and start the demo.** 🚀

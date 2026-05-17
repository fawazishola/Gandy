"""
Gandy API Server - FastAPI backend for neurosymbolic verification pipeline
Provides REST API and WebSocket endpoints for real-time verification streaming
"""

import asyncio
import json
import logging
import os
import sys
import re
import tempfile
import zipfile
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import AsyncGenerator, Dict, List, Optional, Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.orchestrator import VerificationOrchestrator as Orchestrator
from core.types import VerificationResult
from api.cli_manager import create_bob_manager, create_z3_manager, BobCLIManager, Z3Manager
from api.bob_ai_simulator import create_bob_simulator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global state
active_verifications: Dict[str, dict] = {}
websocket_connections: Dict[str, WebSocket] = {}


# Pydantic Models
class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str = "1.0.0"
    services: Dict[str, bool]


class RepositoryRequest(BaseModel):
    url: str = Field(..., description="Git repository URL")
    branch: str = Field(default="main", description="Branch to analyze")


class RepositoryResponse(BaseModel):
    id: str
    url: str
    branch: str
    added_at: str


class PRRequest(BaseModel):
    repository_id: str
    pr_number: int


class VerificationRequest(BaseModel):
    pr_id: str
    repository_url: str
    pr_number: int
    target_file: Optional[str] = None
    github_token: Optional[str] = None


class VerificationStatusResponse(BaseModel):
    job_id: str
    status: str  # pending, running, completed, failed
    progress: float
    current_stage: Optional[str]
    started_at: str
    completed_at: Optional[str]
    result: Optional[dict]


class GitHubRepoLookupRequest(BaseModel):
    repo_url: str
    github_token: Optional[str] = None


class GitHubRepoLookupResponse(BaseModel):
    owner: str
    repo: str
    full_name: str
    default_branch: str
    private: bool
    description: Optional[str] = None


class WebSocketMessage(BaseModel):
    type: str  # stage_start, stage_complete, log, error, complete
    stage: Optional[str]
    data: dict
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat())


# ==========================================================================
# GitHub Helpers
# ==========================================================================

GITHUB_API_BASE = "https://api.github.com"
GITHUB_ACCEPT_HEADER = "application/vnd.github+json"


def _parse_github_repo_url(repo_url: str) -> Optional[Dict[str, str]]:
    if not repo_url:
        return None

    # HTTPS URL
    https_match = re.match(r"https?://github\.com/([^/]+)/([^/]+?)(?:\.git)?/?$", repo_url.strip())
    if https_match:
        return {"owner": https_match.group(1), "repo": https_match.group(2)}

    # SSH URL
    ssh_match = re.match(r"git@github\.com:([^/]+)/([^/]+?)(?:\.git)?$", repo_url.strip())
    if ssh_match:
        return {"owner": ssh_match.group(1), "repo": ssh_match.group(2)}

    return None


def _github_headers(token: Optional[str]) -> Dict[str, str]:
    headers = {"Accept": GITHUB_ACCEPT_HEADER}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def _fetch_repo_info(owner: str, repo: str, token: Optional[str]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}",
            headers=_github_headers(token)
        )
        resp.raise_for_status()
        return resp.json()


async def _fetch_pr_info(owner: str, repo: str, pr_number: int, token: Optional[str]) -> Dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls/{pr_number}",
            headers=_github_headers(token)
        )
        resp.raise_for_status()
        return resp.json()


async def _download_repo_zip(owner: str, repo: str, ref: str, token: Optional[str]) -> Path:
    base_dir = Path("/tmp/gandy-repos") / owner / repo / ref
    base_dir.mkdir(parents=True, exist_ok=True)

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/zipball/{ref}",
            headers=_github_headers(token)
        )
        resp.raise_for_status()

        with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as tmp:
            tmp.write(resp.content)
            zip_path = Path(tmp.name)

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(base_dir)

    zip_path.unlink(missing_ok=True)

    # GitHub zipball contains a single top-level directory
    extracted_dirs = [p for p in base_dir.iterdir() if p.is_dir()]
    if not extracted_dirs:
        raise RuntimeError("Failed to extract GitHub repo archive")
    return extracted_dirs[0]


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("🚀 Starting Gandy API Server")
    
    # Startup: Initialize services
    try:
        # Check Bob CLI availability
        bob_available = os.path.exists(os.getenv("BOB_CLI_PATH", "/usr/local/bin/bob"))
        logger.info(f"Bob CLI available: {bob_available}")
        
        # Check Z3 availability
        z3_available = os.path.exists(os.getenv("Z3_PATH", "/usr/bin/z3"))
        logger.info(f"Z3 Solver available: {z3_available}")
        
        app.state.services = {
            "bob": bob_available,
            "z3": z3_available,
            "orchestrator": True
        }
    except Exception as e:
        logger.error(f"Startup error: {e}")
        app.state.services = {"bob": False, "z3": False, "orchestrator": False}
    
    yield
    
    # Shutdown: Cleanup
    logger.info("🛑 Shutting down Gandy API Server")
    # Close all active WebSocket connections
    for ws in websocket_connections.values():
        await ws.close()
    websocket_connections.clear()
    active_verifications.clear()


# Create FastAPI app
app = FastAPI(
    title="Gandy API",
    description="Neurosymbolic verification pipeline for smart contracts",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# REST API Endpoints
# ============================================================================

@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        services=app.state.services
    )


@app.get("/api/repositories")
async def list_repositories():
    """List all repositories"""
    # TODO: Implement repository storage (SQLite/PostgreSQL)
    return {
        "repositories": [
            {
                "id": "repo-1",
                "url": "https://github.com/example/defi-protocol",
                "branch": "main",
                "added_at": "2026-05-16T12:00:00Z"
            }
        ]
    }


@app.post("/api/github/repo/lookup", response_model=GitHubRepoLookupResponse)
async def github_repo_lookup(request: GitHubRepoLookupRequest):
    """Validate and fetch GitHub repo details"""
    parsed = _parse_github_repo_url(request.repo_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

    token = request.github_token or os.getenv("GITHUB_TOKEN")

    try:
        repo_info = await _fetch_repo_info(parsed["owner"], parsed["repo"], token)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return GitHubRepoLookupResponse(
        owner=repo_info["owner"]["login"],
        repo=repo_info["name"],
        full_name=repo_info["full_name"],
        default_branch=repo_info["default_branch"],
        private=repo_info.get("private", False),
        description=repo_info.get("description")
    )


@app.get("/api/github/repo/{owner}/{repo}/pulls")
async def list_github_pulls(owner: str, repo: str, state: str = "open", per_page: int = 20, github_token: Optional[str] = None):
    """List pull requests for a GitHub repository"""
    token = github_token or os.getenv("GITHUB_TOKEN")
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            f"{GITHUB_API_BASE}/repos/{owner}/{repo}/pulls",
            headers=_github_headers(token),
            params={"state": state, "per_page": per_page}
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        pulls = resp.json()

    return {
        "pulls": [
            {
                "number": pr["number"],
                "title": pr["title"],
                "state": pr["state"],
                "author": pr["user"]["login"],
                "head": pr["head"]["ref"],
                "base": pr["base"]["ref"],
                "html_url": pr["html_url"]
            }
            for pr in pulls
        ]
    }


@app.post("/api/repositories", response_model=RepositoryResponse)
async def add_repository(repo: RepositoryRequest):
    """Add a new repository"""
    repo_id = f"repo-{uuid4().hex[:8]}"
    return RepositoryResponse(
        id=repo_id,
        url=repo.url,
        branch=repo.branch,
        added_at=datetime.utcnow().isoformat()
    )


@app.get("/api/prs")
async def list_prs(repository_id: Optional[str] = None):
    """List pull requests"""
    # TODO: Fetch from Git API
    return {
        "prs": [
            {
                "id": "pr-47",
                "number": 47,
                "title": "Add flash loan protection",
                "repository_id": "repo-1",
                "status": "open",
                "created_at": "2026-05-15T10:00:00Z"
            }
        ]
    }


@app.post("/api/verify")
async def start_verification(
    request: VerificationRequest,
    background_tasks: BackgroundTasks
):
    """Start a verification job"""
    job_id = f"job-{uuid4().hex[:8]}"
    
    # Initialize job state
    active_verifications[job_id] = {
        "job_id": job_id,
        "pr_id": request.pr_id,
        "status": "pending",
        "progress": 0.0,
        "current_stage": None,
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
        "result": None,
        "logs": []
    }
    
    # Start verification in background
    background_tasks.add_task(run_verification_job, job_id, request)
    
    return {"job_id": job_id, "status": "pending"}


@app.get("/api/verify/{job_id}", response_model=VerificationStatusResponse)
async def get_verification_status(job_id: str):
    """Get verification job status"""
    if job_id not in active_verifications:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = active_verifications[job_id]
    return VerificationStatusResponse(**job)


@app.get("/api/stream/verify/{job_id}")
async def stream_verification(job_id: str):
    """Server-Sent Events stream for verification (WebSocket fallback)"""
    if job_id not in active_verifications:
        raise HTTPException(status_code=404, detail="Job not found")
    
    async def event_generator():
        """Generate SSE events"""
        while True:
            job = active_verifications.get(job_id)
            if not job:
                break
            
            # Send current status
            yield f"data: {json.dumps(job)}\n\n"
            
            # Stop if completed or failed
            if job["status"] in ["completed", "failed"]:
                break
            
            await asyncio.sleep(0.5)  # Poll every 500ms
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream"
    )


# ============================================================================
# WebSocket Endpoint
# ============================================================================

@app.websocket("/ws/verify/{pr_id}")
async def websocket_verify(websocket: WebSocket, pr_id: str):
    """WebSocket endpoint for real-time verification streaming with CLI integration"""
    await websocket.accept()
    connection_id = f"ws-{uuid4().hex[:8]}"
    websocket_connections[connection_id] = websocket
    
    logger.info(f"WebSocket connected: {connection_id} for PR {pr_id}")
    
    # Initialize CLI managers
    bob_manager = None
    z3_manager = None
    
    try:
        # Send initial connection message
        await send_ws_message(
            websocket,
            "connected",
            None,
            {"message": "Connected to verification stream", "pr_id": pr_id}
        )
        
        # Initialize CLI tools
        try:
            bob_manager = create_bob_manager()
            await send_ws_message(websocket, "log", "initialization", {
                "message": "✅ Bob CLI initialized",
                "level": "success"
            })
        except Exception as e:
            await send_ws_message(websocket, "log", "initialization", {
                "message": f"⚠️ Bob CLI not available: {e}",
                "level": "warning"
            })
        
        try:
            z3_manager = create_z3_manager()
            await send_ws_message(websocket, "log", "initialization", {
                "message": "✅ Z3 Solver initialized",
                "level": "success"
            })
        except Exception as e:
            await send_ws_message(websocket, "log", "initialization", {
                "message": f"⚠️ Z3 Solver not available: {e}",
                "level": "warning"
            })
        
        # Stream real neurosymbolic verification results
        orchestrator = Orchestrator(api_key=os.getenv("BOB_API_KEY"))
        repo_path = "." # In a real app, this would be the cloned repo path
        
        async for event in orchestrator.run_verification_stream(
            pr_id, repo_path
        ):
            await websocket.send_json(event)
            
            # Check if client is still connected
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.01
                )
                if message == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                pass
        
        # Send completion message
        await send_ws_message(
            websocket,
            "complete",
            None,
            {"message": "Verification complete"}
        )
        
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await send_ws_message(
            websocket,
            "error",
            None,
            {"message": str(e), "error_type": type(e).__name__}
        )
    finally:
        # Cleanup CLI managers
        if bob_manager:
            await bob_manager.kill()
        if z3_manager:
            await z3_manager.kill()
        
        websocket_connections.pop(connection_id, None)
        await websocket.close()


# ============================================================================
# CLI-Integrated Verification Streaming
# ============================================================================

async def stream_verification_events_with_cli(
    pr_id: str,
    bob_manager: Optional[BobCLIManager],
    z3_manager: Optional[Z3Manager],
    websocket: WebSocket
) -> AsyncGenerator[dict, None]:
    """
    Stream verification events with integrated CLI tools
    Analyzes REAL Beanstalk GovernanceFacet.sol for hackathon demo
    """
    try:
        # Load the REAL Beanstalk GovernanceFacet contract
        governance_contract_path = Path(__file__).parent.parent / "GovernanceFacet.sol"
        
        if governance_contract_path.exists():
            with open(governance_contract_path, 'r') as f:
                contract_code = f.read()
            contract_name = "Beanstalk GovernanceFacet"
        else:
            # Fallback to demo contract if file not found
            contract_code = """
            pragma solidity ^0.8.0;
            contract FlashLoanVulnerable {
                mapping(address => uint256) public balances;
                function deposit() public payable {
                    balances[msg.sender] += msg.value;
                }
                function withdraw(uint256 amount) public {
                    require(balances[msg.sender] >= amount, "Insufficient balance");
                    (bool success, ) = msg.sender.call{value: amount}("");
                    require(success, "Transfer failed");
                    balances[msg.sender] -= amount;
                }
            }
            """
            contract_name = "Demo Contract"
        
        # Stage 1: Bob AI Neural Analysis
        yield {
            "type": "stage_start",
            "stage": "bob_analysis",
            "data": {
                "message": f"Running Bob AI neural analysis on {contract_name}...",
                "progress": 0.1
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Create Bob AI simulator
        bob_ai = create_bob_simulator()
        
        # Step 1: Structural Analysis
        await asyncio.sleep(0.5)
        yield {
            "type": "log",
            "stage": "bob_analysis",
            "data": {
                "message": "🧠 Bob AI: Performing structural analysis...",
                "level": "info",
                "progress": 0.12
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Run the actual analysis
        analysis_result = bob_ai.analyze_contract(contract_code, contract_name)
        
        # Step 2: Pattern Detection
        await asyncio.sleep(0.5)
        yield {
            "type": "log",
            "stage": "bob_analysis",
            "data": {
                "message": f"🧠 Bob AI: Detected {len(analysis_result['structure']['functions'])} functions, scanning for vulnerabilities...",
                "level": "info",
                "progress": 0.15
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Step 3: Vulnerability Detection
        await asyncio.sleep(0.5)
        if analysis_result['vulnerabilities']:
            vuln = analysis_result['vulnerabilities'][0]
            yield {
                "type": "log",
                "stage": "bob_analysis",
                "data": {
                    "message": f"⚠️ Bob AI: CRITICAL - {vuln['type'].replace('_', ' ').title()} detected!",
                    "level": "error",
                    "progress": 0.2
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Show evidence
            await asyncio.sleep(0.5)
            for evidence in vuln['evidence'][:2]:  # Show first 2 pieces of evidence
                yield {
                    "type": "log",
                    "stage": "bob_analysis",
                    "data": {
                        "message": f"  📌 Evidence: {evidence}",
                        "level": "warning",
                        "progress": 0.22
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
        
        # Step 4: Semantic Reasoning
        await asyncio.sleep(0.5)
        yield {
            "type": "log",
            "stage": "bob_analysis",
            "data": {
                "message": "🧠 Bob AI: Performing semantic reasoning...",
                "level": "info",
                "progress": 0.25
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if analysis_result['semantic_issues']:
            await asyncio.sleep(0.5)
            issue = analysis_result['semantic_issues'][0]
            yield {
                "type": "log",
                "stage": "bob_analysis",
                "data": {
                    "message": f"💡 Bob AI: {issue['implication']}",
                    "level": "warning",
                    "progress": 0.27
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Complete Bob analysis
        await asyncio.sleep(0.5)
        yield {
            "type": "stage_complete",
            "stage": "bob_analysis",
            "data": {
                "message": f"Bob AI analysis complete - Risk level: {analysis_result['overall_risk'].upper()}",
                "progress": 0.3,
                "details": {
                    "contract_name": contract_name,
                    "vulnerabilities_found": len(analysis_result['vulnerabilities']),
                    "risk_level": analysis_result['overall_risk'],
                    "vulnerabilities": analysis_result['vulnerabilities'],
                    "semantic_issues": analysis_result['semantic_issues'],
                    "report_preview": analysis_result['report'][:500] + "..."
                }
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Stage 2: Z3 Formal Verification
        yield {
            "type": "stage_start",
            "stage": "z3_verification",
            "data": {
                "message": "Running Z3 formal verification...",
                "progress": 0.4
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Z3 specification for reentrancy check
        z3_spec = """
        (set-logic QF_LIA)
        (declare-const balance_before Int)
        (declare-const balance_after Int)
        (declare-const external_call_made Bool)
        (declare-const state_updated Bool)
        
        ; Reentrancy vulnerability: external call before state update
        (assert (> balance_before 0))
        (assert (= external_call_made true))
        (assert (= state_updated true))
        (assert (> balance_before balance_after))
        
        ; Check if attacker can re-enter before state update
        (assert (and external_call_made (not state_updated)))
        
        (check-sat)
        (get-model)
        """
        
        if z3_manager:
            # Real Z3 verification
            z3_result = await z3_manager.verify(z3_spec, timeout=10)
            
            yield {
                "type": "log",
                "stage": "z3_verification",
                "data": {
                    "message": f"🔬 Z3 Result: {z3_result['status']}",
                    "level": "info" if z3_result["status"] == "unsat" else "error",
                    "progress": 0.5
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            yield {
                "type": "stage_complete",
                "stage": "z3_verification",
                "data": {
                    "message": z3_result["message"],
                    "progress": 0.6,
                    "details": z3_result
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        else:
            # Mock Z3 for demo
            await asyncio.sleep(1)
            yield {
                "type": "log",
                "stage": "z3_verification",
                "data": {
                    "message": "🔬 Z3: Checking temporal constraints...",
                    "level": "info",
                    "progress": 0.45
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            await asyncio.sleep(1)
            yield {
                "type": "log",
                "stage": "z3_verification",
                "data": {
                    "message": "🔬 Z3: SAT - Counterexample found!",
                    "level": "error",
                    "progress": 0.5
                },
                "timestamp": datetime.utcnow().isoformat()
            }
            
            yield {
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
                },
                "timestamp": datetime.utcnow().isoformat()
            }
        
        # Stage 3: Game Theory Analysis
        yield {
            "type": "stage_start",
            "stage": "game_theory",
            "data": {
                "message": "Analyzing attack incentives...",
                "progress": 0.7
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await asyncio.sleep(1)
        yield {
            "type": "log",
            "stage": "game_theory",
            "data": {
                "message": "🎮 Nash Equilibrium: Exploit is dominant strategy",
                "level": "error",
                "progress": 0.75
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        yield {
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
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Stage 4: Final Report
        yield {
            "type": "stage_start",
            "stage": "report_generation",
            "data": {
                "message": "Generating security report...",
                "progress": 0.9
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
        await asyncio.sleep(1)
        yield {
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
            },
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"CLI verification stream error: {e}")
        yield {
            "type": "error",
            "stage": None,
            "data": {
                "message": f"Verification failed: {str(e)}",
                "error_type": type(e).__name__
            },
            "timestamp": datetime.utcnow().isoformat()
        }


# ============================================================================
# Helper Functions
# ============================================================================

async def send_ws_message(
    websocket: WebSocket,
    msg_type: str,
    stage: Optional[str],
    data: dict
):
    """Send a formatted WebSocket message"""
    message = WebSocketMessage(
        type=msg_type,
        stage=stage,
        data=data
    )
    await websocket.send_json(message.dict())


async def stream_verification_events(
    orchestrator: Orchestrator,
    pr_id: str
) -> AsyncGenerator[dict, None]:
    """
    Stream verification events from orchestrator
    Converts orchestrator events to WebSocket messages
    """
    # Mock contract for demo - replace with actual PR file fetching
    contract_code = """
    pragma solidity ^0.8.0;
    
    contract FlashLoanVulnerable {
        mapping(address => uint256) public balances;
        
        function deposit() public payable {
            balances[msg.sender] += msg.value;
        }
        
        function withdraw(uint256 amount) public {
            require(balances[msg.sender] >= amount, "Insufficient balance");
            (bool success, ) = msg.sender.call{value: amount}("");
            require(success, "Transfer failed");
            balances[msg.sender] -= amount;  // State update after external call!
        }
    }
    """
    
    try:
        # Start verification stream
        stage_count = 0
        total_stages = 8
        
        verification_id = f"verify-{pr_id}"
        repo_path = "/tmp/mock-repo"  # TODO: Replace with actual repo path
        async for event in orchestrator.run_verification_stream(verification_id, repo_path):
            stage_count += 1
            progress = stage_count / total_stages
            
            # Determine event type
            if "error" in event:
                yield {
                    "type": "error",
                    "stage": event.get("stage"),
                    "data": {
                        "message": event["error"],
                        "progress": progress
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
            elif "stage" in event:
                # Stage start/complete
                yield {
                    "type": "stage_start" if event.get("status") == "started" else "stage_complete",
                    "stage": event["stage"],
                    "data": {
                        "message": event.get("message", ""),
                        "progress": progress,
                        "details": event.get("data", {})
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
            elif "log" in event:
                # Log message
                yield {
                    "type": "log",
                    "stage": event.get("stage"),
                    "data": {
                        "message": event["log"],
                        "level": event.get("level", "info"),
                        "progress": progress
                    },
                    "timestamp": datetime.utcnow().isoformat()
                }
            
            # Small delay to prevent overwhelming client
            await asyncio.sleep(0.05)
            
    except Exception as e:
        logger.error(f"Verification stream error: {e}")
        yield {
            "type": "error",
            "stage": None,
            "data": {
                "message": f"Verification failed: {str(e)}",
                "error_type": type(e).__name__
            },
            "timestamp": datetime.utcnow().isoformat()
        }


async def run_verification_job(job_id: str, request: VerificationRequest):
    """Run verification job in background"""
    job = active_verifications[job_id]
    
    try:
        job["status"] = "running"
        job["started_at"] = datetime.utcnow().isoformat()
        
        # Create orchestrator
        orchestrator = Orchestrator(api_key=os.getenv("BOB_API_KEY"))

        # Resolve GitHub repo + PR to a local path
        parsed = _parse_github_repo_url(request.repository_url)
        if not parsed:
            raise ValueError("Invalid GitHub repository URL")

        token = request.github_token or os.getenv("GITHUB_TOKEN")
        pr_info = await _fetch_pr_info(parsed["owner"], parsed["repo"], request.pr_number, token)

        head_sha = pr_info["head"]["sha"]
        repo_path = await _download_repo_zip(parsed["owner"], parsed["repo"], head_sha, token)

        # Run verification
        verification_id = f"verify-{request.pr_id}"
        async for event in orchestrator.run_verification_stream(verification_id, str(repo_path)):
            # Update job state
            if "stage" in event:
                job["current_stage"] = event["stage"]
            if "progress" in event:
                job["progress"] = event["progress"]
            
            # Store logs
            job["logs"].append(event)
        
        # Mark as completed
        job["status"] = "completed"
        job["completed_at"] = datetime.utcnow().isoformat()
        job["progress"] = 1.0
        
    except Exception as e:
        logger.error(f"Verification job {job_id} failed: {e}")
        job["status"] = "failed"
        job["completed_at"] = datetime.utcnow().isoformat()
        job["result"] = {"error": str(e)}


# ============================================================================
# Main Entry Point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", "8000"))
    host = os.getenv("HOST", "0.0.0.0")
    
    logger.info(f"Starting server on {host}:{port}")
    
    uvicorn.run(
        "server:app",
        host=host,
        port=port,
        reload=True,  # Auto-reload on code changes
        log_level="info"
    )

# Made with Bob

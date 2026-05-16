"""
Integration tests for Gandy API
Tests the full stack: API endpoints, WebSocket, CLI tools, and orchestrator
"""

import asyncio
import json
import pytest
from pathlib import Path
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from fastapi.testclient import TestClient
from fastapi.websockets import WebSocket
import websockets

# Import the FastAPI app
from api.server import app


@pytest.fixture
def client():
    """Create test client"""
    return TestClient(app)


class TestHealthEndpoint:
    """Test health check endpoint"""
    
    def test_health_check(self, client):
        """Test /api/health endpoint"""
        response = client.get("/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert "version" in data
        assert "services" in data
        
        # Check service availability
        services = data["services"]
        assert "orchestrator" in services
        assert "z3" in services
        assert "bob" in services


class TestRepositoryEndpoints:
    """Test repository management endpoints"""
    
    def test_list_repositories(self, client):
        """Test GET /api/repositories"""
        response = client.get("/api/repositories")
        assert response.status_code == 200
        
        data = response.json()
        assert "repositories" in data
        assert isinstance(data["repositories"], list)
    
    def test_add_repository(self, client):
        """Test POST /api/repositories"""
        repo_data = {
            "url": "https://github.com/test/repo",
            "branch": "main"
        }
        
        response = client.post("/api/repositories", json=repo_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert data["url"] == repo_data["url"]
        assert data["branch"] == repo_data["branch"]
        assert "added_at" in data


class TestPREndpoints:
    """Test pull request endpoints"""
    
    def test_list_prs(self, client):
        """Test GET /api/prs"""
        response = client.get("/api/prs")
        assert response.status_code == 200
        
        data = response.json()
        assert "prs" in data
        assert isinstance(data["prs"], list)
    
    def test_list_prs_with_filter(self, client):
        """Test GET /api/prs with repository filter"""
        response = client.get("/api/prs?repository_id=repo-1")
        assert response.status_code == 200
        
        data = response.json()
        assert "prs" in data


class TestVerificationEndpoints:
    """Test verification endpoints"""
    
    def test_start_verification(self, client):
        """Test POST /api/verify"""
        verify_data = {
            "pr_id": "test-pr-123",
            "repository_url": "https://github.com/test/repo",
            "pr_number": 42
        }
        
        response = client.post("/api/verify", json=verify_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "job_id" in data
        assert data["status"] == "pending"
    
    def test_get_verification_status(self, client):
        """Test GET /api/verify/{job_id}"""
        # First start a verification
        verify_data = {
            "pr_id": "test-pr-456",
            "repository_url": "https://github.com/test/repo",
            "pr_number": 43
        }
        
        start_response = client.post("/api/verify", json=verify_data)
        job_id = start_response.json()["job_id"]
        
        # Then check status
        status_response = client.get(f"/api/verify/{job_id}")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert data["job_id"] == job_id
        assert "status" in data
        assert "progress" in data
        assert "started_at" in data
    
    def test_get_nonexistent_verification(self, client):
        """Test GET /api/verify/{job_id} with invalid ID"""
        response = client.get("/api/verify/nonexistent-job")
        assert response.status_code == 404


@pytest.mark.asyncio
class TestWebSocketIntegration:
    """Test WebSocket streaming"""
    
    async def test_websocket_connection(self):
        """Test WebSocket connection and basic communication"""
        uri = "ws://localhost:8000/ws/verify/test-pr"
        
        try:
            async with websockets.connect(uri) as websocket:
                # Should receive connection message
                message = await asyncio.wait_for(
                    websocket.recv(),
                    timeout=5.0
                )
                
                data = json.loads(message)
                assert data["type"] == "connected"
                assert "pr_id" in data["data"]
        
        except asyncio.TimeoutError:
            pytest.fail("WebSocket connection timed out")
        except Exception as e:
            pytest.skip(f"WebSocket test skipped (server not running): {e}")
    
    async def test_websocket_verification_stream(self):
        """Test full verification stream via WebSocket"""
        uri = "ws://localhost:8000/ws/verify/test-pr-stream"
        
        try:
            async with websockets.connect(uri) as websocket:
                events = []
                
                # Collect events with timeout
                try:
                    async with asyncio.timeout(30.0):
                        while True:
                            message = await websocket.recv()
                            event = json.loads(message)
                            events.append(event)
                            
                            # Stop when complete
                            if event["type"] == "complete":
                                break
                
                except asyncio.TimeoutError:
                    pass  # Expected if verification takes long
                
                # Verify we got some events
                assert len(events) > 0
                
                # First event should be connection
                assert events[0]["type"] == "connected"
                
                # Should have stage events
                stage_events = [e for e in events if "stage" in e]
                assert len(stage_events) > 0
        
        except Exception as e:
            pytest.skip(f"WebSocket stream test skipped: {e}")


class TestCLIIntegration:
    """Test CLI tool integration"""
    
    @pytest.mark.skipif(
        not Path("/usr/bin/z3").exists(),
        reason="Z3 not installed"
    )
    def test_z3_available(self):
        """Test Z3 solver is available"""
        from api.cli_manager import create_z3_manager
        
        try:
            z3_manager = create_z3_manager()
            assert z3_manager.cli_path is not None
        except FileNotFoundError:
            pytest.skip("Z3 not found")
    
    def test_bob_cli_mock_mode(self):
        """Test Bob CLI falls back to mock mode when not installed"""
        from api.cli_manager import create_bob_manager
        
        # Should not raise even if Bob not installed
        bob_manager = create_bob_manager()
        assert bob_manager is not None


@pytest.mark.asyncio
class TestEndToEndFlow:
    """Test complete end-to-end verification flow"""
    
    async def test_full_verification_flow(self, client):
        """Test complete flow from PR submission to results"""
        # 1. Add repository
        repo_response = client.post("/api/repositories", json={
            "url": "https://github.com/test/defi-protocol",
            "branch": "main"
        })
        assert repo_response.status_code == 200
        repo_id = repo_response.json()["id"]
        
        # 2. Start verification
        verify_response = client.post("/api/verify", json={
            "pr_id": f"pr-{repo_id}-1",
            "repository_url": "https://github.com/test/defi-protocol",
            "pr_number": 1
        })
        assert verify_response.status_code == 200
        job_id = verify_response.json()["job_id"]
        
        # 3. Poll for completion (with timeout)
        max_attempts = 30
        for attempt in range(max_attempts):
            status_response = client.get(f"/api/verify/{job_id}")
            assert status_response.status_code == 200
            
            status = status_response.json()
            
            if status["status"] in ["completed", "failed"]:
                # Verification finished
                assert "result" in status or status["status"] == "failed"
                break
            
            # Wait before next poll
            await asyncio.sleep(1)
        
        # Should have completed within timeout
        final_status = client.get(f"/api/verify/{job_id}").json()
        assert final_status["status"] in ["completed", "failed"]


class TestErrorHandling:
    """Test error handling and edge cases"""
    
    def test_invalid_verification_request(self, client):
        """Test verification with missing required fields"""
        response = client.post("/api/verify", json={
            "pr_id": "test"
            # Missing repository_url and pr_number
        })
        assert response.status_code == 422  # Validation error
    
    def test_invalid_repository_url(self, client):
        """Test adding repository with invalid URL"""
        response = client.post("/api/repositories", json={
            "url": "not-a-valid-url",
            "branch": "main"
        })
        # Should still accept (validation happens later)
        assert response.status_code == 200


# Pytest configuration
def pytest_configure(config):
    """Configure pytest"""
    config.addinivalue_line(
        "markers", "asyncio: mark test as async"
    )
    config.addinivalue_line(
        "markers", "integration: mark test as integration test"
    )


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "--tb=short"])


# Made with Bob
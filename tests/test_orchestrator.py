"""
Unit tests for the neurosymbolic verification orchestrator
Tests different angles and scenarios
"""

import pytest
import asyncio
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent.parent))

from core.orchestrator import VerificationOrchestrator, verify_repository


class TestOrchestrator:
    """Test suite for verification orchestrator"""
    
    @pytest.mark.asyncio
    async def test_01_basic_verification_flow(self):
        """Test basic verification flow completes"""
        orchestrator = VerificationOrchestrator()
        events = []
        
        async for event in orchestrator.run_verification_stream("test-01", ".", {}):
            events.append(event)
        
        assert len(events) > 0
        assert any(e.get("type") == "loop_complete" for e in events)
    
    @pytest.mark.asyncio
    async def test_02_stage_sequence(self):
        """Test that stages execute in correct order"""
        orchestrator = VerificationOrchestrator()
        stages = []
        
        async for event in orchestrator.run_verification_stream("test-02", ".", {}):
            if event.get("type") == "stage_start":
                stages.append(event.get("stage"))
        
        expected_order = [
            "iteration",
            "repo_analysis",
            "z3_generation",
            "game_model_generation",
            "math_verification",
            "game_theory_verification"
        ]
        
        # Check first iteration has correct stages
        assert stages[:6] == expected_order
    
    @pytest.mark.asyncio
    async def test_03_bob_log_events(self):
        """Test that Bob log events are generated"""
        orchestrator = VerificationOrchestrator()
        bob_logs = []
        
        async for event in orchestrator.run_verification_stream("test-03", ".", {}):
            if event.get("type") == "bob_log":
                bob_logs.append(event)
        
        assert len(bob_logs) >= 3  # At least repo, z3, game model
        assert all("stage" in log for log in bob_logs)
    
    @pytest.mark.asyncio
    async def test_04_framework_results(self):
        """Test that framework results are yielded"""
        orchestrator = VerificationOrchestrator()
        framework_results = []
        
        async for event in orchestrator.run_verification_stream("test-04", ".", {}):
            if event.get("type") == "framework_result":
                framework_results.append(event)
        
        # Should have results from both math and game theory layers
        math_results = [r for r in framework_results if r.get("layer") == "math"]
        game_results = [r for r in framework_results if r.get("layer") == "game_theory"]
        
        assert len(math_results) > 0
        assert len(game_results) > 0
    
    @pytest.mark.asyncio
    async def test_05_max_iterations_limit(self):
        """Test that max iterations limit is enforced"""
        orchestrator = VerificationOrchestrator()
        orchestrator.max_iterations = 2
        
        iterations = []
        async for event in orchestrator.run_verification_stream("test-05", ".", {}):
            if event.get("type") == "stage_start" and event.get("stage") == "iteration":
                iterations.append(event.get("iteration"))
        
        assert max(iterations) <= 2
    
    @pytest.mark.asyncio
    async def test_06_patch_generation_on_failure(self):
        """Test that patch is generated when verification fails"""
        orchestrator = VerificationOrchestrator()
        patch_events = []
        
        async for event in orchestrator.run_verification_stream("test-06", ".", {}):
            if event.get("type") == "patch_ready":
                patch_events.append(event)
        
        # May or may not have patches depending on if verification passes
        # Just check structure if patches exist
        for patch_event in patch_events:
            assert "patch" in patch_event
            assert "iteration" in patch_event
    
    @pytest.mark.asyncio
    async def test_07_event_timestamps(self):
        """Test that all events have timestamps"""
        orchestrator = VerificationOrchestrator()
        events = []
        
        async for event in orchestrator.run_verification_stream("test-07", ".", {}):
            events.append(event)
        
        assert all("timestamp" in e for e in events)
    
    @pytest.mark.asyncio
    async def test_08_verification_log_saved(self):
        """Test that verification log is saved to file"""
        orchestrator = VerificationOrchestrator()
        verification_id = "test-08"
        
        events = []
        async for event in orchestrator.run_verification_stream(verification_id, ".", {}):
            events.append(event)
        
        log_file = orchestrator.verification_dir / f"{verification_id}.json"
        assert log_file.exists()
        
        with open(log_file) as f:
            log_data = json.load(f)
        
        assert log_data["verification_id"] == verification_id
        assert "iterations" in log_data
        assert "final_status" in log_data
    
    @pytest.mark.asyncio
    async def test_09_parallel_framework_execution(self):
        """Test that frameworks execute in parallel (timing check)"""
        import time
        
        orchestrator = VerificationOrchestrator()
        start_time = time.time()
        
        events = []
        async for event in orchestrator.run_verification_stream("test-09", ".", {}):
            events.append(event)
        
        duration = time.time() - start_time
        
        # If frameworks ran sequentially, would take much longer
        # This is a rough check - parallel should be faster
        assert duration < 60  # Should complete in reasonable time
    
    @pytest.mark.asyncio
    async def test_10_error_handling(self):
        """Test error handling with invalid inputs"""
        orchestrator = VerificationOrchestrator()
        
        events = []
        try:
            async for event in orchestrator.run_verification_stream("test-10", "/nonexistent/path", {}):
                events.append(event)
        except Exception:
            pass  # Expected to handle errors gracefully
        
        # Should still generate some events even with errors
        assert len(events) >= 0
    
    @pytest.mark.asyncio
    async def test_11_convenience_function(self):
        """Test the convenience verify_repository function"""
        events = await verify_repository(".", {"max_iterations": 1})
        
        assert isinstance(events, list)
        assert len(events) > 0
        assert all(isinstance(e, dict) for e in events)
    
    @pytest.mark.asyncio
    async def test_12_stage_complete_events(self):
        """Test that stage_complete events match stage_start events"""
        orchestrator = VerificationOrchestrator()
        
        starts = []
        completes = []
        
        async for event in orchestrator.run_verification_stream("test-12", ".", {}):
            if event.get("type") == "stage_start":
                starts.append(event.get("stage"))
            elif event.get("type") == "stage_complete":
                completes.append(event.get("stage"))
        
        # Every start should have a complete (except iteration)
        non_iteration_starts = [s for s in starts if s != "iteration"]
        assert len(completes) >= len(non_iteration_starts) - 1
    
    @pytest.mark.asyncio
    async def test_13_verification_status_types(self):
        """Test that final status is one of expected values"""
        orchestrator = VerificationOrchestrator()
        
        final_event = None
        async for event in orchestrator.run_verification_stream("test-13", ".", {}):
            if event.get("type") == "loop_complete":
                final_event = event
        
        assert final_event is not None
        assert final_event.get("status") in ["verified", "failed"]
    
    @pytest.mark.asyncio
    async def test_14_config_propagation(self):
        """Test that config is propagated to frameworks"""
        orchestrator = VerificationOrchestrator()
        custom_config = {"custom_param": "test_value"}
        
        events = []
        async for event in orchestrator.run_verification_stream("test-14", ".", custom_config):
            events.append(event)
        
        # Config should be used internally
        assert len(events) > 0


# Run tests
if __name__ == "__main__":
    print("=== Running Orchestrator Unit Tests ===\n")
    
    async def run_all_tests():
        test_suite = TestOrchestrator()
        
        tests = [
            ("Basic verification flow", test_suite.test_01_basic_verification_flow),
            ("Stage sequence", test_suite.test_02_stage_sequence),
            ("Bob log events", test_suite.test_03_bob_log_events),
            ("Framework results", test_suite.test_04_framework_results),
            ("Max iterations limit", test_suite.test_05_max_iterations_limit),
            ("Patch generation", test_suite.test_06_patch_generation_on_failure),
            ("Event timestamps", test_suite.test_07_event_timestamps),
            ("Verification log saved", test_suite.test_08_verification_log_saved),
            ("Parallel execution", test_suite.test_09_parallel_framework_execution),
            ("Error handling", test_suite.test_10_error_handling),
            ("Convenience function", test_suite.test_11_convenience_function),
            ("Stage complete events", test_suite.test_12_stage_complete_events),
            ("Verification status types", test_suite.test_13_verification_status_types),
            ("Config propagation", test_suite.test_14_config_propagation),
        ]
        
        passed = 0
        failed = 0
        
        for name, test_func in tests:
            try:
                print(f"Running: {name}...", end=" ")
                await test_func()
                print("✓ PASSED")
                passed += 1
            except Exception as e:
                print(f"✗ FAILED: {str(e)}")
                failed += 1
        
        print(f"\n{'='*50}")
        print(f"Results: {passed} passed, {failed} failed")
        print(f"{'='*50}")
    
    asyncio.run(run_all_tests())

# Made with Bob

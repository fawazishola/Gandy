"""
Full neurosymbolic verification loop test against GovernanceFacet.sol
"""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from core.orchestrator import VerificationOrchestrator


async def main():
    contract_path = Path("GovernanceFacet.sol")
    contract_code = contract_path.read_text()

    print("=" * 60)
    print("GANDY NEUROSYMBOLIC VERIFICATION LOOP")
    print(f"Target: {contract_path} ({len(contract_code)} chars)")
    print("=" * 60)

    orchestrator = VerificationOrchestrator()
    verification_id = "test-live-001"

    async for event in orchestrator.run_verification_stream(
        verification_id=verification_id,
        repo_path=".",
        config={}
    ):
        etype = event.get("type")

        if etype == "stage_start":
            stage = event.get("stage")
            it = event.get("iteration", "")
            label = f"[iter {it}] " if it else ""
            print(f"\n▶  {label}STAGE: {stage}")

        elif etype == "bob_log":
            stage = event.get("stage")
            success = event.get("success")
            out = event.get("output", "")
            status = "✓" if success else "✗"
            preview = out[:300].replace("\n", " ") if out else "(no output)"
            print(f"   {status} Bob/{stage}: {preview}")

        elif etype == "framework_result":
            layer = event.get("layer")
            fw = event.get("framework")
            result = event.get("result", {})
            status = "✓" if result.get("status") == "passed" else "✗"
            msg = result.get("message", "")
            print(f"   {status} [{layer}] {fw}: {msg}")

        elif etype == "stage_complete":
            stage = event.get("stage")
            success = event.get("success")
            mark = "✓" if success else "✗"
            print(f"   {mark} {stage} complete")

        elif etype == "patch_ready":
            patch = event.get("patch", {})
            print(f"\n   🔧 PATCH GENERATED:")
            print(f"      root_cause: {patch.get('root_cause', '')[:120]}")
            print(f"      vulnerability: {patch.get('vulnerability', '')[:120]}")
            print(f"      patch_description: {patch.get('patch_description', '')[:120]}")

        elif etype == "loop_complete":
            status = event.get("status")
            msg = event.get("message")
            it = event.get("iteration")
            print(f"\n{'=' * 60}")
            print(f"FINAL STATUS: {status.upper()} (after {it} iteration(s))")
            print(f"Message: {msg}")
            print("=" * 60)

        elif etype == "error":
            print(f"\n❌ ERROR: {event.get('message')}")
            import traceback
            traceback.print_exc()

    print(f"\nVerification log saved to: verifications/{verification_id}.json")


asyncio.run(main())

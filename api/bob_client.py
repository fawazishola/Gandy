"""
IBM Bob API Client - Direct REST API integration for Gandy
Replaces the CLI/PTY-based bob_bridge.py with pure API calls.

Endpoint:  https://api.us-east.bob.ibm.com/inference/v1/chat/completions
Auth:      Authorization: Apikey <key>   (for bob_prod_... keys)
           Authorization: Bearer <token> (for OAuth JWTs)
Required headers: x-instance-id, x-team-id
"""

import base64
import json
import os
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logger = logging.getLogger(__name__)


def _is_jwt(key: str) -> bool:
    """Return True if key is a JWT (3-part base64 string), False for raw API keys."""
    try:
        parts = key.split(".")
        if len(parts) != 3:
            return False
        base64.b64decode(parts[1] + "==")
        return True
    except Exception:
        return False


class BobAPIClient:
    """
    Client for the IBM Bob REST API.
    Drop-in replacement for the CLI-based bob_bridge approach.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        instance_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ):
        self.api_key = api_key or os.getenv("BOB_API_KEY")
        self.base_url = (
            base_url or os.getenv("BOB_BASE_URL", "https://api.us-east.bob.ibm.com")
        ).rstrip("/")
        self.model = model or os.getenv("BOB_MODEL", "premium-shell")
        self.instance_id = instance_id or os.getenv("BOB_INSTANCE_ID")
        self.team_id = team_id or os.getenv("BOB_TEAM_ID")

        if not self.api_key:
            logger.warning("BOB_API_KEY not set — API calls will fail.")

    def _headers(self) -> Dict[str, str]:
        # bob_prod_... keys use "Apikey" scheme; OAuth JWTs use "Bearer"
        auth_scheme = "Bearer" if _is_jwt(self.api_key) else "Apikey"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"{auth_scheme} {self.api_key}",
            "User-Agent": "bobshell/1.0.3",
        }
        if self.instance_id:
            headers["x-instance-id"] = self.instance_id
        if self.team_id:
            headers["x-team-id"] = self.team_id
        return headers

    async def chat(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.0,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat request and return the assistant message content."""
        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                f"{self.base_url}/inference/v1/chat/completions",
                headers=self._headers(),
                json=payload,
            )
            response.raise_for_status()
            return response.json()["choices"][0]["message"]["content"]

    def _extract_json(self, text: str) -> Any:
        """Strip markdown fences and parse JSON."""
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return json.loads(text.strip())

    async def analyze_contract(self, contract_code: str) -> Dict[str, Any]:
        """
        Ask Bob to audit a contract and produce Z3 + game-theory models.
        Returns parsed JSON matching the schema the orchestrator expects.
        """
        prompt = f"""Analyze the following smart contract for vulnerabilities, specifically focusing on
logical and economic exploits (like flash loan governance takeover).

Contract Code:
{contract_code}

Return ONLY valid JSON in this exact structure:
{{
  "vulnerabilities": [
    {{
      "type": "string",
      "severity": "critical|high|medium|low",
      "description": "string",
      "location": "string",
      "impact": "string"
    }}
  ],
  "math_model": {{
    "z3_spec": "string (SMT-LIB2 format)",
    "description": "what this spec proves"
  }},
  "game_model": {{
    "matrix": [[1, 0], [0, 1]],
    "players": ["Attacker", "Protocol"],
    "strategies": ["Exploit", "Honest", "Defend"],
    "description": "game theory reasoning"
  }}
}}"""

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a world-class smart contract security auditor "
                    "and formal verification expert. Always respond with valid JSON only."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        content = await self.chat(messages, max_tokens=8192)
        return self._extract_json(content)

    async def generate_patch(
        self,
        failures: Dict[str, Any],
        contract_code: str = "",
    ) -> Dict[str, Any]:
        """
        Ask Bob to generate a patch given verification failures.
        Returns parsed JSON with root_cause, vulnerability, patch_description, patched_code.
        """
        prompt = f"""The following verification checks failed:

{json.dumps(failures, indent=2)}

{"Original contract code:" + chr(10) + contract_code if contract_code else ""}

Generate a patch that fixes the vulnerabilities. Return ONLY valid JSON:
{{
  "root_cause": "explanation",
  "vulnerability": "description",
  "patch_description": "what the patch does",
  "patched_code": "complete fixed code"
}}"""

        messages = [
            {
                "role": "system",
                "content": (
                    "You are a world-class smart contract security auditor. "
                    "Always respond with valid JSON only."
                ),
            },
            {"role": "user", "content": prompt},
        ]

        content = await self.chat(messages, max_tokens=8192)
        return self._extract_json(content)

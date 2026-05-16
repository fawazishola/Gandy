"""
CLI Tool Manager for Gandy Backend
Manages subprocess execution of Bob CLI and Z3 solver with streaming output
"""

import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import AsyncGenerator, Dict, Any, Optional, List
import subprocess

logger = logging.getLogger(__name__)


class CLIManager:
    """Base class for CLI tool management"""
    
    def __init__(self, cli_path: str, name: str):
        self.cli_path = cli_path
        self.name = name
        self.process: Optional[asyncio.subprocess.Process] = None
        self._validate_cli()
    
    def _validate_cli(self):
        """Check if CLI tool exists and is executable"""
        if not os.path.exists(self.cli_path):
            logger.warning(f"{self.name} not found at {self.cli_path}")
            raise FileNotFoundError(f"{self.name} CLI not found at {self.cli_path}")
        
        if not os.access(self.cli_path, os.X_OK):
            logger.warning(f"{self.name} at {self.cli_path} is not executable")
            raise PermissionError(f"{self.name} CLI is not executable")
        
        logger.info(f"{self.name} CLI validated at {self.cli_path}")
    
    async def kill(self):
        """Terminate the running process"""
        if self.process and self.process.returncode is None:
            try:
                self.process.kill()
                await self.process.wait()
                logger.info(f"{self.name} process terminated")
            except Exception as e:
                logger.error(f"Error killing {self.name} process: {e}")


class BobCLIManager(CLIManager):
    """
    Manages Bob CLI subprocess and streams output
    
    Bob CLI is the AI code analysis tool that reads repositories
    and generates verification specifications
    """
    
    def __init__(self, bob_path: str = None):
        # Try multiple possible Bob CLI locations
        possible_paths = [
            bob_path,
            os.getenv("BOB_CLI_PATH"),
            "/usr/local/bin/bob",
            "/usr/bin/bob",
            str(Path.home() / ".local" / "bin" / "bob"),
        ]
        
        for path in possible_paths:
            if path and os.path.exists(path):
                super().__init__(path, "Bob CLI")
                return
        
        # If no Bob found, create a mock for development
        logger.warning("Bob CLI not found, using mock mode")
        self.cli_path = None
        self.name = "Bob CLI (Mock)"
    
    async def run_analysis(
        self,
        repo_path: str,
        prompt: str,
        timeout: int = 300
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Run Bob analysis on a repository and stream output
        
        Args:
            repo_path: Path to repository to analyze
            prompt: Analysis prompt for Bob
            timeout: Maximum execution time in seconds
            
        Yields:
            Dict with 'type' and 'data' keys for streaming events
        """
        if not self.cli_path:
            # Mock mode for development
            yield {"type": "log", "data": "⚠️ Running in mock mode (Bob CLI not installed)"}
            yield {"type": "log", "data": f"Would analyze: {repo_path}"}
            yield {"type": "log", "data": f"With prompt: {prompt[:100]}..."}
            yield {
                "type": "result",
                "data": {
                    "success": True,
                    "analysis": "Mock analysis result",
                    "stdout": "Mock Bob output"
                }
            }
            return
        
        try:
            # Build command
            cmd = [
                self.cli_path,
                "analyze",
                repo_path,
                "--prompt", prompt,
                "--format", "json"
            ]
            
            yield {"type": "log", "data": f"Starting Bob analysis: {' '.join(cmd)}"}
            
            # Start subprocess
            self.process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=repo_path if os.path.exists(repo_path) else None
            )
            
            # Stream stdout line by line
            output_lines = []
            try:
                async with asyncio.timeout(timeout):
                    while True:
                        line = await self.process.stdout.readline()
                        if not line:
                            break
                        
                        decoded_line = line.decode('utf-8').strip()
                        output_lines.append(decoded_line)
                        
                        yield {
                            "type": "log",
                            "data": decoded_line
                        }
            
            except asyncio.TimeoutError:
                yield {"type": "error", "data": f"Bob analysis timed out after {timeout}s"}
                await self.kill()
                return
            
            # Wait for process to complete
            await self.process.wait()
            
            # Check return code
            if self.process.returncode != 0:
                stderr = await self.process.stderr.read()
                error_msg = stderr.decode('utf-8')
                yield {
                    "type": "error",
                    "data": f"Bob failed with code {self.process.returncode}: {error_msg}"
                }
                return
            
            # Parse output
            full_output = '\n'.join(output_lines)
            yield {
                "type": "result",
                "data": {
                    "success": True,
                    "analysis": full_output,
                    "stdout": full_output
                }
            }
            
        except Exception as e:
            logger.error(f"Bob analysis error: {e}")
            yield {"type": "error", "data": f"Bob analysis failed: {str(e)}"}
        finally:
            await self.kill()


class Z3Manager(CLIManager):
    """
    Manages Z3 SMT solver subprocess
    
    Z3 is used for formal verification of mathematical properties
    """
    
    def __init__(self, z3_path: str = None):
        # Try multiple possible Z3 locations
        possible_paths = [
            z3_path,
            os.getenv("Z3_PATH"),
            "/usr/bin/z3",
            "/usr/local/bin/z3",
            str(Path.home() / ".local" / "bin" / "z3"),
        ]
        
        for path in possible_paths:
            if path and os.path.exists(path):
                super().__init__(path, "Z3 Solver")
                return
        
        raise FileNotFoundError("Z3 solver not found. Please install Z3.")
    
    async def verify(
        self,
        smt2_spec: str,
        timeout: int = 60
    ) -> Dict[str, Any]:
        """
        Run Z3 on SMT2 specification
        
        Args:
            smt2_spec: SMT-LIB2 format specification
            timeout: Maximum execution time in seconds
            
        Returns:
            Dict with verification result
        """
        # Write spec to temporary file
        with tempfile.NamedTemporaryFile(
            mode='w',
            suffix='.smt2',
            delete=False
        ) as f:
            f.write(smt2_spec)
            spec_file = f.name
        
        try:
            logger.info(f"Running Z3 on {spec_file}")
            
            # Run Z3
            self.process = await asyncio.create_subprocess_exec(
                self.cli_path,
                spec_file,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Wait with timeout
            try:
                async with asyncio.timeout(timeout):
                    stdout, stderr = await self.process.communicate()
            except asyncio.TimeoutError:
                await self.kill()
                return {
                    "status": "timeout",
                    "message": f"Z3 verification timed out after {timeout}s",
                    "output": ""
                }
            
            # Parse result
            output = stdout.decode('utf-8')
            stderr_output = stderr.decode('utf-8')
            
            if stderr_output:
                logger.warning(f"Z3 stderr: {stderr_output}")
            
            # Determine result
            if 'sat' in output and 'unsat' not in output:
                return {
                    "status": "sat",
                    "message": "Satisfiable - counterexample found",
                    "model": self._parse_model(output),
                    "output": output
                }
            elif 'unsat' in output:
                return {
                    "status": "unsat",
                    "message": "Unsatisfiable - property holds",
                    "output": output
                }
            elif 'unknown' in output:
                return {
                    "status": "unknown",
                    "message": "Z3 could not determine satisfiability",
                    "output": output
                }
            else:
                return {
                    "status": "error",
                    "message": "Unexpected Z3 output",
                    "output": output
                }
        
        except Exception as e:
            logger.error(f"Z3 verification error: {e}")
            return {
                "status": "error",
                "message": f"Z3 verification failed: {str(e)}",
                "output": ""
            }
        finally:
            # Cleanup temp file
            try:
                os.unlink(spec_file)
            except Exception as e:
                logger.warning(f"Failed to delete temp file {spec_file}: {e}")
            
            await self.kill()
    
    def _parse_model(self, output: str) -> Dict[str, Any]:
        """
        Parse Z3 model output
        
        Example output:
        sat
        (model
          (define-fun x () Int 42)
          (define-fun y () Int 10)
        )
        """
        model = {}
        
        try:
            # Extract model section
            if '(model' in output:
                model_section = output.split('(model')[1].split(')')[0]
                
                # Parse define-fun statements
                for line in model_section.split('\n'):
                    if 'define-fun' in line:
                        parts = line.strip().split()
                        if len(parts) >= 4:
                            var_name = parts[1]
                            var_value = parts[-1].rstrip(')')
                            model[var_name] = var_value
        
        except Exception as e:
            logger.warning(f"Failed to parse Z3 model: {e}")
        
        return model


class GitManager:
    """
    Manages Git operations for repository cloning and analysis
    """
    
    @staticmethod
    async def clone_repository(
        repo_url: str,
        target_dir: str,
        branch: str = "main"
    ) -> Dict[str, Any]:
        """
        Clone a Git repository
        
        Args:
            repo_url: Git repository URL
            target_dir: Directory to clone into
            branch: Branch to checkout
            
        Returns:
            Dict with clone result
        """
        try:
            logger.info(f"Cloning {repo_url} to {target_dir}")
            
            # Create target directory
            os.makedirs(target_dir, exist_ok=True)
            
            # Run git clone
            process = await asyncio.create_subprocess_exec(
                'git', 'clone',
                '--branch', branch,
                '--depth', '1',  # Shallow clone for speed
                repo_url,
                target_dir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode('utf-8')
                logger.error(f"Git clone failed: {error_msg}")
                return {
                    "success": False,
                    "error": error_msg
                }
            
            logger.info(f"Successfully cloned {repo_url}")
            return {
                "success": True,
                "path": target_dir,
                "branch": branch
            }
        
        except Exception as e:
            logger.error(f"Git clone error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    async def fetch_pr_diff(
        repo_path: str,
        pr_number: int
    ) -> Dict[str, Any]:
        """
        Fetch pull request diff
        
        Args:
            repo_path: Path to repository
            pr_number: Pull request number
            
        Returns:
            Dict with diff content
        """
        try:
            # Fetch PR
            process = await asyncio.create_subprocess_exec(
                'git', 'fetch', 'origin',
                f'pull/{pr_number}/head:pr-{pr_number}',
                cwd=repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await process.communicate()
            
            if process.returncode != 0:
                return {"success": False, "error": "Failed to fetch PR"}
            
            # Get diff
            process = await asyncio.create_subprocess_exec(
                'git', 'diff', 'main', f'pr-{pr_number}',
                cwd=repo_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                return {"success": False, "error": "Failed to get diff"}
            
            return {
                "success": True,
                "diff": stdout.decode('utf-8')
            }
        
        except Exception as e:
            logger.error(f"Git PR fetch error: {e}")
            return {"success": False, "error": str(e)}


# Factory functions for easy instantiation
def create_bob_manager(bob_path: str = None) -> BobCLIManager:
    """Create Bob CLI manager instance"""
    return BobCLIManager(bob_path)


def create_z3_manager(z3_path: str = None) -> Z3Manager:
    """Create Z3 manager instance"""
    return Z3Manager(z3_path)


def create_git_manager() -> GitManager:
    """Create Git manager instance"""
    return GitManager()


# Made with Bob
"""
Bob Bridge - Interface for interacting with Bob CLI and terminal
Provides both non-interactive subprocess execution and interactive PTY terminal
"""

import subprocess
import json
import time
import os
import uuid
from pathlib import Path
from typing import Optional, List, Dict, Any, Callable
from datetime import datetime
import ptyprocess

# Session storage directory
SESSIONS_DIR = Path("bob_sessions")
SESSIONS_DIR.mkdir(exist_ok=True)


def run_bob(
    prompt: str,
    files: Optional[List[str]] = None,
    repo: Optional[str] = None
) -> Dict[str, Any]:
    """
    Run Bob CLI non-interactively and capture output.
    
    Args:
        prompt: The prompt/question to send to Bob
        files: Optional list of file paths to include as context
        repo: Optional repository path to analyze
        
    Returns:
        Dict with keys:
            - success: bool indicating if command succeeded
            - stdout: raw stdout string
            - parsed: parsed JSON if stdout is valid JSON, else None
            - duration: execution time in seconds
            - session_id: unique session identifier
    """
    session_id = str(uuid.uuid4())
    start_time = time.time()
    
    # Build command
    cmd = ["bob"]
    
    # Add file arguments
    if files:
        for file_path in files:
            cmd.extend(["--file", file_path])
    
    # Add repo argument
    if repo:
        cmd.extend(["--repo", repo])
    
    # Add prompt
    cmd.append(prompt)
    
    result = {
        "session_id": session_id,
        "success": False,
        "stdout": "",
        "stderr": "",
        "parsed": None,
        "duration": 0,
        "command": " ".join(cmd),
        "timestamp": datetime.utcnow().isoformat()
    }
    
    try:
        # Run Bob command
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minute timeout
        )
        
        result["stdout"] = process.stdout
        result["stderr"] = process.stderr
        result["success"] = process.returncode == 0
        result["return_code"] = process.returncode
        
        # Try to parse stdout as JSON
        if result["stdout"].strip():
            try:
                result["parsed"] = json.loads(result["stdout"])
            except json.JSONDecodeError:
                # Not JSON, that's okay
                pass
        
    except subprocess.TimeoutExpired:
        result["error"] = "Command timed out after 300 seconds"
    except FileNotFoundError:
        result["error"] = "Bob CLI not found. Ensure 'bob' is in PATH"
    except Exception as e:
        result["error"] = str(e)
    
    # Calculate duration
    result["duration"] = time.time() - start_time
    
    # Save session to file
    session_file = SESSIONS_DIR / f"{session_id}.json"
    with open(session_file, "w") as f:
        json.dump(result, f, indent=2)
    
    return result


class BobTerminal:
    """
    Interactive Bob terminal using PTY process.
    Spawns Bob shell and provides methods for interaction.
    """
    
    def __init__(self, on_output: Optional[Callable[[str], None]] = None):
        """
        Initialize Bob terminal.
        
        Args:
            on_output: Optional callback function called with output chunks
        """
        self.process: Optional[ptyprocess.PtyProcess] = None
        self.on_output = on_output
        self.session_id = str(uuid.uuid4())
        self.session_log: List[Dict[str, Any]] = []
        self.is_running = False
        self.start_time: Optional[float] = None
        
    def start(self, rows: int = 24, cols: int = 80) -> bool:
        """
        Start the Bob terminal process.
        
        Args:
            rows: Terminal rows
            cols: Terminal columns
            
        Returns:
            True if started successfully, False otherwise
        """
        if self.is_running:
            return False
        
        try:
            # Spawn Bob in PTY
            self.process = ptyprocess.PtyProcess.spawn(
                ["bob"],
                dimensions=(rows, cols)
            )
            self.is_running = True
            self.start_time = time.time()
            
            # Log session start
            self._log_event("session_start", {
                "session_id": self.session_id,
                "dimensions": {"rows": rows, "cols": cols},
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True
            
        except Exception as e:
            self._log_event("session_start_error", {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return False
    
    def send_input(self, text: str) -> bool:
        """
        Send input to the Bob terminal.
        
        Args:
            text: Text to send (will append newline if not present)
            
        Returns:
            True if sent successfully, False otherwise
        """
        if not self.is_running or not self.process:
            return False
        
        try:
            # Ensure text ends with newline
            if not text.endswith("\n"):
                text += "\n"
            
            self.process.write(text)
            
            # Log input
            self._log_event("input", {
                "text": text.rstrip("\n"),
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Read and process output
            self._read_output()
            
            return True
            
        except Exception as e:
            self._log_event("input_error", {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return False
    
    def resize(self, rows: int, cols: int) -> bool:
        """
        Resize the terminal.
        
        Args:
            rows: New number of rows
            cols: New number of columns
            
        Returns:
            True if resized successfully, False otherwise
        """
        if not self.is_running or not self.process:
            return False
        
        try:
            self.process.setwinsize(rows, cols)
            
            self._log_event("resize", {
                "rows": rows,
                "cols": cols,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return True
            
        except Exception as e:
            self._log_event("resize_error", {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return False
    
    def stop(self) -> bool:
        """
        Stop the Bob terminal process.
        
        Returns:
            True if stopped successfully, False otherwise
        """
        if not self.is_running or not self.process:
            return False
        
        try:
            # Send exit command
            self.process.write("exit\n")
            time.sleep(0.5)
            
            # Terminate process
            self.process.terminate(force=True)
            self.is_running = False
            
            # Calculate session duration
            duration = time.time() - self.start_time if self.start_time else 0
            
            # Log session end
            self._log_event("session_end", {
                "duration": duration,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            # Save session log
            self._save_session()
            
            return True
            
        except Exception as e:
            self._log_event("session_end_error", {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
            return False
    
    def _read_output(self, timeout: float = 1.0) -> None:
        """
        Read output from the terminal and call callback.
        
        Args:
            timeout: Maximum time to wait for output
        """
        if not self.process:
            return
        
        try:
            output = self.process.read(timeout=timeout)
            if output:
                # Log output
                self._log_event("output", {
                    "text": output,
                    "timestamp": datetime.utcnow().isoformat()
                })
                
                # Call callback if provided
                if self.on_output:
                    self.on_output(output)
                    
        except ptyprocess.exceptions.TIMEOUT:
            # No output available, that's okay
            pass
        except Exception as e:
            self._log_event("output_error", {
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            })
    
    def _log_event(self, event_type: str, data: Dict[str, Any]) -> None:
        """
        Log an event to the session log.
        
        Args:
            event_type: Type of event
            data: Event data
        """
        self.session_log.append({
            "event_type": event_type,
            "data": data
        })
    
    def _save_session(self) -> None:
        """
        Save the session log to a JSON file.
        """
        session_file = SESSIONS_DIR / f"{self.session_id}_terminal.json"
        
        session_data = {
            "session_id": self.session_id,
            "session_type": "terminal",
            "start_time": self.start_time,
            "events": self.session_log
        }
        
        with open(session_file, "w") as f:
            json.dump(session_data, f, indent=2)
    
    def __enter__(self):
        """Context manager entry."""
        self.start()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.stop()


# Example usage
if __name__ == "__main__":
    # Example 1: Non-interactive command
    print("=== Non-interactive Bob execution ===")
    result = run_bob(
        "What is the capital of France?",
        files=["example.txt"],
        repo="."
    )
    print(f"Success: {result['success']}")
    print(f"Duration: {result['duration']:.2f}s")
    print(f"Session ID: {result['session_id']}")
    print(f"Output: {result['stdout'][:200]}...")
    
    # Example 2: Interactive terminal
    print("\n=== Interactive Bob terminal ===")
    
    def handle_output(text: str):
        print(f"[OUTPUT] {text}", end="")
    
    with BobTerminal(on_output=handle_output) as terminal:
        terminal.send_input("Hello Bob!")
        time.sleep(2)
        terminal.send_input("What can you do?")
        time.sleep(2)

# Made with Bob

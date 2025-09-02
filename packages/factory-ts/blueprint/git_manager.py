import subprocess
import os
from pathlib import Path
from typing import List
from urllib.parse import urlparse


class GitManager:
    """A class to interact with a git repository in its current directory."""

    def __init__(self, repo_path: str, branch_name: str | None = None):
        self.repo_path = Path(repo_path)
        self.branch_name = branch_name

        if not all([os.getenv("GIT_USER_NAME"), os.getenv("GIT_USER_EMAIL")]):
            print("ERROR: GIT_USER_NAME and GIT_USER_EMAIL must be set in your .env file.")
            return
    
        self._run_command(["config", "user.name", os.getenv("GIT_USER_NAME")])
        self._run_command(["config", "user.email", os.getenv("GIT_USER_EMAIL")])

    def _run_command(self, command: List[str]) -> str:
        try:
            return subprocess.run(
                ["git"] + command, cwd=self.repo_path,
                capture_output=True, text=True, check=True
            ).stdout.strip()
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Git command failed: {' '.join(command)}\nStderr: {e.stderr}") from e

    def checkout_branch(self, branch_name: str, new: bool = True):
        """Creates and checks out a new branch from the current HEAD."""
        print(f"Creating and checking out new branch '{branch_name}'...")
        if new:
            self._run_command(["checkout", "-b", branch_name])
        else:
            self._run_command(["checkout", branch_name])
        self.branch_name = branch_name

    def stage_files(self, files: List[str]):
        self._run_command(["add"] + files)

    def commit(self, message: str):
        self._run_command(["commit", "-m", message])

    def pull(self, branch_name: str | None = None,  remote_name: str = "origin"):
        self._run_command(["pull", remote_name, branch_name if branch_name else self.branch_name])

    def push(self, branch_name: str | None = None, remote_name: str = "origin"):
        """Pushes the specified branch to the remote, using credentials from .env."""
        repo_url = os.getenv("GIT_REPO_URL")
        username = os.getenv("GIT_USER_NAME")
        pat = os.getenv("GIT_PAT")

        if not all([repo_url, username, pat]):
            raise ValueError("GIT_REPO_URL, GIT_USER_NAME, and GIT_PAT must be set in .env for push operations.")

        # Construct the authenticated URL
        parsed_url = urlparse(repo_url)
        authenticated_url = f"{parsed_url.scheme}://{username}:{pat}@{parsed_url.netloc}{parsed_url.path}"
        
        # Set the remote URL to the authenticated one for this push command
        self._run_command(["remote", "set-url", remote_name, authenticated_url])
        
        print(f"Pushing branch '{branch_name if branch_name else self.branch_name}' to remote repository...")
        self._run_command(["push", "-u", remote_name, branch_name if branch_name else self.branch_name])
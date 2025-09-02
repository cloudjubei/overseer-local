import argparse
import os
import shutil
import subprocess
import tempfile
import traceback
from pathlib import Path

IGNORE_PATTERNS = shutil.ignore_patterns('venv', '__pycache__', '*.pyc', '.idea')

def main():
    """
    Main launcher for the AI agent. It must be run from the project's root directory.
    This creates a temporary copy and executes scripts/run_local_agent.py in it.
    """
    parser = argparse.ArgumentParser(description="Launcher for the autonomous AI agent.")
    parser.add_argument("--model", type=str, default="gpt-4-turbo-preview", help="LLM model name.")
    parser.add_argument("--agent", type=str, required=False, choices=['developer', 'tester', 'planner', 'contexter', 'speccer'], help="Agent persona.")
    parser.add_argument("--task", type=str, required=False, help="Specify a task ID to work on.")
    parser.add_argument("--project-dir", type=str, help="Optional: Target child project directory.")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        workspace_path = temp_dir / "workspace"

        print(f"Copying repository from '{project_root}' to temporary workspace: '{workspace_path}'")

        try:
            shutil.copytree(project_root, workspace_path, ignore=IGNORE_PATTERNS)
        except Exception as e:
            print(f"FATAL: Failed to copy repository to temporary directory: {e}")
            print("\n--- Full Stack Trace ---")
            traceback.print_exc()
            print("------------------------\n")
            return

        orchestrator_script_path = workspace_path / "scripts" / "run_local_agent.py"

        command = [
            "python3",
            str(orchestrator_script_path),
        ]
        
        if args.agent:
            command.extend(["--agent", args.agent])
        if args.model:
            command.extend(["--model", args.model])
        if args.task:
            command.extend(["--task", str(args.task)])
        if args.project_dir:
            project_dir = workspace_path / args.project_dir
            command.extend(["--project-dir", str(project_dir)])

        print(f"Executing orchestrator: {' '.join(command)}")

        try:
            subprocess.run(command, cwd=workspace_path, check=True)
        except subprocess.CalledProcessError as e:
            print(f"\n--- An error occurred while running the agent orchestrator: {e} ---")
            print("\n--- Full Stack Trace ---")
            traceback.print_exc()
            print("------------------------\n")
        except KeyboardInterrupt:
            print("\n--- Agent run interrupted by user. ---")

    print("\n--- Agent run finished. Temporary directory cleaned up. ---")

if __name__ == "__main__":
    main()

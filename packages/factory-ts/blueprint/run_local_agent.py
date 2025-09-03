import argparse
import json
import os
import sys
import inspect
import traceback
from dotenv import load_dotenv
from pathlib import Path
from typing import Dict, Any, List, Optional, Callable, Tuple
import subprocess

# Add project root (framework root) to sys.path
framework_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(framework_root))

# Lazy-safe import for litellm
try:
    from litellm import completion
except Exception:
    def completion(*args, **kwargs):
        raise RuntimeError("litellm is not available in this environment.")

from docs.tasks.task_format import Task, Feature
from scripts.git_manager import GitManager
import scripts.task_utils as task_utils

# --- Constants ---
MAX_TURNS_PER_FEATURE = 100
# Framework workspace root (where this orchestrator code runs)
FRAMEWORK_ROOT = Path.cwd()

try:
    PROTOCOL_EXAMPLE_PATH = FRAMEWORK_ROOT / "docs" / "agent_response_example.json"
    with open(PROTOCOL_EXAMPLE_PATH, "r") as f:
        PROTOCOL_EXAMPLE_STR = json.dumps(json.load(f), indent=2)
except (FileNotFoundError, json.JSONDecodeError) as e:
    print(f"FATAL: Could not load or parse agent_response_example.json: {e}")
    PROTOCOL_EXAMPLE_STR = '{\n  "thoughts": "Your reasoning here...",\n  "tool_calls": [ ... ]\n}'

PROTOCOL_INSTRUCTIONS = f"""
You **MUST** respond in a single, valid JSON object. This object must adhere to the following structure:
```json
{PROTOCOL_EXAMPLE_STR}
```
The thoughts field is for your reasoning, and tool_calls is a list of actions to execute.
Your response will be parsed as JSON. Do not include any text outside of this JSON object.
"""

NEWLINE = "\n"

# --- Tool Mapping ---

def get_available_tools(agent_type: str, git_manager: GitManager) -> Tuple[Dict[str, Callable], List[str]]:
    """
    Returns a tuple containing:
    1. A dictionary of callable tool functions.
    2. A list of formatted tool signature strings for the prompt.
    """
    base_tools = {
        "read_files": (task_utils.read_files, "read_files(paths: list[str]) -> list[str]"),
        "search_files": (task_utils.search_files, "search_files(query: str, path: str = '.') -> list[str]"),
        "block_feature": (lambda task_id, feature_id, reason: task_utils.block_feature(task_id, feature_id, reason, agent_type, git_manager), "block_feature(reason: str)"),
        "finish_feature": (lambda task_id, feature_id: task_utils.finish_feature(task_id, feature_id, agent_type, git_manager), "finish_feature()"),
        "list_files": (lambda path: task_utils.list_files(path), "list_files(path: str)")
    }

    agent_tools = {}
    # The signatures are simplified for the agent. The orchestrator handles the rest.
    if agent_type == 'speccer':
        agent_tools = {
            "create_feature": (task_utils.create_feature, "create_feature(title: str, description: str)"),
            "finish_spec": (lambda task_id: task_utils.finish_spec(task_id, agent_type, git_manager), "finish_spec()"),
            "block_task": (lambda task_id: task_utils.block_task(task_id, agent_type, git_manager), "block_task()"),
        }
    elif agent_type == 'developer':
        agent_tools = {
            "write_file": (task_utils.write_file, "write_file(filename: str, content: str)"),
            "rename_file": (task_utils.rename_file, "rename_file(filename: str, new_filename: str)"),
            "delete_file": (task_utils.delete_file, "delete_file(filename: str)"),
            "run_test": (task_utils.run_test, "run_test() -> str"),
        }
    elif agent_type == 'planner':
        agent_tools = {
            "update_feature_plan": (task_utils.update_feature_plan, "update_feature_plan(plan: str)")
        }
    elif agent_type == 'tester':
        agent_tools = {
            "update_acceptance_criteria": (task_utils.update_acceptance_criteria, "update_acceptance_criteria(criteria: list[str])"),
            "update_test": (task_utils.update_test, "update_test(test: str)"),
            "run_test": (task_utils.run_test, "run_test() -> str"),
        }
    elif agent_type == 'contexter':
        agent_tools = {
            "update_feature_context": (task_utils.update_feature_context, "update_feature_context(context: list[str])"),
        }
    
    base_tools.update(agent_tools)
    
    # Unzip the dictionary into two separate structures
    tool_functions = {name: func for name, (func, sig) in base_tools.items()}
    tool_signatures = [sig for name, (func, sig) in base_tools.items()]
    
    return tool_functions, tool_signatures

def construct_system_prompt(agent_type: str, task: Task, feature: Feature, agent_system_prompt: str, context: str, tool_signatures: List[str]) -> str:
    """Constructs the detailed system prompt, specialized for the agent type."""

    plan = ""
    if feature and agent_type in ['developer', 'tester', 'contexter', 'planner']:
        plan = f"{feature.get('plan', 'EMPTY')}"

    acceptance_criteria = ""
    if feature and agent_type in ['developer', 'tester']:
        acceptance_criteria = "\n".join(f"{i}. {criterion}" for i, criterion in enumerate(feature.get('acceptance', []), 1))

    tool_signatures_str = "\n".join(f"- {sig}" for sig in tool_signatures)

    prompt = f"""{agent_system_prompt}
#CURRENT TASK (ID: {task.get('id')})
##TITLE:
{task.get('title')}
##DESCRIPTION:
{task.get('description')}
{ task.get('rejection') and f"##REJECTION REASON:{NEWLINE}{task.get('rejection')}"}

{ feature and f"#ASSIGNED FEATURE: {feature['title']} (ID: {feature.get('id')}{NEWLINE}##DESCRIPTION: {feature.get('description')}{NEWLINE}"}
{ feature and feature.get('rejection') and f"##REJECTION REASON:{NEWLINE}{feature.get('rejection')}{NEWLINE}"}

#THE PLAN
{plan}

#ACCEPTANCE CRITERIA:
{acceptance_criteria}

#TOOL SIGNATURES:
'{tool_signatures_str}'

#RESPONSE FORMAT INSTRUCTIONS:
{PROTOCOL_INSTRUCTIONS}

#CONTEXT FILES PROVIDED:
{context}

Begin now.
"""
    return prompt

def run_agent_on_task(model: str, agent_type: str, task: Task, git_manager: GitManager):
    print(f"\n--- Activating Agent {agent_type} for task: [{task.get('id')}] {task.get('title')} ---")

    agent_system_prompt = (FRAMEWORK_ROOT / f"docs/AGENT_{agent_type.upper()}.md").read_text()
    context_files = ["docs/FILE_ORGANISATION.md"]
    available_tools, tool_signatures = get_available_tools(agent_type, git_manager)
    context = task_utils.read_files(context_files)
    system_prompt = construct_system_prompt(agent_type, task, None, agent_system_prompt, context, tool_signatures)

    return _run_agent_conversation(model, available_tools, system_prompt, task, None, agent_type, git_manager)

def run_agent_on_feature(model: str, agent_type: str, task: Task, feature: Feature, git_manager: GitManager):
    print(f"\n--- Activating Agent {agent_type} for Feature: [{feature.get('id')}] {feature['title']} ---")

    if agent_type == 'developer':
        task_utils.update_feature_status(task.get('id'), feature.get('id'), '~')

    agent_system_prompt = (FRAMEWORK_ROOT / f"docs/AGENT_{agent_type.upper()}.md").read_text()
    feature_context_files = ["docs/FILE_ORGANISATION.md"] + feature.get("context", [])

    available_tools, tool_signatures = get_available_tools(agent_type, git_manager)
    context = task_utils.read_files(feature_context_files)

    system_prompt = construct_system_prompt(agent_type, task, feature, agent_system_prompt, context, tool_signatures)

    if agent_type == 'developer':
        task_utils.update_feature_status(task.get('id'), feature.get('id'), '~')

    return _run_agent_conversation(model, available_tools, system_prompt, task, feature, agent_type, git_manager)

def _run_agent_conversation(model: str, available_tools: Dict[str, Callable], system_prompt: str, task: Task, feature: Feature | None, agent_type: str, git_manager: GitManager) -> bool:
    messages = [{"role": "user", "content": system_prompt}]

    for i in range(MAX_TURNS_PER_FEATURE):
        print(f"\n--- Feature Turn {i+1}/{MAX_TURNS_PER_FEATURE} ---")
        
        try:
            response = completion(model=model, messages=messages, response_format={"type": "json_object"})
            assistant_message = response.choices[0].message
            messages.append(assistant_message)
            
            response_json = json.loads(assistant_message.content)
            thoughts = response_json.get("thoughts", "No thoughts provided.")
            tool_calls = response_json.get("tool_calls", [])
            print(f"Agent Thoughts: {thoughts}")

            if not tool_calls or len(tool_calls) == 0: continue

            tool_outputs = []
            for call in tool_calls:
                tool_name = call.get("tool_name", call.get("tool", call.get("name", "unknown_tool")))
                tool_args = call.get("arguments", call.get("parameters", {}))
                
                print(f"Executing Tool: {tool_name} with args: {tool_args}")
                
                if tool_name in available_tools:
                    tool_func = available_tools[tool_name]
                    sig = inspect.signature(tool_func)
                    params = sig.parameters
                    
                    if 'task_id' in params:
                        tool_args.setdefault('task_id', task.get('id'))
                    if (not (feature is None)) and ('feature_id' in params):
                        tool_args.setdefault('feature_id', feature.get('id'))

                    result = available_tools[tool_name](**tool_args)
                    tool_outputs.append(f"Tool {tool_name} returned: {result}")
                else:
                    tool_outputs.append(f"Error: Tool '{tool_name}' not found.")

                if tool_name in ['finish_feature', 'block_feature', 'finish_spec', 'block_task']:
                    print(f"Agent called '{tool_name}'. Concluding work on this.")
                    return True

            messages.append({"role": "user", "content": "--- TOOL RESULTS ---\n" + "\n".join(tool_outputs)})

        except Exception as e:
            print(f"An error occurred in agent loop: {e}")
            print("\n--- Full Stack Trace ---")
            traceback.print_exc()
            print("------------------------\n")
            if (not (feature is None)):
                task_utils.block_feature(task.get('id'), feature.get('id'), f"Agent loop failed: {e}", agent_type, git_manager)
            else:
                task_utils.block_task(task.get('id'), f"Agent loop failed: {e}", agent_type, git_manager)
                
            return True
            
    if (not (feature is None)):
        print(f"Max turns reached for feature {feature.get('id')}. Blocking.")
        task_utils.block_feature(task.get('id'), feature.get('id'), f"Agent loop failed: {e}", agent_type, git_manager)
    else:
        print(f"Max turns reached for task {task.get('id')}. Blocking.")
        task_utils.block_task(task.get('id'), f"Agent loop failed: {e}", agent_type, git_manager)
    return True


def run_orchestrator(model: str, agent_type: str, task_id: str, project_dir: Optional[str] = None):
    """
    Main orchestration loop. It can target a child project directory or the current working directory.
    """
    try:
        # Determine the target project root and configure task utils
        target_root = Path(project_dir).resolve() if project_dir else Path.cwd()
        print(f"Target project root: {target_root}")
        task_utils.set_project_root(target_root)

        current_task = task_utils.get_task(task_id) 

        if not current_task:
            print("No available tasks to work on in the repository.")
            return
        
        print(f"Selected Task: [{task_id}] {current_task.get('title')}")
        
        git_manager = GitManager(str(target_root))
        
        branch_name = f"features/{task_id}"
        try:
            git_manager.checkout_branch(branch_name)
        except Exception as e:
            print(f"Could not create or checkout branch '{branch_name}': {e}")
            git_manager.checkout_branch(branch_name, False)
        try:
            git_manager.pull(branch_name)
        except Exception as e:
            print(f"Could not pull branch '{branch_name}': {e}")

        processed_feature_ids = set()
        if agent_type == "speccer":
            current_task = task_utils.get_task(task_id)
            run_agent_on_task(model, agent_type, current_task, git_manager)
        else:
            while True:
                current_task = task_utils.get_task(task_id)
                next_feature = task_utils.find_next_available_feature(current_task, processed_feature_ids, agent_type != "developer")
                
                if not next_feature:
                    print(f"\nNo more available features for task {task_id}.")
                    break
                
                run_agent_on_feature(model, agent_type, current_task, next_feature, git_manager)
                processed_feature_ids.add(next_feature.get('id'))

    except Exception as e:
        print(f"\n--- A critical error occurred during the orchestrator run: {e} ---")
        print("\n--- Full Stack Trace ---")
        traceback.print_exc()
        print("------------------------\n")

def main():
    parser = argparse.ArgumentParser(description="Run an autonomous AI agent.")
    parser.add_argument("--model", type=str, default="gpt-5", help="LLM model name.")
    parser.add_argument("--agent", type=str, required=True, choices=['developer', 'tester', 'planner', 'contexter', 'speccer'], help="Agent persona.")
    parser.add_argument("--task", type=str, required=True, help="Specify a task ID to work on.")
    parser.add_argument("--project-dir", type=str, help="Optional: Target child project directory.")
    
    args = parser.parse_args()

    # Attempt to bridge to Node CLI (only pass minimal args that map clearly)
    bridged = try_bridge_to_node(args.project_dir, args.task)
    if bridged:
        return

    if args.project_dir:
        load_dotenv(args.project_dir + "/.env")
    else:
        load_dotenv()
        
    run_orchestrator(model=args.model, agent_type=args.agent, task_id=args.task, project_dir=args.project_dir)

if __name__ == "__main__":
    main()

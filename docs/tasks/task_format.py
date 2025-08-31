from typing import Dict, TypedDict, List, Literal

try:
    from typing import NotRequired
except ImportError:
    from typing_extensions import NotRequired

Status = Literal[
    "+", # Done
    "~", # In Progress
    "-", # Pending
    "?", # Blocked
    "=" # Deferred
]

class Feature(TypedDict):
    id: str
    status: Status
    title: str
    description: str
    plan: str
    context: List[str]
    acceptance: List[str]
    dependencies: NotRequired[List[str]] # ["{task_id}.{feature_id}","{task_id}"]
    rejection: NotRequired[str]

class Task(TypedDict):
    id: str
    status: Status
    title: str
    description: str
    features: List[Feature]
    dependencies: NotRequired[List[str]] # ["{task_id}.{feature_id}","{task_id}"]
    rejection: NotRequired[str]
    featureIdToDisplayIndex: Dict[str,int]

class ProjectRequirement(TypedDict):
    id: int
    status: Status
    description: str
    tasks: List[str]

class ProjectSpec(TypedDict):
    id: str
    title: str
    description: str
    path: str
    repo_url: str
    requirements: List[ProjectRequirement]
    taskIdToDisplayIndex: Dict[str,int]

from typing import TypedDict, List, Literal

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
    dependencies: NotRequired[List[str]]
    rejection: NotRequired[str]


class Task(TypedDict):
    id: int
    status: Status
    title: str
    description: str
    features: List[Feature]
    rejection: NotRequired[str]

class ProjectRequirement(TypedDict):
    id: int
    status: Status
    description: str
    tasks: List[int]

class ProjectSpec(TypedDict):
    id: str
    title: str
    description: str
    path: str
    repo_url: str
    requirements: List[ProjectRequirement]


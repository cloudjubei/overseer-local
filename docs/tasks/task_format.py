from typing import Dict, TypedDict, List, Literal

try:
    from typing import NotRequired
except ImportError:
    from typing_extensions import NotRequired

Status = Literal[
    "+", # Done
    "~", # Crunching
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
    blockers: NotRequired[List[str]] # ["{story_id}.{feature_id}","{story_id}"]
    rejection: NotRequired[str]

class Story(TypedDict):
    id: str
    status: Status
    title: str
    description: str
    features: List[Feature]
    blockers: NotRequired[List[str]] # ["{story_id}.{feature_id}","{story_id}"]
    rejection: NotRequired[str]
    featureIdToDisplayIndex: Dict[str,int]

class ProjectRequirement(TypedDict):
    id: int
    status: Status
    description: str
    stories: List[str]

class ProjectSpec(TypedDict):
    id: str
    title: str
    description: str
    path: str
    repo_url: str
    requirements: List[ProjectRequirement]
    storyIdToDisplayIndex: Dict[str,int]

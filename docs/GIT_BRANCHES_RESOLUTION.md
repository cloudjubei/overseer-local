# Feature Request: Unify Local and Remote Branch Representation

## Description

The current gitTools API returns local and remote branches as distinct entities.
The API should be enhanced to provide a unified view of branches. A single branch entry should contain all relevant information, including its local presence, remote presence, tracking relationship, and any associated metadata.

### Proposed API Enhancement

Instead of separate lists for local and remote branches, the API could return a single, consolidated list. Each branch object could look something like this:

```json
{
  "name": "features/f67e8921-b197-40c9-9154-e95db8f27deb",
  "fullName": "refs/heads/features/f67e8921-b197-40c9-9154-e95db8f27deb",
  "isLocal": true,
  "isRemote": true,
  "remoteName": "origin/features/f67e8921-b197-40c9-9154-e95db8f27deb",
  "storyId": "f67e8921-b197-40c9-9154-e95db8f27deb",
  "ahead": 2,
  "behind": 0
}
```

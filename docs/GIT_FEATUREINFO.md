# Git FeatureInfo Contract

Purpose

- Enable the UI to display story/feature chips for pending commits in Git views.
- Provide a stable contract for 'thefactory-tools' to surface feature metadata from commits so the renderer does not have to heuristically parse commit messages.

Scope

- Applies to operations that return commits or reports about commits relative to a base ref (e.g., selectCommits, branch/workspace reports, merge reports, monitors).
- Backward compatible: tools MAY omit the new fields; the UI falls back to commit message parsing.

Commit FeatureInfo Shape

- Source: thefactory-tools should attach an optional 'featureInfo' to commit-like entries where possible.
- When present, it should include the resolved story/feature identifiers and human metadata to display in tooltips.

Schema

- Versioning: Additively extended. Fields are optional; consumers must feature-detect.

Types (pseudo-TS for docs)

- type FeatureRef = {
    storyId: string            // canonical story id (UUID or similar)
    featureId?: string         // canonical feature id if commit is tied to a specific feature
  }

- type FeatureInfo = FeatureRef & {
    title?: string             // feature or story title for nice display (prefer feature when featureId is set)
    description?: string       // short description
  }

- interface CommitInfo {
    sha: string
    parents: string[]
    summary: string            // commit subject line
    authorName?: string
    authorEmail?: string
    authorDate?: number
    featureInfo?: FeatureInfo  // NEW: optional enriched mapping to story/feature
  }

Extraction Guidance

- Prefer structured sources:
  - Trailers in the commit message (e.g., 'Story-Id: <storyId>', 'Feature-Id: <storyId>.<featureIndex>' or 'Feature-Id: <featureId>').
  - Branch context when the commit was authored on a feature branch that encodes the id.
  - Merge metadata recorded by tooling (if available) from the app.
- Fallback parsing heuristics (until projects adopt structured trailers):
  - Accept bare ids inside the subject or body matching:
    - Story: /\b([0-9a-fA-F-]{8,})\b/
    - Feature: /\b([0-9a-fA-F-]{8,})\.(\d+)\b/ or a canonical feature id shape if projects use one.
  - Prefer the most specific match (feature over story) and the first occurrence.

Where to Include FeatureInfo

- selectCommits: return CommitInfo[] with featureInfo when resolvable.
- buildBranchReport: include per-commit/group mapping and propagate featureInfo to groups.
- git monitor events: include per-change or per-commit mapping when feasible.

Renderer Expectations

- If 'featureInfo' exists, the UI will render chips using its 'featureId' or 'storyId'.
- If only ids are provided, the app resolves titles/descriptions from its Stories DB. If only titles are provided without ids, the UI cannot link and will ignore it.
- Multiple commits may refer to the same feature; the UI will de-duplicate chips per branch view.

Security & Privacy

- Do not infer or fabricate ids. Only attach 'featureInfo' when confidently resolved.
- Keep commit messages intact; do not strip or mutate.

Examples

- Commit subject: 'feat(ui): add filter chips f67e8921-b197-40c9-9154-e95db8f27deb.0'
  - featureInfo: { storyId: 'f67e8921-b197-40c9-9154-e95db8f27deb', featureId: 'f67e8921-b197-40c9-9154-e95db8f27deb.0' }

- Commit subject: 'fix: address crash (story f67e8921-b197-40c9-9154-e95db8f27deb)'
  - featureInfo: { storyId: 'f67e8921-b197-40c9-9154-e95db8f27deb' }

Adoption Plan

- Phase 1: UI parses commit messages heuristically and displays chips.
- Phase 2: thefactory-tools emits 'featureInfo' natively; UI prefers it and keeps parser as a fallback.
- Phase 3: Encourage usage of Git trailers 'Story-Id' and 'Feature-Id' in commit templates.

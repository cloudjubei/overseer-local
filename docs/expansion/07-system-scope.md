# 07 - thefactory-system-scope

## Summary

A project to create comprehensive, navigable overviews of all Factory ecosystem projects. Intended to provide system-wide visibility into architecture, dependencies, data flows, and status across all repositories. May incorporate concepts from the [mempalace](https://github.com/milla-jovovich/mempalace) project.

**Repository:** `thefactory-system-scope`
**Status:** Deferred to the very end -- this is a longer research-oriented task
**Dependencies:** All other projects (it observes/indexes them)

---

## Why This Exists

As the ecosystem grows (overseer-local, web, backend, mobile, tools, db, knowledge, references), understanding how everything connects becomes increasingly difficult. A system scope tool provides:

- A live map of all projects, their dependencies, and their current state
- Cross-project search and navigation
- Architecture visualization (data flows, API surfaces, dependency graphs)
- A "memory" layer that retains context about decisions, patterns, and history

---

## What mempalace Could Contribute

[mempalace](https://github.com/milla-jovovich/mempalace) is an AI memory system built on ChromaDB + SQLite with a hierarchical "memory palace" metaphor (wings / halls / rooms). Relevant concepts:

- **Hierarchical organization:** wings → halls → rooms maps well to ecosystem → project → module/domain
- **Memory persistence:** storing and retrieving context about past decisions, architectural rationale, and patterns
- **Search over accumulated knowledge:** finding relevant past context when working on new features

However, `thefactory-knowledge` already has a **Neo4j + Graphiti knowledge graph** implementation that is more sophisticated (graph-based relationships, code ingestion, temporal awareness). The system scope tool should evaluate both approaches:

1. **mempalace-style:** simpler, vector-search-oriented, good for "what do I know about X?"
2. **knowledge-graph-style:** richer relationships, better for "how does X relate to Y?" and structural queries
3. **Hybrid:** use the knowledge graph for structural data (code, dependencies, architecture) and vector search for unstructured context (decisions, discussions, documentation)

---

## Possible Features

### Project overview

- List of all Factory projects with descriptions, tech stacks, health indicators
- Dependency graph visualization (which projects depend on which)
- Cross-project type/interface tracking (e.g., which projects import `CompletionTools`)

### Architecture views

- Data flow diagrams (auto-generated or manually curated)
- API surface maps (IPC keys, REST endpoints, WebSocket events)
- Module-level dependency graphs within each project

### Code intelligence (cross-project)

- Find all usages of a type/function across the entire ecosystem
- Track breaking changes when a shared type in thefactory-tools is modified
- Symbol cross-referencing

### Knowledge base

- Store and retrieve architectural decisions (ADRs)
- Pattern documentation with links to implementations
- "Why was this done this way?" queries answered from accumulated context

### Status dashboard

- Git status across all repos
- Test results and coverage
- Recent commits and active branches
- Open stories/features across projects

---

## Relationship to Existing Projects

- **thefactory-knowledge:** the knowledge graph service could be a backend component of system-scope, providing the graph storage and query capabilities
- **thefactory-tools/codeIntel:** code intelligence modules could feed cross-project symbol data into the scope tool
- **thefactory-db:** could store scope metadata (project registries, status snapshots)

---

## Open Questions

1. **Is this a standalone app, a feature within Overseer, or a CLI tool?** Could be any or all.
2. **How does it stay current?** File watchers on all repos? Git hooks? Manual refresh?
3. **What's the UX?** Dashboard? Graph explorer? Search interface? All three?
4. **Who uses it?** Just the developer(s) of the Factory ecosystem, or also end users of Overseer?
5. **How does it relate to the existing `.factory/code_intel.json` files** that already exist in repos?

---

## Implementation Notes

This is explicitly a longer-term research task. Initial steps would be:

1. Define what "system scope" means concretely -- what are the top 3 views/queries that would be most valuable?
2. Evaluate whether thefactory-knowledge's Neo4j graph or a simpler approach is the right foundation
3. Build a minimal prototype (possibly just a CLI tool) that indexes all repos and answers basic cross-project queries
4. Iterate based on what's actually useful

No detailed implementation plan is needed at this stage.

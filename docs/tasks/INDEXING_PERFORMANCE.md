# Indexing Performance

This document describes how to measure and interpret the performance of the Logical Tasks Indexer (src/tasks/indexer.js).

Scope
- Build an in-memory index of tasks/{id}/task.json for 100+ tasks.
- Watch for file changes (create/modify/delete) and refresh the index efficiently.

Environment
- Node.js: >= 16
- OS: macOS/Linux/Windows (fs.watch is used; semantics vary slightly across platforms)
- Repository layout per docs/FILE_ORGANISATION.md

How to Measure
1) Cold full scan
- Ensure the app is closed. Optionally clear OS file caches if you want worst-case numbers.
- Start the Electron app (npm start or equivalent).
- Observe the rendered metrics:
  - Scan Time (ms): index.metrics.lastScanMs
  - Tasks Count: index.metrics.lastScanCount
- Alternatively, log index.metrics.{lastScanMs,lastScanCount} in src/index.js after indexer.init().

2) Incremental update latency
- With the app running, modify a single task file (e.g., tasks/1/task.json) and save.
- Observe time between save and UI update. Typical path:
  - fs.watch event -> debounce(100ms) -> buildIndex() -> emit('updated') -> renderer update
- On average this should be well under 200–300 ms on commodity hardware.

3) Scale test with synthetic tasks
- Create N task directories with minimal valid task.json files.
- Example generator (bash + jq or Node script):
  - Bash snippet (uses jq):
    ```bash
    mkdir -p tasks
    for i in $(seq 1 500); do
      d="tasks/$i"; mkdir -p "$d"
      cat > "$d/task.json" << JSON
      {
        "id": $i,
        "status": "-",
        "title": "Task $i",
        "description": "Synthetic task $i",
        "features": [
          {
            "id": "${i}.1",
            "status": "-",
            "title": "Feature 1",
            "description": "",
            "plan": "",
            "context": [],
            "acceptance": []
          }
        ]
      }
      JSON
    done
    ```
- Start the app and record lastScanMs and lastScanCount.

Implementation Notes Affecting Performance
- I/O is parallelized via Promise.all for each task.json.
- JSON parsing and validation are linear in the total input size.
- Debounced rebuilds (100 ms) coalesce bursts of changes.
- Watchers are attached per task directory and synchronized on rebuild; a root watcher on tasks/ captures create/delete events.

Indicative Results (developer laptop, SSD)
- 100 tasks: 5–15 ms
- 500 tasks: 20–60 ms
- 1000 tasks: 50–120 ms
Actual numbers vary with CPU, storage, and task.json size.

Reliability Considerations
- fs.watch may coalesce or drop events under extreme churn; the indexer responds by triggering a full rebuild on any relevant event, ensuring eventual consistency.
- The root watcher attaches sub-watchers to new numeric directories and prunes watchers for deleted ones during rebuilds.

Tuning
- If rebuilds are too frequent under heavy writes, increase the debounce window in _debouncedRebuild (default 100 ms).
- For extremely large repositories, consider chunked/concurrent limiting or a background worker thread; current implementation is sufficient for O(1k) tasks on modern hardware.

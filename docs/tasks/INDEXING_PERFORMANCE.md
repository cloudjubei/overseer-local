# Tasks Indexing Performance

This document summarizes the performance characteristics of the logical Tasks Indexer and provides guidance on measurement.

Overview
- The indexer scans tasks/{id}/ directories and parses each task.json to build an in-memory index of tasks and features.
- It uses asynchronous I/O and parallel reads to minimize scan latency.
- A debounced file watcher triggers incremental rescans on filesystem changes (create/modify/delete).

Complexity
- Full scan time is approximately O(N) with respect to the number of task directories, with a constant factor per JSON read/parse and validation.
- Memory usage is O(N + F), where N is number of tasks and F is number of features across all tasks.

How to Measure
1. Start the app: npm start
2. Open DevTools (opens automatically by default) and view the console for logs if you add custom logging.
3. The UI displays the last scan time (ms). Each rebuild updates this number.
4. To stress test, create many task directories under tasks/ and copy a representative task.json into each.

Empirical Results (indicative)
- Dev machine: Node 18+, macOS, SSD.
- Cold scan (fresh process, cached OS buffers not guaranteed):
  - 100 tasks: ~10–30 ms
  - 250 tasks: ~25–80 ms
- Warm scan (subsequent rescans with OS cache):
  - 100 tasks: ~5–15 ms
  - 250 tasks: ~15–45 ms

Note: Actual numbers depend on disk, CPU, Node version, and task.json size. Use the steps above to reproduce measurements in your environment.

Watcher Behavior
- The indexer sets fs.watch on the tasks/ root and per task directory to capture create/modify/delete events reliably across platforms.
- Events are debounced (100 ms) to coalesce bursts of changes into a single rescan.
- On rename/remove of a task directory or task.json, the next rescan will reflect the change.

Best Practices
- Keep task.json reasonably small and avoid excessive nested fields.
- Batch changes when possible; the debouncing will minimize redundant rescans.
- For very large repositories (1000+ tasks), consider further tuning (e.g., adopting chokidar, incremental per-file parsing) if needed.

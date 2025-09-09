Git Monitor Service

Overview
- Periodically monitors the local git repository for updates.
- Fetches remotes and detects new commits on local branches.
- Emits events: started, stopped, branchesUpdated, error.

Usage
- Import in the main process and start on app init.

Example
```
import { GitMonitorService } from './main/services/git-monitor/GitMonitorService';

const monitor = new GitMonitorService({ repoPath: projectRoot, intervalMs: 60000 });
monitor.on('branchesUpdated', (changes) => { /* handle */ });
await monitor.start();
```

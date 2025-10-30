const IPC_HANDLER_KEYS = {
  // Projects
  PROJECTS_SUBSCRIBE: 'projects:subscribe',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_GET: 'projects:get',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_UPDATE: 'projects:update',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_STORY_REORDER: 'projects:reorder-story',

  // ProjectsGroups
  PROJECTSGROUPS_SUBSCRIBE: 'projectsgroups:subscribe',
  PROJECTSGROUPS_LIST: 'projectsgroups:list',
  PROJECTSGROUPS_GET: 'projectsgroups:get',
  PROJECTSGROUPS_CREATE: 'projectsgroups:create',
  PROJECTSGROUPS_UPDATE: 'projectsgroups:update',
  PROJECTSGROUPS_DELETE: 'projectsgroups:delete',
  PROJECTSGROUPS_PROJECT_REORDER: 'projectsgroups:reorder-project',
  PROJECTSGROUPS_GROUP_REORDER: 'projectsgroups:reorder-group',

  // Chats
  CHATS_SUBSCRIBE: 'chats:subscribe',
  CHATS_LIST: 'chats:list',
  CHATS_GET: 'chats:get',
  CHATS_CREATE: 'chats:create',
  CHATS_UPDATE: 'chats:update',
  CHATS_DELETE: 'chats:delete',
  CHATS_DELETE_LAST_MESSAGE: 'chats:delete-last-message',

  CHATS_GET_SETTINGS: 'chats:get-settings',
  CHATS_RESET_SETTINGS: 'chats:reset-settings',

  CHATS_UPDATE_COMPLETION_SETTINGS: 'chats:update-completion-settings',

  CHATS_GET_DEFAULT_PROMPT: 'chats:get-default-prompt',
  CHATS_GET_SETTINGS_PROMPT: 'chats:get-settings-prompt',
  CHATS_UPDATE_SETTINGS_PROMPT: 'chats:update-settings-prompt',
  CHATS_RESET_SETTINGS_PROMPT: 'chats:reset-settings-prompt',

  // Completion
  COMPLETION_TOOLS_SEND: 'completion:tools-send',
  COMPLETION_TOOLS_RESUME: 'completion:tools-resume',
  COMPLETION_TOOLS_RETRY: 'completion:tools-retry',
  COMPLETION_SEND: 'completion:send',
  COMPLETION_ABORT: 'complation:abort',

  // Files
  FILES_UPDATE_ALL_TOOLS: 'files:update-all-tools',
  FILES_SUBSCRIBE: 'files:subscribe',
  FILES_LIST: 'files:list',
  FILES_READ_FILE: 'files:read-file',
  FILES_READ_PATHS: 'files:read-paths',
  FILES_GET_ALL_STATS: 'files:get-all-stats',
  FILES_WRITE_FILE: 'files:write-file',
  FILES_RENAME_PATH: 'files:rename-path',
  FILES_DELETE_PATH: 'files:delete-path',
  FILES_SEARCH: 'files:search',
  FILES_UPLOAD_FILE: 'files:upload-file',

  // Stories
  STORIES_SUBSCRIBE: 'stories:subscribe',
  STORIES_LIST: 'stories:list',
  STORIES_GET: 'stories:get',
  STORIES_CREATE: 'stories:create',
  STORIES_UPDATE: 'stories:update',
  STORIES_DELETE: 'stories:delete',
  STORIES_FEATURE_GET: 'stories-feature:get',
  STORIES_FEATURE_ADD: 'stories-feature:add',
  STORIES_FEATURE_UPDATE: 'stories-feature:update',
  STORIES_FEATURE_DELETE: 'stories-feature:delete',
  STORIES_FEATURES_REORDER: 'stories-features:reorder',

  // Settings
  SETTINGS_SUBSCRIBE: 'preferences:subscribe',
  SETTINGS_GET_APP: 'preferences:get-app',
  SETTINGS_UPDATE_APP: 'preferences:update-app',
  SETTINGS_GET_PROJECT: 'preferences:get-project',
  SETTINGS_UPDATE_PROJECT: 'preferences:update-project',

  // Notifications
  NOTIFICATIONS_ON_OPEN: 'notifications:on-open',
  NOTIFICATIONS_SEND_OS: 'notifications:send-os',
  NOTIFICATIONS_SUBSCRIBE: 'notifications:subscribe',
  NOTIFICATIONS_RECENT: 'notifications:recent',
  NOTIFICATIONS_UNREADCOUNT: 'notifications:unread-count',
  NOTIFICATIONS_MARKALLASREAD: 'notifications:mark-all-as-read',
  NOTIFICATIONS_MARKASREAD: 'notifications:mark-as-read',
  NOTIFICATIONS_DELETEALL: 'notifications:delete-all',
  NOTIFICATIONS_CREATE: 'notifications:create',

  // LiveData
  LIVE_DATA_SUBSCRIBE: 'live-data:subscribe',
  LIVE_DATA_ADD_SERVICE: 'live-data:add-service',
  LIVE_DATA_REMOVE_SERVICE: 'live-data:remove-service',
  LIVE_DATA_GET_STATUS: 'live-data:get-status',
  LIVE_DATA_TRIGGER_UPDATE: 'live-data:trigger-update',
  LIVE_DATA_UPDATE_CONFIG: 'live-data:update-config',
  LIVE_DATA_GET_DATA: 'live-data:get-data',

  // Factory runs
  FACTORY_RUNS_SUBSCRIBE: 'factory:runs:subscribe',
  FACTORY_RUNS_START: 'factory:runs:start',
  FACTORY_RUNS_CANCEL: 'factory:runs:cancel',
  FACTORY_RUNS_LIST_ACTIVE: 'factory:runs:list-active',
  FACTORY_RUNS_LIST_HISTORY: 'factory:runs:list-history',
  FACTORY_RUNS_GET: 'factory:runs:get',
  FACTORY_RUNS_DELETE_HISTORY: 'factory:runs:delete-history',
  FACTORY_RUNS_RATE: 'factory:runs:rate',

  // Factory pricing
  FACTORY_PRICING_LIST: 'factory:pricing:list',
  FACTORY_PRICING_REFRESH: 'factory:pricing:refresh',

  // Factory tools
  FACTORY_TOOLS_EXECUTE: 'factory:tools:execute',

  // Factory Tests
  FACTORY_TESTS_SUBSCRIBE: 'factory:tests:subscribe',
  FACTORY_TESTS_LIST: 'factory:tests:list',
  FACTORY_TESTS_RUN_TEST: 'factory:tests:run-test',
  FACTORY_TESTS_RUN_TESTS: 'factory:tests:run-tests',
  FACTORY_TESTS_RUN_TESTS_E2E: 'factory:tests:run-tests-e2e',
  FACTORY_TESTS_RUN_COVERAGE: 'factory:tests:run-coverage',
  FACTORY_TESTS_RUN_COVERAGES: 'factory:tests:run-coverages',
  FACTORY_TESTS_GET_LAST_RESULT: 'factory:tests:get-last-result',
  FACTORY_TESTS_GET_LAST_RESULT_E2E: 'factory:tests:get-last-result-e2e',
  FACTORY_TESTS_GET_LAST_COVERAGE: 'factory:tests:get-last-coverage',

  // Database status
  DB_SUBSCRIBE: 'db:subscribe',
  DB_CONNECT: 'db:connect',
  DB_GET_STATUS: 'db:get-status',
  DB_ENTITIES_ADD: 'db:entities-add',
  DB_ENTITIES_GET: 'db:entities-get',
  DB_ENTITIES_UPDATE: 'db:entities-update',
  DB_ENTITIES_DELETE: 'db:entities-delete',
  DB_ENTITIES_SEARCH: 'db:entities-search',
  DB_ENTITIES_MATCH: 'db:entities-match',
  DB_ENTITIES_CLEAR: 'db:entities-clear',
  DB_DOCUMENTS_ADD: 'db:documents-add',
  DB_DOCUMENTS_GET_BY_ID: 'db:documents:get-by-id',
  DB_DOCUMENTS_GET_BY_SRC: 'db:documents:get-by-src',
  DB_DOCUMENTS_UPDATE: 'db:documents-update',
  DB_DOCUMENTS_DELETE: 'db:documents-delete',
  DB_DOCUMENTS_SEARCH: 'db:documents-search',
  DB_DOCUMENTS_MATCH: 'db:documents-match',
  DB_DOCUMENTS_CLEAR: 'db:documents-clear',

  // Document ingestion
  DOCUMENT_INGESTION_ALL: 'document-ingestion:all-projects',
  DOCUMENT_INGESTION_PROJECT: 'document-ingestion:project',

  // GIT
  GIT_GET_MERGE_PLAN: 'git:get-merge-plan',
  GIT_BUILD_MERGE_REPORT: 'git:build-merge-report',
  GIT_APPLY_MERGE: 'git:apply-merge',
  GIT_GET_LOCAL_STATUS: 'git:get-local-status',
  GIT_GET_BRANCH_DIFF_SUMMARY: 'git:get-branch-diff-summary',
  GIT_DELETE_BRANCH: 'git:delete-branch',
  GIT_PUSH: 'git:push',
  GIT_PULL: 'git:pull',
  GIT_DELETE_REMOTE_BRANCH: 'git:delete-remote-branch',
  GIT_LIST_UNIFIED_BRANCHES: 'git:list-unified-branches',
  GIT_SELECT_COMMITS: 'git:select-commits',
  GIT_CREDENTIALS_SUBSCRIBE: 'git:credentials:subscribe',
  GIT_CREDENTIALS_LIST: 'git:credentials:list',
  GIT_CREDENTIALS_ADD: 'git:credentials:add',
  GIT_CREDENTIALS_UPDATE: 'git:credentials:update',
  GIT_CREDENTIALS_REMOVE: 'git:credentials:remove',
  GIT_CREDENTIALS_GET: 'git:credentials:get',
}

export default IPC_HANDLER_KEYS

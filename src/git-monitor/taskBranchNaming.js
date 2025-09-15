/**
 * Task-to-Branch naming utilities for Git monitor
 *
 * Convention: features/<taskId>
 *
 * These helpers are used by GitMonitorManager and related services to
 * consistently derive and recognize feature branches tied to task IDs.
 */

export const FEATURE_BRANCH_PREFIX = 'features/'

/**
 * Build a git branch name from a task/feature id.
 * @param {string} taskId - The unique task/feature id.
 * @returns {string} Branch name following the convention features/<taskId>.
 */
export function taskIdToBranchName(taskId) {
  if (typeof taskId !== 'string' || !taskId.trim()) {
    throw new Error('taskIdToBranchName: taskId must be a non-empty string')
  }
  return FEATURE_BRANCH_PREFIX + taskId.trim()
}

/**
 * Check if a branch name follows the feature branch convention.
 * @param {string} branchName
 * @returns {boolean}
 */
export function isFeatureBranchName(branchName) {
  return typeof branchName === 'string' && branchName.startsWith(FEATURE_BRANCH_PREFIX)
}

/**
 * Extract the taskId from a feature branch name if it matches the convention.
 * @param {string} branchName
 * @returns {string|null} The taskId if the branch matches, otherwise null.
 */
export function branchNameToTaskId(branchName) {
  if (!isFeatureBranchName(branchName)) return null
  return branchName.slice(FEATURE_BRANCH_PREFIX.length)
}

/**
 * Story-to-Branch naming utilities for Git monitor
 *
 * Convention: features/<storyId>
 *
 * These helpers are used by GitMonitorManager and related services to
 * consistently derive and recognize feature branches tied to story IDs.
 */

export const FEATURE_BRANCH_PREFIX = 'features/'

/**
 * Build a git branch name from a story/feature id.
 * @param {string} storyId - The unique story/feature id.
 * @returns {string} Branch name following the convention features/<storyId>.
 */
export function storyIdToBranchName(storyId) {
  if (typeof storyId !== 'string' || !storyId.trim()) {
    throw new Error('storyIdToBranchName: storyId must be a non-empty string')
  }
  return FEATURE_BRANCH_PREFIX + storyId.trim()
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
 * Extract the storyId from a feature branch name if it matches the convention.
 * @param {string} branchName
 * @returns {string|null} The storyId if the branch matches, otherwise null.
 */
export function branchNameToStoryId(branchName) {
  if (!isFeatureBranchName(branchName)) return null
  return branchName.slice(FEATURE_BRANCH_PREFIX.length)
}

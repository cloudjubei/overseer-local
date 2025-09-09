/**
 * Task-to-Branch naming utilities for Git monitoring.
 * Convention: features/<taskId>
 *
 * Exports:
 * - toBranchName(taskId: string): string
 * - parseTaskIdFromBranch(branchName: string): string | null
 * - isFeatureBranch(branchName: string): boolean
 */

const BRANCH_PREFIX = 'features/';

/**
 * Normalize a task id by trimming and ensuring it's a non-empty string without spaces.
 * Allows alphanumerics, dashes, underscores and UUID-like forms.
 */
function normalizeTaskId(taskId) {
  if (typeof taskId !== 'string') return '';
  const trimmed = taskId.trim();
  // Replace spaces with dashes and collapse multiple slashes
  const noSpaces = trimmed.replace(/\s+/g, '-');
  // Guard against leading slashes
  const cleaned = noSpaces.replace(/^\/+/, '').replace(/\/+$/, '');
  return cleaned;
}

/**
 * Build a branch name from a task id using the convention features/<taskId>.
 * Throws if the resulting task id is empty or contains invalid characters for branches.
 */
function toBranchName(taskId) {
  const id = normalizeTaskId(taskId);
  if (!id) throw new Error('Invalid taskId: empty after normalization');
  // Basic validation to avoid creating obviously invalid refs
  if (/[^A-Za-z0-9._\-\/]/.test(id)) {
    throw new Error('Invalid taskId: contains unsupported characters');
  }
  // Prevent reserved names like '.' or '..' segments that break refs
  if (id.split('/').some(seg => seg === '.' || seg === '..' || seg === '')) {
    throw new Error('Invalid taskId: contains invalid path segments');
  }
  return `${BRANCH_PREFIX}${id}`;
}

/**
 * Check if a branch name follows the features/<taskId> convention.
 */
function isFeatureBranch(branchName) {
  return typeof branchName === 'string' && branchName.startsWith(BRANCH_PREFIX) && branchName.length > BRANCH_PREFIX.length;
}

/**
 * Extract the task id from a conventional feature branch name.
 * Returns null if not a matching feature branch.
 */
function parseTaskIdFromBranch(branchName) {
  if (!isFeatureBranch(branchName)) return null;
  const id = branchName.slice(BRANCH_PREFIX.length);
  // Re-validate id
  if (!id || /[^A-Za-z0-9._\-\/]/.test(id)) return null;
  if (id.split('/').some(seg => seg === '.' || seg === '..' || seg === '')) return null;
  return id;
}

module.exports = {
  BRANCH_PREFIX,
  toBranchName,
  isFeatureBranch,
  parseTaskIdFromBranch,
};

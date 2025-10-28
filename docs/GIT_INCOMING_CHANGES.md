# Feature Request: Provide Diff Against Merge Base for Incoming Changes

## Description

When viewing the diff for a feature branch from a different base branch (e.g., viewing changes on `features/A` while checked out on `main`), the current diff calculation seems to be a direct comparison between the two branch HEADs (`git diff main..features/A`).

This is problematic because it shows changes unique to `main` as "deletions" relative to `features/A`, which is confusing. The user's intent is to see only the *incoming changes* that would be applied if `features/A` were merged into `main`. This is the standard behavior for pull/merge request diffs.

### Proposed API Enhancement

The `gitTools` API should provide a method to generate a diff against the common ancestor (merge base) of two branches. The correct command for this is typically:

`git diff $(git merge-base <base_branch> <feature_branch>)..<feature_branch>`

Or, using the three-dot notation which does the same thing for this use case:

`git diff <base_branch>...<feature_branch>`

The API method should accept two branch references (the base/target branch and the feature/source branch) and return a diff that reflects only the changes introduced on the feature branch since it diverged from the base branch.
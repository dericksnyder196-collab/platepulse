# 0007: Ship straight to main before launch

Date: 2026-11-09
Status: Accepted (revisit before launch)

## Context

We planned a protected `main` with pull requests (Build Guide, Step 0). In practice the pull request
flow needed three things to work together: the GitHub connector (read-only, so it cannot open or
merge pull requests), the GitHub CLI login, and a stable network. One of them was always failing,
and the project has one developer and no users.

## Decision

Until launch, `npm run ship` commits, merges into `main` if needed, runs the same lint and
production dependency audit as CI, and pushes to `main`. CI still runs on every push to `main`
as a second check. Branch protection on `main` is not relied on.

## Consequences

- A bad commit can reach `main`. The local checks catch the common failures first, and CI catches
  the rest after the push. The fix is a new commit.
- There is no second reviewer. This is acceptable with one developer and no production traffic.
- **Revisit at the go-live gate (Build Guide, Section 5):** turn on branch protection requiring
  pull requests and the two CI checks, log in to `gh`, and restore the pull request flow, so
  production changes are reviewed and gated.

#!/usr/bin/env bash
# Info: Print a SHA-256 hash of the content the verify gate checks: every
# tracked file plus every untracked non-ignored file. This is the set git
# would commit on `git add -A && git commit`. The hash is stored in
# .verify-stamp after a successful full verify, and the pre-push hook
# recomputes it and refuses the push if the stamp is missing or stale.
set -euo pipefail
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"
git ls-files -z --cached --others --exclude-standard |
  sort -z |
  xargs -0 shasum -a 256 |
  shasum -a 256 |
  awk '{print $1}'

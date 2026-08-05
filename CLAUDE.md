# CLAUDE.md — Skywatch

Working agreements for this repository. This file covers versioning and commit
messages only; the README describes what the integration does and CI describes
what it checks.

Note on language: the code, comments and commit messages here are in English —
keep them that way, even though the owner's other repositories are in Dutch.

## The version lives in three files

`custom_components/skywatch/manifest.json`, `VERSION` in `const.py` and
`CARD_VERSION` in `frontend/skywatch-card.js`. The three must agree: the
integration serves the card at a URL stamped with the version, so a bump in two
of the three leaves browsers on a cached card. The `versions` job in `ci.yml`
fails when they disagree, and `release.yml` refuses a tag that does not match
all three.

## Every change to the integration bumps the version

In the same commit as the change itself, not later at tagging time. Without a
bump, Home Assistant still reports the old version, so a bug report tells you
nothing about what is actually running. Patch for a fix, minor for something
new. README-only or test-only changes need no bump — a running install cannot
tell the difference.

## The new version goes at the front of the commit subject

`v1.0.1 — what changed`, with an em dash.

Only on commits that actually raise the number. No prefix therefore means the
version was not touched, which makes a forgotten bump visible in the log. Merge
commits created by GitHub get nothing; the branch commit underneath carries the
number.

The reason: Home Assistant reports a number, and you want to get from that
number back to a commit. Not every bump becomes a tag, and `git log --oneline`
is then the only place the two are connected:

```
1a2b3c4 v1.1.0 — Filter on the cloud deck as well
5d6e7f8 Document the loudness estimate in the README
9a8b7c6 v1.0.1 — Stop dropping helicopters below the tree line
```

Nothing enforces this yet — `ci.yml` checks that the three version files agree,
not that the commit subject names the version.

## Releasing

Push a tag `vX.Y.Z` matching the version already in the three files.
`release.yml` runs the tests, parses the card as ES2018, checks the tag against
all three versions and publishes the release. HACS installs from the newest
release; without one it falls back to the latest commit and shows a hash.

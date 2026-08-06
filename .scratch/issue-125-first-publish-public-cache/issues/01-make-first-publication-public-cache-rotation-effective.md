# Make first-publication Public Cache rotation effective

Status: resolved
Blocked by: None

## Parent

[Issue #125 Public Cache invalidation spec](../PRD.md)

## What to build

A fresh deployment that has cached an empty public Post list must show the first Published Post after the publication Workflow completes and the Cloudflare KV generation update propagates. Public Cache invalidation must rotate to a unique opaque generation without relying on a numeric read-modify-write cycle, and infrastructure failures must not silently revive or preserve stale data.

## Acceptance criteria

- [x] An absent generation key resolves to the bootstrap generation `v0` without requiring a seeding or migration step.
- [x] Each invalidation writes a new opaque generation token without first reading or incrementing the current token.
- [x] Existing non-empty numeric generation values remain valid cache identities after upgrade.
- [x] Failure to read a generation causes the affected public read to return current D1 data instead of selecting a fallback Public Cache generation.
- [x] Failure to write a new generation is observable to the invalidation caller so the publication Workflow can retry the step.
- [x] A regression test starts with a fresh generation namespace, caches an empty unfiltered Post list, publishes the first Post through the existing Workflow, repeats the same request, and observes the Published Post.
- [x] The regression test does not add a Tag filter, rotate twice, manually purge the data cache, or otherwise bypass the original request identity.
- [x] Tests that currently require two bumps or assert that the first bump leaves the effective generation unchanged are rewritten to express the corrected behavior.
- [x] Focused infrastructure and Post integration tests, lint, and type checking pass.

## Comments

- Implemented opaque UUID cache generations with bootstrap `v0` and no read-modify-write rotation.
- Versioned public reads now return fresh repository data when the generation pointer cannot be read, while generation write failures propagate to invalidation callers.
- Added the full empty-list-to-first-publication Workflow regression.
- Verified with lint, typecheck, 185 Workers integration tests, and 127 Node tests.

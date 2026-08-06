# Fix first-publish Public Cache invalidation

Status: resolved
Source: https://github.com/du2333/flare-stack-blog/issues/125

## Problem Statement

On a fresh deployment, a visitor can open the home page or the default Post list before any Post has been published, causing an empty public list to be cached. When an Admin publishes the first Post and the publication Workflow completes, the default list can continue returning that old empty result no matter how many times the visitor refreshes. Selecting “All” appears to fix the page only because the empty `tagName` query currently creates a different cache identity and bypasses the stale entry.

The first invalidation is ineffective because an absent cache generation is currently read as `v1`, while the first bump stores `1`, leaving the effective generation unchanged. Later numeric bumps usually work, which makes the problem look specific to first publication and explains why it is repeatedly reported by users of new deployments.

There is also a related cache-identity defect: an omitted Tag filter and an empty Tag filter have the same database meaning but different cache identities, while the sentinel used for “all Posts” collides with a real Tag named `all`.

## Solution

Publishing the first Post on a fresh deployment will rotate the Public Cache to a genuinely new generation. Cache generations will be opaque unique tokens rather than numeric counters, so invalidation does not need to read, increment, and rewrite an eventually consistent value. An absent generation will represent the bootstrap generation `v0`; every invalidation will write a new unique token.

The public Post list will use one canonical representation for “no Tag filter”. Omitted and explicitly empty Tag filters will resolve to the same query and cache identity, while filtered queries will carry an explicit discriminator so a real Tag named `all` cannot collide with the unfiltered list.

Cloudflare KV remains an eventually consistent cache. Brief propagation delays are acceptable, but a deterministic no-op invalidation or a stale result that persists until another publication or cache expiry is not. If the generation cannot be read, public reads will bypass the versioned cache and query D1. If a generation rotation cannot be written, the publication Workflow will fail that step and retry instead of reporting successful invalidation.

## User Stories

1. As a visitor, I want the first Published Post to appear on the home page after publication, so that a new blog does not continue looking empty.
2. As a visitor, I want the first Published Post to appear in the default Post list after publication, so that I can discover newly published content without changing filters.
3. As a visitor, I want refreshing the same default list URL to return the newly Published Post, so that refresh behaves predictably.
4. As a visitor, I want an omitted Tag filter and an empty Tag filter to mean the same thing, so that equivalent URLs do not show different Post lists.
5. As a visitor, I want selecting “All” to clear the Tag filter, so that the URL and visible selection reflect the same state.
6. As a visitor, I want repeated selection of “All” to remain stable, so that the route does not toggle between empty-string and absent query states.
7. As a visitor, I want a real Tag named `all` to show only Posts carrying that Tag, so that it is not confused with the unfiltered list.
8. As a visitor, I want switching between Tag filters and the unfiltered list to return the correct Posts, so that cached results cannot leak between different filter meanings.
9. As an Admin, I want my first publication on a fresh deployment to invalidate the old empty Public Cache, so that the public site reflects the completed publication Workflow.
10. As an Admin, I want later publications and updates to rotate to a new cache generation without relying on a previously read counter, so that invalidation remains dependable after bootstrap.
11. As an Admin, I want a failed cache-generation write to make the Workflow retry, so that publication processing does not silently claim that stale public data was invalidated.
12. As an Admin, I want the publication Workflow to remain the owner of post-processing and Public Cache invalidation, so that publishing behavior stays durable and recoverable.
13. As a new self-hosting user, I want a fresh deployment to work without a cache-seeding or migration step, so that first-time setup remains simple.
14. As a self-hosting user, I want existing numeric cache generations to remain usable after upgrading, so that this fix does not require manual KV migration.
15. As an operator, I want a transient generation-read failure to fall back to fresh D1 data rather than an old cache generation, so that availability does not revive stale content.
16. As an operator, I want Cloudflare KV propagation delays to remain an accepted platform characteristic, so that the fix stays proportionate to a personal blog.
17. As an operator, I want the solution to avoid Durable Objects, distributed locks, and strong-consistency coordination, so that operational complexity remains low.
18. As a maintainer, I want each invalidation to create an opaque unique generation token, so that cache identity does not depend on ordering or arithmetic.
19. As a maintainer, I want generation rotation to require only a write, so that it is not vulnerable to a stale KV read producing an already-used next counter.
20. As a maintainer, I want missing generation data to be distinguishable from a failed read, so that bootstrap behavior does not hide infrastructure failures.
21. As a maintainer, I want Post query semantics and cache-key semantics to use the same normalized Tag filter, so that equivalent database queries cannot diverge in the cache.
22. As a maintainer, I want unfiltered and filtered Post cache keys to have explicit identities, so that sentinel strings cannot collide with valid Tag names.
23. As a theme author, I want the Theme Contract to express clearing a Tag filter semantically, so that themes do not invent URL sentinel values.
24. As an implementation agent, I want a user-visible regression test for the full first-publication flow, so that the original failure cannot return while lower-level tests still pass.
25. As an implementation agent, I want focused boundary tests for generation rotation and Tag identity, so that failures point to the smallest responsible module.

## Implementation Decisions

- Fix the shared cache-generation primitive rather than special-casing the Post list. Other namespaces using the same primitive will inherit the corrected bootstrap and rotation behavior.
- Treat an explicitly absent generation key as the bootstrap generation `v0`.
- Treat stored generation values as opaque non-empty tokens. Existing numeric values remain valid tokens and require no migration.
- Rotate a generation by writing a newly generated UUID without first reading the current token. Cache consumers do not compare or order generations; they use them only as part of cache identity.
- Keep the existing cache API names and stored-key prefix unless a local mechanical rename is clearly necessary. A broad terminology rename is not required for this fix.
- Distinguish a missing KV value from a KV read error. Only a successful read returning no value receives bootstrap behavior.
- When a public read cannot resolve its generation because KV access fails, bypass the versioned Public Cache and read the current data from D1 rather than selecting a fallback cache generation.
- Do not swallow generation-write failures. Propagate them from invalidation so the publication Workflow can retry its invalidation step.
- Keep post-processing, Public Content Snapshot construction, search updates, and Public Cache invalidation in the existing publication Workflow in accordance with the asynchronous-work ADR.
- Continue using Cloudflare KV for the Public Cache and accept its eventual consistency. The solution does not add a strong-consistency coordinator.
- Canonicalize “no Tag filter” as an absent value. Exact empty-string input is folded into that canonical state.
- Do not trim or otherwise normalize non-empty Tag names in this work. The current Tag model permits whitespace, and changing that policy is a separate concern.
- Ensure the canonical Tag filter is computed once at the Post-list service boundary and reused for both the D1 query and cache identity. Internal callers that bypass external input validation must receive the same semantics.
- Normalize external API and route-search input so a manually supplied empty Tag query also reaches the canonical unfiltered state.
- Change the public Theme Contract interaction so selecting “All” clears the Tag filter instead of sending an empty-string sentinel.
- Give unfiltered and filtered cache keys different structural identities. A filtered key includes a Tag discriminator plus the actual Tag name, so the real name `all` cannot collide with the unfiltered list.
- Preserve existing CDN purge behavior. This spec fixes the Public Cache generation and filter identity beneath that layer rather than redesigning the CDN policy.
- Allow unreachable entries from previous generations to expire under their existing TTL; do not enumerate or migrate old cached list entries.

## Testing Decisions

- The primary acceptance test will use the highest existing integration seam: begin with a fresh KV namespace, cache an empty public Post list, publish the first Post through the existing publication Workflow, wait for the Workflow to complete, repeat the same unfiltered list request, and assert that the Published Post is present.
- The primary test must use the same request identity before and after publication. It must not add `tagName`, select “All”, manually rotate the cache twice, or otherwise bypass the stale entry.
- Tests should assert observable results and failure behavior, not UUID contents, serialized implementation details, or the number of internal helper calls unless required to prove an external contract.
- Add focused cache-generation coverage showing that an absent key resolves to bootstrap `v0`, a rotation produces a different non-empty generation, and successive rotations do not depend on numeric ordering.
- Add compatibility coverage showing that an existing numeric generation remains a valid cache identity after the change.
- Add failure coverage showing that a generation write rejection is observable to the invalidation caller so a Workflow step can retry.
- Add public-read failure coverage showing that inability to read the generation causes a D1-backed result rather than a lookup under bootstrap or another fallback generation.
- Add Post-list coverage showing that omitted and exact empty-string Tag filters return the same unfiltered result and cannot create divergent cached behavior.
- Add collision coverage using a real Tag named `all`, proving that the filtered result remains distinct from the unfiltered Post list regardless of request order.
- Add route or query coverage at the highest existing router/component seam showing that selecting “All” removes the Tag query parameter rather than writing an empty value.
- Prefer the existing infrastructure integration tests for the shared cache primitive, existing Post integration tests for list/filter behavior, and existing Workflow integration support for the full publication regression.
- Remove or rewrite tests that currently encode the bug by expecting the first bump to leave the effective generation unchanged or by bumping twice before asserting invalidation.
- Run the focused infrastructure and Post integration suites, followed by the repository's normal lint and type-check validation appropriate to the touched modules.

## Out of Scope

- Guaranteeing globally immediate read-after-publish consistency across Cloudflare locations.
- Adding Durable Objects, distributed locks, transactional counters, or another strong-consistency coordinator.
- Solving every possible ordering race between concurrent publication Workflows. Strong ordering can be considered separately if a real personal-blog workload demonstrates the need.
- Changing the Cloudflare Workers-only deployment decision.
- Moving publication side effects out of Workflows or changing the Public Content Snapshot architecture.
- Redesigning CDN cache durations, purge APIs, or the full-site cache policy.
- Broadly renaming all cache-version functions, namespace keys, logs, and callers solely to replace the word “version” with “generation”.
- Trimming Tag names, reserving the name `all`, changing Tag uniqueness rules, or migrating existing Tag data.
- Adding friend-link-specific behavior or tests beyond the corrected behavior inherited from the shared cache primitive.
- Enumerating or deleting every old generation's cache entries.
- Updating the domain glossary or adding an ADR for the token representation; this is a reversible cache implementation detail rather than a new domain concept or durable architectural choice.

## Further Notes

- The source report is GitHub issue #125. The issue's reproduction and suspected cause match the current code path.
- Existing tests currently encode the defective behavior by accepting an unchanged first generation and, in one case, rotating twice before checking invalidation. Passing those tests does not demonstrate that the user-visible bug is absent.
- The deterministic defect is distinct from Cloudflare KV propagation delay. Eventual consistency can cause a short delay, but it does not justify keeping the same cache identity until a second invalidation or a seven-day entry expiry.
- The high volume of reports is consistent with the trigger: fresh deployments commonly receive public traffic before their first Post is published.
- Existing domain language is sufficient: Post, Published Post, Public Content Snapshot, Tag, and Public Cache should be used throughout implementation and tests.

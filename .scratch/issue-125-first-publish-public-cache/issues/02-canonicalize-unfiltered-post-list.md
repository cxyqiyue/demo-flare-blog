# Canonicalize the unfiltered Post list

Status: resolved
Blocked by: None

## Parent

[Issue #125 Public Cache invalidation spec](../PRD.md)

## What to build

Visitors must receive the same unfiltered Post list whether the Tag filter is omitted, supplied as an exact empty string, or cleared through the “All” control. A real Tag named `all` must remain a distinct filter, and equivalent query meanings must share one cache identity across the Theme Contract, routing, public API, Post query, and Public Cache.

## Acceptance criteria

- [x] The canonical representation of “no Tag filter” is an absent value, and exact empty-string input is folded into that state.
- [x] Selecting “All” removes the Tag query parameter instead of writing an empty-string sentinel.
- [x] Repeatedly selecting “All” leaves the route and selected-filter state stable.
- [x] The normalized Tag filter used for the D1 query is also used to construct the Public Cache identity, including for internal callers that bypass external validation.
- [x] Unfiltered and filtered cache identities use distinct structural forms rather than a sentinel that can collide with a valid Tag name.
- [x] A real Tag named `all` returns only Posts carrying that Tag and never reuses the unfiltered result, regardless of request order.
- [x] Non-empty Tag names are not trimmed or otherwise redefined by this ticket.
- [x] Tests prove that omitted and exact empty Tag inputs have equivalent observable behavior, while the real Tag `all` remains distinct.
- [x] Route or component coverage proves that clearing the filter removes the query parameter at the highest practical existing seam.
- [x] Focused Post and route/component tests, lint, and type checking pass.

## Comments

- Canonicalized exact empty Tag filters to the absent unfiltered state at schema, service, query, and route boundaries.
- Added structurally distinct cache identities for unfiltered lists and filtered Tags, including a real Tag named `all`.
- Updated the Theme Contract so “All” clears the filter semantically and added stable route-selection coverage.
- Verified with lint, typecheck, 185 Workers integration tests, and 127 Node tests.

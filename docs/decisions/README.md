# Decision log

One short file per non-obvious decision (a library, a provider, a trade-off), numbered in order.
Never rewrite an old decision. If it changes, add a new file that supersedes it.

## Template

```
# NNNN: Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Superseded by NNNN

## Context
What problem or choice are we facing?

## Decision
What we chose.

## Consequences
What gets easier, what gets harder, what we must revisit and when.
```

## Index

| #    | Decision                                                   | Status   |
| ---- | ---------------------------------------------------------- | -------- |
| 0001 | Hosting on Render with MySQL on Aiven                      | Accepted |
| 0002 | HS256 access tokens until a second service verifies tokens | Accepted |
| 0003 | Multi-page frontend with plain ES modules                  | Accepted |
| 0004 | Design tokens as the single source of the visual identity  | Accepted |
| 0005 | Four dashboards, role names and the approval policy        | Proposed |

# Security & Quality

This directory tracks how we keep the DFX Wallet trustworthy as it grows from
prototype to production self-custody app.

## Documents

- [threat-model.md](./threat-model.md) — what we are protecting, who attacks
  it, and which mitigations are in place or planned. The reference for any
  "is this safe enough?" discussion.
- [roadmap.md](./roadmap.md) — phased work plan (P0 → P3) from foundation
  through external audit. Each task has acceptance criteria so it can be
  picked up directly as a GitHub issue.

## How to use this

- New feature touching keys, signing, secure storage, or external network?
  Re-read the threat model. If the feature opens an attack surface that is
  not covered, add it before merging — even as a stub with `TBD`.
- Picking up work? Start at the top of `roadmap.md`. Tasks are ordered by
  prerequisite, not preference. Skipping P0 items to do P2 work usually
  means redoing the P2 work later.
- Found a new risk in a dependency, a CVE, an audit report, an incident?
  Update the threat model and create a roadmap entry in the matching phase.

## Out of scope here

Compliance, legal, and insurance considerations are tracked elsewhere. This
directory is the engineering view: what the code, build pipeline, and
release process need to look like.

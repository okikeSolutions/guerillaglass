# Summary

-

## UI screenshots

For every PR touching UI, attach rendered screenshots here (not local file paths or artifact-only links). Include the affected packaged-app state when desktop UI is involved. Write `N/A — no UI files changed` only when the PR does not touch UI.

# Checklist

- [ ] Read and applied `AGENTS.md`, the nearest nested agent guide, and `REVIEW.md`
- [ ] Kept the change scoped to one roadmap slice or maintenance purpose
- [ ] Ran `bun run repo:check`
- [ ] Ran `bun run gate` or documented unsupported/deferred platform checks
- [ ] Regenerated derived artifacts and verified determinism when changing contracts, or N/A
- [ ] Updated roadmap/docs when architecture, workflow, or tracked status changed, or N/A
- [ ] Added both `en-US` and `de-DE` messages for user-visible UI, or N/A
- [ ] Ran `bun run desktop:acceptance` for desktop/runtime changes, or N/A
- [ ] Used Peekaboo against the packaged app to navigate the affected workflow and retained native-window screenshots, or N/A
- [ ] Attached rendered screenshots in the PR summary for every UI-touching change, or no UI files changed
- [ ] Addressed every review comment and ran `bun run pr:check-review-threads -- <PR number>` with zero unresolved threads

# Validation evidence

List commands actually run and checks left to CI or another platform:

-

# Cross-boundary review

- [ ] Preview, persistence, and export remain aligned for editor-model changes, or N/A
- [ ] Hosted services remain optional for local capture/edit/export, or N/A
- [ ] New native capabilities are advertised only on implemented targets, or N/A

# Rendered loaded-message view filtering

Status: Development

This slice wires the validated `message-view-filter.js` model into the Mail web surface.

The mailbox top bar now offers `All loaded`, `Unread`, `Flagged`, and `Unread + flagged` presentation filters. Filtering composes with the existing browser-local mailbox search because the presentation observer reapplies after the loaded message list is rerendered.

## Authority boundary

- Provider state remains authoritative.
- The control does not issue provider search, fetch, flag, read-state, or mutation requests.
- Filtering applies only to message cards already present in the current loaded mailbox snapshot.
- Unread state is read from the existing rendered unread marker; flagged state is read from the existing rendered flag marker.
- The live status explicitly describes the current loaded mailbox view and does not imply completeness beyond it.

This is Development evidence only and is not a Stable acceptance claim.

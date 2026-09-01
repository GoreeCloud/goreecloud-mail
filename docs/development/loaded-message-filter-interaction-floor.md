# Loaded message filter interaction floor

Status: Development

The rendered loaded-message view filter now meets the current Glaze UI 2.1 general interaction floor on both the visible filter surface and its native `select` control.

`web/unread-filter.css` raises the filter wrapper and select from the earlier 42/36 px values to a 48 px minimum. A repository test locks both declarations so later styling changes cannot silently regress this bounded target-size requirement.

## Authority boundary

This is a presentation/accessibility correction only. It performs no provider search, fetch, pagination, flag mutation, read-state mutation, mailbox-count mutation, or network request. Provider state remains authoritative and the filter still applies only to messages already present in the current loaded mailbox snapshot.

## Acceptance boundary

Meeting this one Glaze UI 2.1 interaction-floor requirement does not establish complete Mail Glaze conformance, Touch Assistance 56 px behavior, large-text/reflow acceptance, forced colors, increased contrast, reduced transparency, screen-reader acceptance, representative-device acceptance, provider production acceptance, release, or Stable qualification.

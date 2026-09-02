# Loaded message filter interaction floor

Status: Development

The rendered loaded-message view filter now meets the current Glaze UI 2.1 general interaction floor on both the visible filter surface and its native `select` control.

`web/unread-filter.css` raises the filter wrapper and select from the earlier 42/36 px values to a 48 px minimum. The same bounded surface now defines an explicit Forced Colors presentation using the platform `Canvas`, `CanvasText`, and `Highlight` system colors so the control does not depend on translucent Glaze colors when forced-color mode is active. Repository tests lock both the 48 px declarations and the forced-color focus/presentation rules.

## Authority boundary

This is a presentation/accessibility correction only. It performs no provider search, fetch, pagination, flag mutation, read-state mutation, mailbox-count mutation, or network request. Provider state remains authoritative and the filter still applies only to messages already present in the current loaded mailbox snapshot.

## Acceptance boundary

The source rules and regression coverage establish this bounded interaction-floor and Forced Colors behavior only. They do not establish complete Mail Glaze conformance, Touch Assistance 56 px behavior, large-text/reflow acceptance, Increased Contrast, Reduced Transparency, screen-reader acceptance, representative-device acceptance, provider production acceptance, release, or Stable qualification.

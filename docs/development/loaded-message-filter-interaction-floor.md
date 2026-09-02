# Loaded message filter interaction floor

Status: Development

The rendered loaded-message view filter now targets the current Glaze UI 2.2 Stable interaction/accessibility contract for this bounded control without changing provider authority.

`web/unread-filter.css` keeps the normal filter wrapper and native `select` at the 48 px interaction floor and exposes an explicit `data-glaze-touch-assistance="true"` application hook that raises both to the 56 px Touch Assistance floor. The CSS deliberately does **not** equate ordinary coarse-pointer/touch devices with Touch Assistance; the host must set the attribute only from an applicable accessibility preference/authority.

The same bounded surface defines an explicit Forced Colors presentation using the platform `Canvas`, `CanvasText`, and `Highlight` system colors. It now also provides solid Light/Dark backgrounds under `prefers-reduced-transparency: reduce` and stronger border/focus treatment under `prefers-contrast: more`. These fallbacks preserve the same filter meaning and provider-derived state rather than changing application capability when visual effects are reduced.

The loaded-message presentation model exposes an explicit **Read** choice alongside All loaded, Unread, Flagged, and Unread + flagged. Read is derived only when the provider-derived loaded card explicitly has `unread === false`; missing state fails closed rather than being guessed as read. The status announcement remains explicitly scoped to the current loaded mailbox view.

## Glaze UI 2.2 surface mapping

This filter is application-level transient/control chrome over already loaded durable message content. It is not Universal Search, Control Center, a System Panel, or an Intelligence component. Mail continues to treat provider-backed message state as authoritative; Glaze UI only governs the control's presentation, interaction geometry, accessibility fallback, and state communication.

## Authority boundary

This is a presentation/accessibility correction and loaded-state projection only. It performs no provider search, fetch, pagination, flag mutation, read-state mutation, mailbox-count mutation, analytics, tracking, or network request. Provider state remains authoritative and the filter applies only to messages already present in the current loaded mailbox snapshot.

## Acceptance boundary

The source rules and regression coverage establish this bounded 48/56 px interaction-floor behavior, Forced Colors, Reduced Transparency, Increased Contrast, and loaded Read-filter behavior only. They do not establish complete Mail Glaze UI 2.2 conformance, a wired Touch Assistance preference source, 200% large-text/reflow acceptance, Reduced Motion acceptance, complete keyboard/screen-reader acceptance, RTL/localization acceptance, System Glaze budget review, Human Visual Excellence, representative-device acceptance, provider production acceptance, release, or Stable qualification.

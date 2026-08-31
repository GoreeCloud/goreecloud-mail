# Rendered unread-only mailbox filter — Development

GoreeCloud Mail now renders an explicit **Unread only** presentation control for the current mailbox snapshot.

Authority and privacy boundary:

- The control operates only on message cards already rendered from the provider-loaded mailbox snapshot.
- Unread state comes only from the provider-derived `unread` value already used by the message renderer.
- Toggling the control performs no provider call, mailbox refresh, hidden search, network request, read-state mutation, or unread-count mutation.
- The control composes with the existing current-mailbox browser search because it observes and filters whatever provider-derived cards the accepted controller renders.
- Provider-authoritative read-state changes continue through the existing capability-gated `setReadState` path; after that path refreshes the mailbox, the presentation control simply reapplies to the refreshed rendered cards.
- The UI exposes an `aria-pressed` state and a polite status projection describing only the current loaded view.
- No browser-local mailbox authority, optimistic unread count, automatic read tracking, engagement inference, background activity inference, or additional retention is introduced.

Status: **Development**. Production provider acceptance, complete Glaze UI 2.1 rendered/accessibility acceptance, representative-device acceptance, release, and Stable qualification remain separate gates.

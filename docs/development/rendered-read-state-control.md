# Rendered read-state control — Development

The Mail reader now consumes the existing provider-authoritative read-state action contract as a rendered action.

- The control is exposed only when a message is selected and the provider advertises `readState` capability.
- Its label is derived from current provider message state: **Mark read** for unread messages and **Mark unread** for read messages.
- Activation calls only the provider `setReadState(messageId, targetRead)` mutation.
- Mailbox metadata and the selected mailbox are refreshed from the provider after a successful mutation, and the message is reopened only from refreshed provider state when it remains present.
- Opening a message does not automatically mark it read.
- Mutation-in-flight state disables the action and the existing reader mutation controls.

This slice creates no browser-local read-state authority, optimistic unread counters, background read tracking, or automatic engagement inference. Provider capability and provider-returned state remain authoritative.

Status: **Development**. Production provider acceptance, complete Glaze UI 2.1 rendered acceptance, accessibility/device acceptance, release, and Stable qualification remain separate gates.

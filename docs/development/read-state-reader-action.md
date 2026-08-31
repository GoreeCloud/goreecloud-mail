# Read-State Reader Action Contract — Development

This slice defines the presentation and capability-gating contract for exposing the existing provider-authoritative read/unread mutation from the GoreeCloud Mail reader.

The action is derived only from the currently selected provider message: an unread message maps to **Mark read** with `targetRead=true`; a read message maps to **Mark unread** with `targetRead=false`. The action may be exposed only when a message is selected, no message mutation is already in flight, and the active provider advertises the `readState` capability.

This contract deliberately does not create browser-local read authority, optimistic unread counters, or an automatic mark-read-on-open policy. The existing provider remains authoritative for message state and mailbox unread totals.

## Remaining integration gate

The current Development reader still needs to wire this contract into its rendered action strip and invoke `provider.setReadState(messageId, targetRead)` through the existing serialized message-mutation path. Providers that do not advertise `readState` must not show an enabled action.

This is Development source work only. It does not establish deployed gateway/backend support for every provider, production acceptance, release acceptance, or Stable qualification.

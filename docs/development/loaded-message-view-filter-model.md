# Loaded message view filter model

Status: Development

This slice adds a reusable local presentation model for filtering the messages that are already loaded in the current mailbox view.

Supported views are All, Unread, Flagged, and Unread + Flagged. The model consumes only provider-authoritative `unread` and `flagged` booleans already attached to the loaded message model. Unknown or missing filter values normalize to All.

## Authority boundary

This model does not perform provider search, request additional mailbox pages, mutate message state, infer flags, or claim a complete server-side result set. A finite filter fails closed when its required provider-authoritative boolean is absent.

The status copy explicitly says "current loaded mailbox view" so the UI cannot accidentally imply that all remote messages have been searched.

## Next composition step

A later rendered slice can replace the single-purpose unread presentation control with a Glaze UI filter control backed by this model while preserving provider capability and pagination boundaries.

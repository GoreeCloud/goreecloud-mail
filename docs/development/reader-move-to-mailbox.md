# Reader Move to Mailbox — Development

The GoreeCloud Mail reader can move the selected message through the configured provider's existing `move` capability.

## Behavior

- The control appears only when the provider advertises Move support and at least one valid destination exists.
- Destinations are derived from the provider's current mailbox list.
- The current mailbox, Starred, Sent, Drafts, and Trash are not offered as generic move targets. Trash remains behind the separately confirmed removal action.
- Custom provider folders remain valid destinations.
- After a successful provider mutation, mailbox metadata and the current mailbox are re-read from the provider; the browser does not invent the resulting state.
- Demo mode keeps move state in the provider instance and is covered by round-trip tests.

## Boundary

Development only. This does not add provider folder creation, label mutation, bulk message moves, drag-and-drop organization, production-provider acceptance, or Stable qualification.

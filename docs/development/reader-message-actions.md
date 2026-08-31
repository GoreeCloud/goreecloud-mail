# Reader Archive and Delete Actions — Development

The browser reader now exposes Archive and Delete only when the configured `MailProvider` advertises those capabilities. Both actions call the existing provider authority (`archive` / `remove`) and then force a fresh read of the selected mailbox plus mailbox metadata instead of fabricating the resulting state in the browser.

Delete requires an explicit confirmation that states the provider determines whether the operation maps to Trash or permanent deletion. Archive is hidden in Archive and Trash views; Delete is hidden in Trash. Flag remains capability-gated.

The Development demo provider now keeps isolated in-memory Inbox, Archive, Trash, and Starred projections so its mutation results are visible without pretending to provide durable provider storage.

This slice does not add bulk actions, Undo, Trash recovery, permanent-delete semantics, durable demo state, production provider acceptance, or Stable qualification.

# Attachment Preview Security Boundary

GoreeCloud Mail treats every attachment as untrusted data.

Previewing an attachment is a separate permission from downloading an attachment.

## Rules

- Images may receive controlled previews only after type validation and metadata handling requirements are satisfied.
- PDF previews require a sandboxed renderer with external requests disabled.
- Executable or active-content formats do not receive previews.
- Unsupported document formats remain download-only until a dedicated safe renderer exists.

## Security Requirements

Preview systems must not:

- execute embedded scripts;
- load remote resources;
- launch external applications;
- bypass attachment authorization;
- expose another user's attachment data;
- treat filename extensions as authoritative.

## Future Preview Runtime

The final preview runtime should provide resource limits, isolated execution, audit-safe failures, and explicit capability reporting to GoreeCloud Mail clients.

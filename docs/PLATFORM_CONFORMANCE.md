# Mandatory Native and Platform Conformance

Effective August 24, 2026, GoreeCloud Mail must be built and maintained as original GoreeCloud-owned software from the ground up.

Small, technically necessary foundational dependencies remain permitted where independent reimplementation would reduce security, correctness, interoperability, standards compliance, or maintainability. Examples include cryptographic and protocol libraries, database engines, operating-system APIs, web frameworks, and comparable critical foundations. Such dependencies must not become the application shell or define the GoreeCloud product identity.

## Integral Platform Systems

Current GoreeCloud Platform Contract 0.3 evaluates all eight Integral Platform Systems:

1. GoreeCloud Manager
2. Privacy Shield
3. Wardveil Security
4. Everkeep
5. GLAZE UI
6. GoreeCloud Mesh
7. GoreeCloud Identity
8. GoreeCloud Sync

Every system must be declared independently in the repository-root `goreecloud.platform.yaml`. A local feature, similarly named subsystem, documentation claim, or successful source test cannot substitute for accepted producer-system integration evidence.

No release or service state may be classified or retained as Stable unless native application qualification and all applicable current Platform System requirements are complete, validated, and accepted. Missing, blocked, migration-required, materially incomplete, outdated, or unverified integration remains a Stable blocker.

## Current GLAZE UI state

Mail currently has a mixed consumer state.

The native Android Development client targets current Stable GLAZE UI V1.4 (`1.4.0`) at exact Stable source revision `84cb3db4884042f0fa25ed6d475a127fb110f596`. Android source validation, JVM tests, and debug APK assembly are Development evidence only. Optical Engine acceptance, Reduced Transparency/contrast acceptance, representative-device qualification, rendered/accessibility acceptance, Human Visual Excellence, and applicable V1.4.1 manual/device validation remain separate gates.

The existing web application retains older repository-local Glaze implementation and rendered evidence. That evidence remains useful historical/migration material but is not V1.4 application acceptance. Mail therefore correctly remains `applicable-migration-required` for GLAZE UI and globally `nonconformant`.

## Identity and provider authority

Mail separates GoreeCloud Identity from external-provider authorization.

The Android client now contains a source-ready `MailSessionBinding` contract for non-secret principal, exact opaque Mail account, audience, and lifetime proof metadata. This prerequisite does not create a credential, authenticate a user, register the application with GoreeCloud Identity, enable network access, or authorize provider transport.

Provider OAuth, IMAP/SMTP credentials, and provider-account authority remain separate from GoreeCloud Identity application/session authority. Neither can silently substitute for the other.

## GoreeCloud Sync boundary

GoreeCloud Sync is an independent Platform System. Provider synchronization, background work, local cache/storage, offline replay, and Everkeep backup/recovery do not establish Sync acceptance.

Accepted change tracking, version coordination, authorized replication, conflict reconciliation, offline resume, and cross-device continuity remain blocked until an explicit GoreeCloud Sync integration is implemented and validated.

## Security, privacy, and recovery boundaries

Existing Wardveil attachment enforcement and controlled-provider validation remain bounded evidence. They do not establish broad Wardveil Security acceptance, Android attachment acceptance, production quarantine authority, or a general protected-state claim.

Privacy-oriented content and remote-content controls do not by themselves establish Privacy Shield runtime acceptance. Likewise, SQLite backup primitives and recovery documentation do not establish Everkeep acceptance or production restore qualification.

## Evidence and production boundary

Source conformance, exact-revision CI, target-environment acceptance, production deployment, backup/restore evidence, release authorization, and Stable qualification are separate gates. Passing Platform Contract validation proves only that the declaration satisfies the checked contract semantics; it does not manufacture missing runtime evidence or production approval.

Repository CI, release documentation, project specifications, and change logs must progressively enforce and record this contract. Where repository source, canonical GoreeCloud governance, and historical records differ, current canonical governance controls current behavior while immutable revision history remains audit evidence.

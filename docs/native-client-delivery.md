# GoreeCloud Mail Native Client Delivery

## Targets

GoreeCloud Mail will provide:

- Web application
- Linux Debian package
- Android APK
- Future iOS client

## Current State

The repository now contains release pipeline foundations for web, Debian, and Android artifacts.

Actual signed production artifacts require completion of the native client implementations, signing configuration, release credentials, and production acceptance validation.

## Delivery Principles

- One shared GoreeCloud Mail architecture.
- Glaze UI consistency across clients.
- No provider credentials embedded in client applications.
- No email server operation.
- No production release without security, privacy, accessibility, and recovery validation.

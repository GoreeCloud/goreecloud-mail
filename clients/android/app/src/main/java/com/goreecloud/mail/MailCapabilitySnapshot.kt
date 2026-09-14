package com.goreecloud.mail

enum class MailCapabilityState {
    NOT_IMPLEMENTED,
    SOURCE_READY,
    UNAVAILABLE,
    AVAILABLE,
}

data class MailCapability(
    val state: MailCapabilityState,
    val explanation: String,
)

data class MailCapabilitySnapshot(
    val sessionBindingContract: MailCapability,
    val identityRegistrationContract: MailCapability,
    val providerAccountContract: MailCapability,
    val providerAccountDecoder: MailCapability,
    val accountTransport: MailCapability,
    val backgroundSync: MailCapability,
    val pushNotifications: MailCapability,
    val secureLocalStorage: MailCapability,
    val attachmentHandling: MailCapability,
) {
    companion object {
        fun developmentShell(): MailCapabilitySnapshot {
            val pending = MailCapability(
                state = MailCapabilityState.NOT_IMPLEMENTED,
                explanation = "Not connected in the Android Development shell",
            )
            return MailCapabilitySnapshot(
                sessionBindingContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Fail-closed non-secret session/account binding policy is implemented; native Identity exchange is not implemented",
                ),
                identityRegistrationContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Identity registration acceptance is source-ready, but the pinned Identity registry has no runtime registrations; Mail registration and native Identity runtime remain blocked",
                ),
                providerAccountContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Read-only provider-account request/response and capability vocabulary are source-ready; no network transport is enabled",
                ),
                providerAccountDecoder = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Exact-field in-memory decoder rejects unknown, missing, and mistyped provider-account fields before semantic acceptance; JSON/network transport is not enabled",
                ),
                accountTransport = pending,
                backgroundSync = pending,
                pushNotifications = pending,
                secureLocalStorage = pending,
                attachmentHandling = pending,
            )
        }
    }
}

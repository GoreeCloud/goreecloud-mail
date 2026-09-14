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
    val providerAccountContract: MailCapability,
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
                providerAccountContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Read-only provider-account request/response and capability vocabulary are source-ready; no network transport is enabled",
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

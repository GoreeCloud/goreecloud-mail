package com.goreecloud.mail

enum class MailCapabilityState {
    NOT_IMPLEMENTED,
    SOURCE_READY,
    BACKEND_BLOCKED,
    UNAVAILABLE,
    AVAILABLE,
}

data class MailCapability(
    val state: MailCapabilityState,
    val explanation: String,
)

data class MailCapabilitySnapshot(
    val sessionBindingContract: MailCapability,
    val providerAccountReadContract: MailCapability,
    val providerCapabilityReadContract: MailCapability,
    val mailboxReadContract: MailCapability,
    val messageReadContract: MailCapability,
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
            val backendBlocked = MailCapability(
                state = MailCapabilityState.BACKEND_BLOCKED,
                explanation = "The current trusted backend does not expose this read route on the parent revision",
            )
            return MailCapabilitySnapshot(
                sessionBindingContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Fail-closed non-secret session/account binding policy is implemented; native Identity exchange is not implemented",
                ),
                providerAccountReadContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Selected provider-account request/response contract matches the current trusted backend public record",
                ),
                providerCapabilityReadContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Account-scoped normalized capability discovery contract is implemented with an exact fail-closed vocabulary",
                ),
                mailboxReadContract = backendBlocked,
                messageReadContract = backendBlocked,
                accountTransport = pending,
                backgroundSync = pending,
                pushNotifications = pending,
                secureLocalStorage = pending,
                attachmentHandling = pending,
            )
        }
    }
}

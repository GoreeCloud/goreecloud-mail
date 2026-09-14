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
    val providerReadContract: MailCapability,
    val providerWireDecoderContract: MailCapability,
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
                providerReadContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Read-only account discovery/detail/capability request and response contracts match the current Mail service; network transport is not implemented",
                ),
                providerWireDecoderContract = MailCapability(
                    state = MailCapabilityState.SOURCE_READY,
                    explanation = "Exact-field transport-neutral decoding rejects unknown/missing fields and scalar coercion before response acceptance; JSON parsing and network transport are not implemented",
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

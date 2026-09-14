package com.goreecloud.mail

import java.net.URLEncoder
import java.nio.charset.StandardCharsets

enum class MailProviderReadContractState {
    SOURCE_READY,
    IDENTITY_BLOCKED,
    TRANSPORT_BLOCKED,
}

data class MailProviderReadContractSnapshot(
    val accountDiscovery: MailProviderReadContractState,
    val accountDetail: MailProviderReadContractState,
    val providerCapabilities: MailProviderReadContractState,
    val sessionBindingContract: MailProviderReadContractState,
    val nativeIdentitySession: MailProviderReadContractState,
    val networkTransport: MailProviderReadContractState,
)

/**
 * Pure Android-side model of the read-only Mail account routes that exist on the GoreeCloud Mail
 * service today. The account identifier is opaque: this code validates its shape and percent-encodes
 * it for a relative path, but never trims, case-folds, decodes, reparses, or derives account identity.
 *
 * This contract performs no HTTP, authentication, provider OAuth, IMAP/SMTP, credential storage,
 * mailbox/message access, persistence, synchronization, or push work.
 */
object MailProviderReadContract {
    const val ACCOUNTS_PATH = "/api/mail/accounts"

    private const val MAX_ACCOUNT_ID_LENGTH = 4096

    fun accountPath(accountId: String): String =
        "$ACCOUNTS_PATH/${encodeOpaqueAccountId(requireOpaqueAccountId(accountId))}"

    fun capabilitiesPath(accountId: String): String =
        "${accountPath(accountId)}/capabilities"

    fun readiness(): MailProviderReadContractSnapshot = MailProviderReadContractSnapshot(
        accountDiscovery = MailProviderReadContractState.SOURCE_READY,
        accountDetail = MailProviderReadContractState.SOURCE_READY,
        providerCapabilities = MailProviderReadContractState.SOURCE_READY,
        sessionBindingContract = MailProviderReadContractState.SOURCE_READY,
        nativeIdentitySession = MailProviderReadContractState.IDENTITY_BLOCKED,
        networkTransport = MailProviderReadContractState.TRANSPORT_BLOCKED,
    )

    private fun requireOpaqueAccountId(value: String): String {
        require(value.isNotBlank()) { "accountId must be non-blank" }
        require(value.length <= MAX_ACCOUNT_ID_LENGTH) {
            "accountId exceeds $MAX_ACCOUNT_ID_LENGTH characters"
        }
        require(value == value.trim()) {
            "accountId must already be exact; trimming is not allowed"
        }
        require(value.none(Char::isISOControl)) {
            "accountId must not contain control characters"
        }
        return value
    }

    private fun encodeOpaqueAccountId(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8).replace("+", "%20")
}

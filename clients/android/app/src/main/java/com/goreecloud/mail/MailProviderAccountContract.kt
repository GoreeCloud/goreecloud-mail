package com.goreecloud.mail

import java.time.OffsetDateTime
import java.time.format.DateTimeParseException

/** Source-only readiness for the native provider-account boundary. */
enum class MailProviderAccountContractState {
    SOURCE_READY,
    IDENTITY_BLOCKED,
    TRANSPORT_BLOCKED,
}

data class MailProviderAccountContractSnapshot(
    val accountList: MailProviderAccountContractState,
    val accountDetail: MailProviderAccountContractState,
    val capabilityDiscovery: MailProviderAccountContractState,
    val nativeIdentitySession: MailProviderAccountContractState,
    val networkTransport: MailProviderAccountContractState,
)

data class MailProviderAccountWire(
    val id: String,
    val provider: String,
    val externalAccountId: String?,
    val displayName: String?,
    val createdAt: String,
)

data class MailProviderAccountsEnvelope(val accounts: List<MailProviderAccountWire>)
data class MailProviderAccountEnvelope(val account: MailProviderAccountWire)
data class MailProviderCapabilitiesEnvelope(
    val accountId: String,
    val provider: String,
    val capabilities: Map<String, Boolean>,
)

sealed interface MailProviderAccountDecision {
    data class Accepted(val itemCount: Int) : MailProviderAccountDecision
    data class Rejected(val reason: String) : MailProviderAccountDecision
}

/**
 * Transport-neutral contract for the existing trusted `/api/mail/accounts` read surface.
 *
 * The trusted backend remains responsible for session authentication, user/account ownership,
 * provider credentials, and provider execution. This code performs no HTTP, credential storage,
 * provider selection, mailbox access, synchronization, or mutation.
 */
object MailProviderAccountContract {
    const val ACCOUNTS_PATH = "/api/mail/accounts"

    val ACCOUNT_FIELDS = setOf("id", "provider", "externalAccountId", "displayName", "createdAt")
    val ACCOUNT_LIST_FIELDS = setOf("accounts")
    val ACCOUNT_DETAIL_FIELDS = setOf("account")
    val CAPABILITY_TOP_LEVEL_FIELDS = setOf("accountId", "provider", "capabilities")

    val CAPABILITY_NAMES = setOf(
        "mailboxAccess", "messageRead", "attachmentRetrieval", "archive", "drafts", "flags",
        "folders", "labels", "search", "send", "threads", "move", "delete", "readState",
        "spam", "trashRecovery", "serverSideSearch", "incrementalSync", "pushSync",
        "storageQuota", "scheduledSend", "undoSend", "deliveryReceipts", "readReceipts",
        "senderIdentities", "aliases", "customDomains", "distributionLists", "providerRules",
        "retentionControls", "organizationPolicies",
    )

    private const val MAX_ACCOUNTS = 128
    private const val MAX_ACCOUNT_ID = 512
    private const val MAX_PROVIDER = 128
    private const val MAX_EXTERNAL_ID = 4096
    private const val MAX_DISPLAY_NAME = 1024

    fun accountPath(accountId: String): String =
        "$ACCOUNTS_PATH/${encodePathSegment(requireOpaqueAccountId(accountId))}"

    fun capabilitiesPath(accountId: String): String = "${accountPath(accountId)}/capabilities"

    fun readiness(): MailProviderAccountContractSnapshot = MailProviderAccountContractSnapshot(
        accountList = MailProviderAccountContractState.SOURCE_READY,
        accountDetail = MailProviderAccountContractState.SOURCE_READY,
        capabilityDiscovery = MailProviderAccountContractState.SOURCE_READY,
        nativeIdentitySession = MailProviderAccountContractState.IDENTITY_BLOCKED,
        networkTransport = MailProviderAccountContractState.TRANSPORT_BLOCKED,
    )

    fun acceptAccounts(envelope: MailProviderAccountsEnvelope): MailProviderAccountDecision {
        if (envelope.accounts.size > MAX_ACCOUNTS) return reject("too many provider accounts")
        if (envelope.accounts.map { it.id }.toSet().size != envelope.accounts.size) {
            return reject("duplicate provider account id")
        }
        envelope.accounts.forEachIndexed { index, account ->
            validateAccount(account)?.let { return reject("account[$index]: $it") }
        }
        return MailProviderAccountDecision.Accepted(envelope.accounts.size)
    }

    fun acceptAccount(
        expectedAccountId: String,
        envelope: MailProviderAccountEnvelope,
    ): MailProviderAccountDecision {
        val expected = requireOpaqueAccountId(expectedAccountId)
        validateAccount(envelope.account)?.let { return reject(it) }
        if (envelope.account.id != expected) return reject("account id does not match request")
        return MailProviderAccountDecision.Accepted(1)
    }

    fun acceptCapabilities(
        expectedAccountId: String,
        expectedProvider: String?,
        envelope: MailProviderCapabilitiesEnvelope,
    ): MailProviderAccountDecision {
        val expected = requireOpaqueAccountId(expectedAccountId)
        if (envelope.accountId != expected) return reject("capability account id does not match request")
        if (!validCanonical(envelope.provider, MAX_PROVIDER, allowEmpty = false)) {
            return reject("provider is invalid")
        }
        if (expectedProvider != null && envelope.provider != expectedProvider) {
            return reject("provider does not match accepted account")
        }
        if (envelope.capabilities.keys != CAPABILITY_NAMES) {
            return reject("capability vocabulary is incomplete or contains unknown fields")
        }
        return MailProviderAccountDecision.Accepted(envelope.capabilities.size)
    }

    fun unexpectedFields(actual: Set<String>, allowed: Set<String>): Set<String> = actual - allowed

    private fun validateAccount(account: MailProviderAccountWire): String? {
        if (!validCanonical(account.id, MAX_ACCOUNT_ID, allowEmpty = false)) return "id is invalid"
        if (!validCanonical(account.provider, MAX_PROVIDER, allowEmpty = false)) return "provider is invalid"
        if (account.externalAccountId != null && !validContent(account.externalAccountId, MAX_EXTERNAL_ID)) {
            return "externalAccountId is invalid"
        }
        if (account.displayName != null && !validContent(account.displayName, MAX_DISPLAY_NAME)) {
            return "displayName is invalid"
        }
        if (parseOffset(account.createdAt) == null) return "createdAt must be offset-aware ISO-8601"
        return null
    }

    private fun requireOpaqueAccountId(value: String): String {
        require(validCanonical(value, MAX_ACCOUNT_ID, allowEmpty = false)) {
            "accountId must be a bounded exact opaque string"
        }
        return value
    }

    private fun validCanonical(value: String, maxLength: Int, allowEmpty: Boolean): Boolean {
        if (value.length > maxLength) return false
        if (!allowEmpty && value.isEmpty()) return false
        if (value != value.trim()) return false
        return value.none(Char::isISOControl)
    }

    private fun validContent(value: String, maxLength: Int): Boolean =
        value.length <= maxLength && value.none { it.isISOControl() && it != '\n' && it != '\r' && it != '\t' }

    private fun parseOffset(value: String): OffsetDateTime? = try {
        OffsetDateTime.parse(value)
    } catch (_: DateTimeParseException) {
        null
    }

    private fun encodePathSegment(value: String): String = buildString {
        value.toByteArray(Charsets.UTF_8).forEach { byte ->
            val unsigned = byte.toInt() and 0xff
            val c = unsigned.toChar()
            if ((c in 'A'..'Z') || (c in 'a'..'z') || (c in '0'..'9') || c in "-._~") {
                append(c)
            } else {
                append('%')
                append(unsigned.toString(16).uppercase().padStart(2, '0'))
            }
        }
    }

    private fun reject(reason: String): MailProviderAccountDecision.Rejected =
        MailProviderAccountDecision.Rejected(reason)
}

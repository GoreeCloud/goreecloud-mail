package com.goreecloud.mail

import java.time.Instant
import java.time.format.DateTimeParseException

data class MailProviderAccountWire(
    val id: String,
    val provider: String,
    val externalAccountId: String?,
    val displayName: String?,
    val createdAt: String,
)

data class MailProviderAccountsEnvelope(
    val accounts: List<MailProviderAccountWire>,
)

data class MailProviderAccountEnvelope(
    val account: MailProviderAccountWire,
)

data class MailProviderCapabilitiesEnvelope(
    val accountId: String,
    val provider: String,
    val capabilities: Map<String, Boolean>,
)

sealed interface MailProviderResponseDecision {
    data class Accepted(val itemCount: Int) : MailProviderResponseDecision
    data class Rejected(val reason: String) : MailProviderResponseDecision
}

/**
 * Transport-neutral acceptance policy for the read-only provider-account service routes.
 *
 * A future decoder must reject unknown fields with these allowlists before constructing the typed
 * models below. Successful acceptance establishes only shape/contract compatibility for supplied
 * data. It does not authenticate a user, authorize a provider, establish network trust, or make
 * account data durable local authority.
 */
object MailProviderResponseContract {
    val ACCOUNTS_TOP_LEVEL_FIELDS = setOf("accounts")
    val ACCOUNT_TOP_LEVEL_FIELDS = setOf("account")
    val ACCOUNT_FIELDS = setOf(
        "id",
        "provider",
        "externalAccountId",
        "displayName",
        "createdAt",
    )
    val CAPABILITIES_TOP_LEVEL_FIELDS = setOf(
        "accountId",
        "provider",
        "capabilities",
    )

    val KNOWN_CAPABILITIES = linkedSetOf(
        "mailboxAccess",
        "messageRead",
        "attachmentRetrieval",
        "archive",
        "drafts",
        "flags",
        "folders",
        "labels",
        "search",
        "send",
        "threads",
        "move",
        "delete",
        "readState",
        "spam",
        "trashRecovery",
        "serverSideSearch",
        "incrementalSync",
        "pushSync",
        "storageQuota",
        "scheduledSend",
        "undoSend",
        "deliveryReceipts",
        "readReceipts",
        "senderIdentities",
        "aliases",
        "customDomains",
        "distributionLists",
        "providerRules",
        "retentionControls",
        "organizationPolicies",
    )

    private const val MAX_ACCOUNTS = 100
    private const val MAX_ACCOUNT_ID = 4096
    private const val MAX_PROVIDER = 128
    private const val MAX_EXTERNAL_ACCOUNT_ID = 4096
    private const val MAX_DISPLAY_NAME = 1024

    fun unexpectedFields(actual: Set<String>, allowed: Set<String>): Set<String> = actual - allowed

    fun acceptAccounts(envelope: MailProviderAccountsEnvelope): MailProviderResponseDecision {
        if (envelope.accounts.size > MAX_ACCOUNTS) return reject("too many provider accounts")
        if (envelope.accounts.map { it.id }.toSet().size != envelope.accounts.size) {
            return reject("duplicate provider account id")
        }
        envelope.accounts.forEachIndexed { index, account ->
            validateAccount(account)?.let { return reject("account[$index]: $it") }
        }
        return MailProviderResponseDecision.Accepted(envelope.accounts.size)
    }

    fun acceptAccount(
        expectedAccountId: String,
        envelope: MailProviderAccountEnvelope,
    ): MailProviderResponseDecision {
        if (!validOpaqueIdentity(expectedAccountId, MAX_ACCOUNT_ID)) {
            return reject("expected account id is invalid")
        }
        validateAccount(envelope.account)?.let { return reject("account: $it") }
        if (envelope.account.id != expectedAccountId) {
            return reject("account id does not match request")
        }
        return MailProviderResponseDecision.Accepted(1)
    }

    fun acceptCapabilities(
        expectedAccountId: String,
        envelope: MailProviderCapabilitiesEnvelope,
    ): MailProviderResponseDecision {
        if (!validOpaqueIdentity(expectedAccountId, MAX_ACCOUNT_ID)) {
            return reject("expected account id is invalid")
        }
        if (envelope.accountId != expectedAccountId) {
            return reject("capability account id does not match request")
        }
        if (!validCanonicalText(envelope.provider, MAX_PROVIDER, allowEmpty = false)) {
            return reject("provider is invalid")
        }
        if (envelope.capabilities.keys != KNOWN_CAPABILITIES) {
            val missing = KNOWN_CAPABILITIES - envelope.capabilities.keys
            val extra = envelope.capabilities.keys - KNOWN_CAPABILITIES
            return reject("capability set mismatch: missing=$missing extra=$extra")
        }
        return MailProviderResponseDecision.Accepted(envelope.capabilities.size)
    }

    private fun validateAccount(account: MailProviderAccountWire): String? {
        if (!validOpaqueIdentity(account.id, MAX_ACCOUNT_ID)) return "id is invalid"
        if (!validCanonicalText(account.provider, MAX_PROVIDER, allowEmpty = false)) {
            return "provider is invalid"
        }
        if (
            account.externalAccountId != null &&
            !validCanonicalText(account.externalAccountId, MAX_EXTERNAL_ACCOUNT_ID, allowEmpty = false)
        ) {
            return "externalAccountId is invalid"
        }
        if (
            account.displayName != null &&
            !validCanonicalText(account.displayName, MAX_DISPLAY_NAME, allowEmpty = false)
        ) {
            return "displayName is invalid"
        }
        if (parseInstant(account.createdAt) == null) return "createdAt is invalid"
        return null
    }

    private fun validOpaqueIdentity(value: String, maxLength: Int): Boolean =
        value.isNotBlank() &&
            value.length <= maxLength &&
            value == value.trim() &&
            value.none(Char::isISOControl)

    private fun validCanonicalText(value: String, maxLength: Int, allowEmpty: Boolean): Boolean {
        if (value.length > maxLength) return false
        if (!allowEmpty && value.isEmpty()) return false
        if (value != value.trim()) return false
        return value.none(Char::isISOControl)
    }

    private fun parseInstant(value: String): Instant? = try {
        Instant.parse(value)
    } catch (_: DateTimeParseException) {
        null
    }

    private fun reject(reason: String): MailProviderResponseDecision.Rejected =
        MailProviderResponseDecision.Rejected(reason)
}

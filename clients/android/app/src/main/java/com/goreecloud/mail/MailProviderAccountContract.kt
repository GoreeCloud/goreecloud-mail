package com.goreecloud.mail

import java.nio.charset.StandardCharsets
import java.time.Instant
import java.time.format.DateTimeParseException

data class MailProviderAccountWire(
    val id: String,
    val provider: String,
    val externalAccountId: String?,
    val displayName: String?,
    val createdAt: String,
)

data class MailProviderCapabilitiesWire(
    val accountId: String,
    val provider: String,
    val capabilities: Map<String, Boolean>,
)

sealed interface MailProviderAccountDecision {
    data class AcceptedAccount(val account: MailProviderAccountWire) : MailProviderAccountDecision
    data class AcceptedCapabilities(
        val accountId: String,
        val provider: String,
        val capabilities: Map<String, Boolean>,
    ) : MailProviderAccountDecision

    data class Rejected(val reason: String) : MailProviderAccountDecision
}

/**
 * Transport-neutral Android contract for the exact read-only provider-account surface that exists
 * on the current GoreeCloud Mail backend.
 *
 * This source contract does not perform HTTP, authenticate a session, resolve provider credentials,
 * access a mailbox, persist account data, or grant provider authority. A future decoder must reject
 * unknown fields using the allowlists below before supplying typed values to this policy.
 */
object MailProviderAccountContract {
    const val ACCOUNTS_PATH = "/api/mail/accounts"

    val ACCOUNT_FIELDS = setOf(
        "id",
        "provider",
        "externalAccountId",
        "displayName",
        "createdAt",
    )

    val ACCOUNT_ENVELOPE_FIELDS = setOf("account")
    val CAPABILITIES_FIELDS = setOf("accountId", "provider", "capabilities")

    val KNOWN_CAPABILITIES = setOf(
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

    private const val MAX_ACCOUNT_ID_LENGTH = 1024
    private const val MAX_PROVIDER_LENGTH = 256
    private const val MAX_EXTERNAL_ACCOUNT_ID_LENGTH = 4096
    private const val MAX_DISPLAY_NAME_LENGTH = 1024

    fun accountPath(accountId: String): String =
        "$ACCOUNTS_PATH/${encodePathSegment(requireOpaqueAccountId(accountId))}"

    fun capabilitiesPath(accountId: String): String =
        "${accountPath(accountId)}/capabilities"

    fun unexpectedFields(actual: Set<String>, allowed: Set<String>): Set<String> = actual - allowed

    fun acceptAccount(
        expectedAccountId: String,
        account: MailProviderAccountWire,
    ): MailProviderAccountDecision {
        val expected = validateOpaqueAccountId(expectedAccountId)
            ?: return reject("expected account id is invalid")
        if (account.id != expected) return reject("account id does not match request")
        if (validateOpaqueAccountId(account.id) == null) return reject("account id is invalid")
        if (!validCanonicalText(account.provider, MAX_PROVIDER_LENGTH, allowEmpty = false)) {
            return reject("provider is invalid")
        }
        if (account.externalAccountId != null &&
            !validCanonicalText(account.externalAccountId, MAX_EXTERNAL_ACCOUNT_ID_LENGTH, allowEmpty = false)
        ) {
            return reject("external account id is invalid")
        }
        if (account.displayName != null &&
            !validCanonicalText(account.displayName, MAX_DISPLAY_NAME_LENGTH, allowEmpty = false)
        ) {
            return reject("display name is invalid")
        }
        if (parseInstant(account.createdAt) == null) return reject("createdAt is invalid")
        return MailProviderAccountDecision.AcceptedAccount(account)
    }

    fun acceptCapabilities(
        expectedAccountId: String,
        expectedProvider: String,
        response: MailProviderCapabilitiesWire,
    ): MailProviderAccountDecision {
        val expectedId = validateOpaqueAccountId(expectedAccountId)
            ?: return reject("expected account id is invalid")
        if (!validCanonicalText(expectedProvider, MAX_PROVIDER_LENGTH, allowEmpty = false)) {
            return reject("expected provider is invalid")
        }
        if (response.accountId != expectedId) return reject("capability account id mismatch")
        if (response.provider != expectedProvider) return reject("capability provider mismatch")
        if (validateOpaqueAccountId(response.accountId) == null) return reject("capability account id is invalid")
        if (!validCanonicalText(response.provider, MAX_PROVIDER_LENGTH, allowEmpty = false)) {
            return reject("capability provider is invalid")
        }
        if (response.capabilities.keys != KNOWN_CAPABILITIES) {
            return reject("capability vocabulary is incomplete or contains unknown entries")
        }
        return MailProviderAccountDecision.AcceptedCapabilities(
            accountId = response.accountId,
            provider = response.provider,
            capabilities = response.capabilities.toMap(),
        )
    }

    private fun requireOpaqueAccountId(value: String): String =
        requireNotNull(validateOpaqueAccountId(value)) {
            "provider account id must be a bounded exact opaque value"
        }

    private fun validateOpaqueAccountId(value: String): String? {
        if (!validCanonicalText(value, MAX_ACCOUNT_ID_LENGTH, allowEmpty = false)) return null
        return value
    }

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

    private fun encodePathSegment(value: String): String {
        val bytes = value.toByteArray(StandardCharsets.UTF_8)
        val out = StringBuilder(bytes.size)
        for (byte in bytes) {
            val unsigned = byte.toInt() and 0xff
            val unreserved =
                unsigned in 'a'.code..'z'.code ||
                    unsigned in 'A'.code..'Z'.code ||
                    unsigned in '0'.code..'9'.code ||
                    unsigned == '-'.code ||
                    unsigned == '.'.code ||
                    unsigned == '_'.code ||
                    unsigned == '~'.code
            if (unreserved) {
                out.append(unsigned.toChar())
            } else {
                out.append('%')
                out.append(HEX[unsigned ushr 4])
                out.append(HEX[unsigned and 0x0f])
            }
        }
        return out.toString()
    }

    private fun reject(reason: String): MailProviderAccountDecision.Rejected =
        MailProviderAccountDecision.Rejected(reason)

    private const val HEX = "0123456789ABCDEF"
}

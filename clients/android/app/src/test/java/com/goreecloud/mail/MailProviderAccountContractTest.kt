package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class MailProviderAccountContractTest {
    @Test
    fun accountAndCapabilityPathsPreserveOpaqueIdentityThroughPathEncoding() {
        val accountId = "acct /opaque?#✓"
        assertEquals(
            "/api/mail/accounts/acct%20%2Fopaque%3F%23%E2%9C%93",
            MailProviderAccountContract.accountPath(accountId),
        )
        assertEquals(
            "/api/mail/accounts/acct%20%2Fopaque%3F%23%E2%9C%93/capabilities",
            MailProviderAccountContract.capabilitiesPath(accountId),
        )
    }

    @Test
    fun invalidOpaqueAccountIdsFailBeforeAnyFutureTransport() {
        listOf(
            "",
            "   ",
            " account-1",
            "account-1 ",
            "account\n1",
            "a".repeat(1025),
        ).forEach { accountId ->
            assertThrows(IllegalArgumentException::class.java) {
                MailProviderAccountContract.accountPath(accountId)
            }
        }
    }

    @Test
    fun selectedAccountMetadataIsAcceptedWithoutOwningUserOrCredentials() {
        val account = account()
        val decision = MailProviderAccountContract.acceptAccount(account.id, account)
        assertTrue(decision is MailProviderAccountDecision.AcceptedAccount)
        assertEquals(
            emptySet<String>(),
            MailProviderAccountContract.unexpectedFields(
                MailProviderAccountContract.ACCOUNT_FIELDS,
                MailProviderAccountContract.ACCOUNT_FIELDS,
            ),
        )
    }

    @Test
    fun accountIdentityProviderAndCreatedAtDriftFailClosed() {
        val base = account()
        val cases = listOf(
            MailProviderAccountContract.acceptAccount("different", base),
            MailProviderAccountContract.acceptAccount(base.id, base.copy(provider = " gmail")),
            MailProviderAccountContract.acceptAccount(base.id, base.copy(createdAt = "not-an-instant")),
            MailProviderAccountContract.acceptAccount(base.id, base.copy(externalAccountId = " ext")),
            MailProviderAccountContract.acceptAccount(base.id, base.copy(displayName = "Inbox\u0000")),
        )
        cases.forEach { assertTrue(it is MailProviderAccountDecision.Rejected) }
    }

    @Test
    fun exactNormalizedCapabilityVocabularyIsAccepted() {
        val capabilities = MailProviderAccountContract.KNOWN_CAPABILITIES.associateWith { false }.toMutableMap()
        capabilities["mailboxAccess"] = true
        capabilities["messageRead"] = true

        val decision = MailProviderAccountContract.acceptCapabilities(
            expectedAccountId = "account-1",
            expectedProvider = "gmail",
            response = MailProviderCapabilitiesWire(
                accountId = "account-1",
                provider = "gmail",
                capabilities = capabilities,
            ),
        )

        assertTrue(decision is MailProviderAccountDecision.AcceptedCapabilities)
        val accepted = decision as MailProviderAccountDecision.AcceptedCapabilities
        assertEquals(true, accepted.capabilities["mailboxAccess"])
        assertEquals(false, accepted.capabilities["pushSync"])
        assertEquals(MailProviderAccountContract.KNOWN_CAPABILITIES, accepted.capabilities.keys)
    }

    @Test
    fun missingUnknownOrMismatchedCapabilityAuthorityIsRejected() {
        val exact = MailProviderAccountContract.KNOWN_CAPABILITIES.associateWith { false }
        val missing = exact - "mailboxAccess"
        val unknown = exact + ("rawImapPassword" to true)

        val cases = listOf(
            MailProviderAccountContract.acceptCapabilities(
                "account-1",
                "gmail",
                MailProviderCapabilitiesWire("account-1", "gmail", missing),
            ),
            MailProviderAccountContract.acceptCapabilities(
                "account-1",
                "gmail",
                MailProviderCapabilitiesWire("account-1", "gmail", unknown),
            ),
            MailProviderAccountContract.acceptCapabilities(
                "account-1",
                "gmail",
                MailProviderCapabilitiesWire("account-2", "gmail", exact),
            ),
            MailProviderAccountContract.acceptCapabilities(
                "account-1",
                "gmail",
                MailProviderCapabilitiesWire("account-1", "imap-smtp", exact),
            ),
        )

        cases.forEach { assertTrue(it is MailProviderAccountDecision.Rejected) }
    }

    @Test
    fun exactFieldAllowlistsRejectCredentialAndOwnershipExpansion() {
        assertEquals(
            setOf("userId", "refreshToken"),
            MailProviderAccountContract.unexpectedFields(
                MailProviderAccountContract.ACCOUNT_FIELDS + setOf("userId", "refreshToken"),
                MailProviderAccountContract.ACCOUNT_FIELDS,
            ),
        )
        assertEquals(
            setOf("providerToken"),
            MailProviderAccountContract.unexpectedFields(
                MailProviderAccountContract.CAPABILITIES_FIELDS + "providerToken",
                MailProviderAccountContract.CAPABILITIES_FIELDS,
            ),
        )
    }

    private fun account() = MailProviderAccountWire(
        id = "account-1",
        provider = "gmail",
        externalAccountId = "alice@example.test",
        displayName = "Personal",
        createdAt = "2026-09-14T12:00:00Z",
    )
}

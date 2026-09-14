package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MailProviderResponseContractTest {
    private fun account(
        id: String = "account-1",
        provider: String = "gmail",
        externalAccountId: String? = "alice@example.test",
        displayName: String? = "Alice",
        createdAt: String = "2026-09-14T01:00:00Z",
    ) = MailProviderAccountWire(
        id = id,
        provider = provider,
        externalAccountId = externalAccountId,
        displayName = displayName,
        createdAt = createdAt,
    )

    private fun allCapabilities(value: Boolean = false): Map<String, Boolean> =
        MailProviderResponseContract.KNOWN_CAPABILITIES.associateWith { value }

    @Test
    fun accountListAcceptsBoundedPublicRecords() {
        val decision = MailProviderResponseContract.acceptAccounts(
            MailProviderAccountsEnvelope(
                accounts = listOf(
                    account(),
                    account(id = "account-2", provider = "imap-smtp", displayName = "Work"),
                ),
            ),
        )

        assertEquals(MailProviderResponseDecision.Accepted(2), decision)
    }

    @Test
    fun accountListRejectsDuplicateOrMalformedPublicRecords() {
        val duplicate = MailProviderResponseContract.acceptAccounts(
            MailProviderAccountsEnvelope(accounts = listOf(account(), account())),
        )
        assertTrue(duplicate is MailProviderResponseDecision.Rejected)

        val controlBearing = MailProviderResponseContract.acceptAccounts(
            MailProviderAccountsEnvelope(accounts = listOf(account(displayName = "Alice\nAdmin"))),
        )
        assertTrue(controlBearing is MailProviderResponseDecision.Rejected)

        val invalidTimestamp = MailProviderResponseContract.acceptAccounts(
            MailProviderAccountsEnvelope(accounts = listOf(account(createdAt = "not-an-instant"))),
        )
        assertTrue(invalidTimestamp is MailProviderResponseDecision.Rejected)
    }

    @Test
    fun accountDetailMustMatchTheExactRequestedOpaqueIdentity() {
        val accepted = MailProviderResponseContract.acceptAccount(
            expectedAccountId = "account-1",
            envelope = MailProviderAccountEnvelope(account()),
        )
        assertEquals(MailProviderResponseDecision.Accepted(1), accepted)

        val mismatch = MailProviderResponseContract.acceptAccount(
            expectedAccountId = "account-2",
            envelope = MailProviderAccountEnvelope(account()),
        )
        assertTrue(mismatch is MailProviderResponseDecision.Rejected)
    }

    @Test
    fun capabilityResponseRequiresExactKnownCapabilitySet() {
        val accepted = MailProviderResponseContract.acceptCapabilities(
            expectedAccountId = "account-1",
            envelope = MailProviderCapabilitiesEnvelope(
                accountId = "account-1",
                provider = "gmail",
                capabilities = allCapabilities(),
            ),
        )
        assertEquals(
            MailProviderResponseDecision.Accepted(MailProviderResponseContract.KNOWN_CAPABILITIES.size),
            accepted,
        )

        val missing = allCapabilities().toMutableMap().also { it.remove("messageRead") }
        assertTrue(
            MailProviderResponseContract.acceptCapabilities(
                expectedAccountId = "account-1",
                envelope = MailProviderCapabilitiesEnvelope("account-1", "gmail", missing),
            ) is MailProviderResponseDecision.Rejected,
        )

        val extra = allCapabilities().toMutableMap().also { it["rawCredentialAccess"] = true }
        assertTrue(
            MailProviderResponseContract.acceptCapabilities(
                expectedAccountId = "account-1",
                envelope = MailProviderCapabilitiesEnvelope("account-1", "gmail", extra),
            ) is MailProviderResponseDecision.Rejected,
        )
    }

    @Test
    fun capabilityResponseMustBelongToTheRequestedAccount() {
        val mismatch = MailProviderResponseContract.acceptCapabilities(
            expectedAccountId = "account-1",
            envelope = MailProviderCapabilitiesEnvelope(
                accountId = "account-2",
                provider = "gmail",
                capabilities = allCapabilities(),
            ),
        )

        assertTrue(mismatch is MailProviderResponseDecision.Rejected)
    }

    @Test
    fun exactFieldAllowlistsRejectUserAndCredentialAuthorityExpansion() {
        val accountUnexpected = MailProviderResponseContract.unexpectedFields(
            actual = MailProviderResponseContract.ACCOUNT_FIELDS + setOf("userId", "accessToken"),
            allowed = MailProviderResponseContract.ACCOUNT_FIELDS,
        )
        assertEquals(setOf("userId", "accessToken"), accountUnexpected)

        val capabilitiesUnexpected = MailProviderResponseContract.unexpectedFields(
            actual = MailProviderResponseContract.CAPABILITIES_TOP_LEVEL_FIELDS + setOf("refreshToken"),
            allowed = MailProviderResponseContract.CAPABILITIES_TOP_LEVEL_FIELDS,
        )
        assertEquals(setOf("refreshToken"), capabilitiesUnexpected)
    }
}

package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.assertThrows
import org.junit.Test

class MailProviderAccountContractTest {
    private val account = MailProviderAccountWire(
        id = "acct 1/primary",
        provider = "gmail",
        externalAccountId = "opaque-provider-id",
        displayName = "Personal Mail",
        createdAt = "2026-09-14T08:00:00-05:00",
    )

    @Test
    fun readPathsPreserveOpaqueAccountIdentityAndEncodeOnlyPathSegment() {
        assertEquals(
            "/api/mail/accounts/acct%201%2Fprimary",
            MailProviderAccountContract.accountPath("acct 1/primary"),
        )
        assertEquals(
            "/api/mail/accounts/acct%201%2Fprimary/capabilities",
            MailProviderAccountContract.capabilitiesPath("acct 1/primary"),
        )
    }

    @Test
    fun malformedAccountIdentityFailsClosed() {
        listOf("", " acct", "acct\n", "a".repeat(513)).forEach { value ->
            assertThrows(IllegalArgumentException::class.java) {
                MailProviderAccountContract.accountPath(value)
            }
        }
    }

    @Test
    fun accountListAcceptsOnlyBoundedUniquePublicRecords() {
        val result = MailProviderAccountContract.acceptAccounts(
            MailProviderAccountsEnvelope(listOf(account)),
        )
        assertEquals(MailProviderAccountDecision.Accepted(1), result)

        val duplicate = MailProviderAccountContract.acceptAccounts(
            MailProviderAccountsEnvelope(listOf(account, account)),
        )
        assertTrue(duplicate is MailProviderAccountDecision.Rejected)
    }

    @Test
    fun accountDetailMustMatchRequestedOpaqueId() {
        assertEquals(
            MailProviderAccountDecision.Accepted(1),
            MailProviderAccountContract.acceptAccount(
                expectedAccountId = account.id,
                envelope = MailProviderAccountEnvelope(account),
            ),
        )
        assertTrue(
            MailProviderAccountContract.acceptAccount(
                expectedAccountId = "another-account",
                envelope = MailProviderAccountEnvelope(account),
            ) is MailProviderAccountDecision.Rejected,
        )
    }

    @Test
    fun capabilityResponseRequiresExactCompleteVocabulary() {
        val accepted = MailProviderAccountContract.acceptCapabilities(
            expectedAccountId = account.id,
            expectedProvider = account.provider,
            envelope = MailProviderCapabilitiesEnvelope(
                accountId = account.id,
                provider = account.provider,
                capabilities = MailProviderAccountContract.CAPABILITY_NAMES.associateWith { false },
            ),
        )
        assertEquals(
            MailProviderAccountDecision.Accepted(MailProviderAccountContract.CAPABILITY_NAMES.size),
            accepted,
        )

        val incomplete = MailProviderAccountContract.acceptCapabilities(
            expectedAccountId = account.id,
            expectedProvider = account.provider,
            envelope = MailProviderCapabilitiesEnvelope(
                accountId = account.id,
                provider = account.provider,
                capabilities = mapOf("mailboxAccess" to true),
            ),
        )
        assertTrue(incomplete is MailProviderAccountDecision.Rejected)
    }

    @Test
    fun capabilityResponseCannotSwitchAccountOrProvider() {
        val capabilities = MailProviderAccountContract.CAPABILITY_NAMES.associateWith { false }
        assertTrue(
            MailProviderAccountContract.acceptCapabilities(
                expectedAccountId = account.id,
                expectedProvider = account.provider,
                envelope = MailProviderCapabilitiesEnvelope("other", account.provider, capabilities),
            ) is MailProviderAccountDecision.Rejected,
        )
        assertTrue(
            MailProviderAccountContract.acceptCapabilities(
                expectedAccountId = account.id,
                expectedProvider = account.provider,
                envelope = MailProviderCapabilitiesEnvelope(account.id, "imap", capabilities),
            ) is MailProviderAccountDecision.Rejected,
        )
    }

    @Test
    fun secretAndOwnerFieldsAreOutsideAcceptedWireShape() {
        val actual = MailProviderAccountContract.ACCOUNT_FIELDS + setOf(
            "userId", "accessToken", "refreshToken", "password", "sessionCookie",
        )
        assertEquals(
            setOf("userId", "accessToken", "refreshToken", "password", "sessionCookie"),
            MailProviderAccountContract.unexpectedFields(actual, MailProviderAccountContract.ACCOUNT_FIELDS),
        )
    }

    @Test
    fun invalidTimestampOrControlBearingMetadataIsRejected() {
        val invalidTimestamp = account.copy(createdAt = "2026-09-14T08:00:00")
        assertTrue(
            MailProviderAccountContract.acceptAccount(
                invalidTimestamp.id,
                MailProviderAccountEnvelope(invalidTimestamp),
            ) is MailProviderAccountDecision.Rejected,
        )

        val invalidProvider = account.copy(provider = "gmail\n")
        assertTrue(
            MailProviderAccountContract.acceptAccount(
                invalidProvider.id,
                MailProviderAccountEnvelope(invalidProvider),
            ) is MailProviderAccountDecision.Rejected,
        )
    }

    @Test
    fun sourceReadinessDoesNotClaimIdentityOrNetworkRuntime() {
        val readiness = MailProviderAccountContract.readiness()
        assertEquals(MailProviderAccountContractState.SOURCE_READY, readiness.accountList)
        assertEquals(MailProviderAccountContractState.SOURCE_READY, readiness.accountDetail)
        assertEquals(MailProviderAccountContractState.SOURCE_READY, readiness.capabilityDiscovery)
        assertEquals(MailProviderAccountContractState.IDENTITY_BLOCKED, readiness.nativeIdentitySession)
        assertEquals(MailProviderAccountContractState.TRANSPORT_BLOCKED, readiness.networkTransport)
    }
}

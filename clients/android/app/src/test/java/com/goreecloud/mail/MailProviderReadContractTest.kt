package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class MailProviderReadContractTest {
    @Test
    fun accountDiscoveryUsesExistingRelativeEndpoint() {
        assertEquals("/api/mail/accounts", MailProviderReadContract.ACCOUNTS_PATH)
    }

    @Test
    fun opaqueAccountIdentityIsPreservedAndOnlyEncodedForThePath() {
        assertEquals(
            "/api/mail/accounts/acct%2Falpha%20beta",
            MailProviderReadContract.accountPath("acct/alpha beta"),
        )
        assertEquals(
            "/api/mail/accounts/acct%2Falpha%20beta/capabilities",
            MailProviderReadContract.capabilitiesPath("acct/alpha beta"),
        )
    }

    @Test
    fun blankTrimDependentControlAndOversizedAccountIdsAreRejected() {
        listOf(
            "",
            "   ",
            " account-1",
            "account-1 ",
            "account\n1",
            "a".repeat(4097),
        ).forEach { accountId ->
            assertThrows(IllegalArgumentException::class.java) {
                MailProviderReadContract.accountPath(accountId)
            }
        }
    }

    @Test
    fun readContractCanBeSourceReadyWithoutIdentityOrTransportAuthority() {
        val readiness = MailProviderReadContract.readiness()

        assertEquals(MailProviderReadContractState.SOURCE_READY, readiness.accountDiscovery)
        assertEquals(MailProviderReadContractState.SOURCE_READY, readiness.accountDetail)
        assertEquals(MailProviderReadContractState.SOURCE_READY, readiness.providerCapabilities)
        assertEquals(MailProviderReadContractState.SOURCE_READY, readiness.sessionBindingContract)
        assertEquals(MailProviderReadContractState.IDENTITY_BLOCKED, readiness.nativeIdentitySession)
        assertEquals(MailProviderReadContractState.TRANSPORT_BLOCKED, readiness.networkTransport)
    }
}

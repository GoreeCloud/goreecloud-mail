package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MailCapabilitySnapshotTest {
    @Test
    fun developmentShellDoesNotClaimRuntimeCapabilities() {
        val snapshot = MailCapabilitySnapshot.developmentShell()
        val runtimeCapabilities = listOf(
            snapshot.accountTransport,
            snapshot.backgroundSync,
            snapshot.pushNotifications,
            snapshot.secureLocalStorage,
            snapshot.attachmentHandling,
        )

        assertEquals(5, runtimeCapabilities.size)
        assertTrue(runtimeCapabilities.all { it.state == MailCapabilityState.NOT_IMPLEMENTED })
        assertTrue(runtimeCapabilities.none { it.state == MailCapabilityState.AVAILABLE })
    }

    @Test
    fun sourceContractsAreReadyWithoutClaimingIdentityOrTransport() {
        val snapshot = MailCapabilitySnapshot.developmentShell()

        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.sessionBindingContract.state)
        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.providerAccountReadContract.state)
        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.providerCapabilityReadContract.state)
        assertTrue(snapshot.sessionBindingContract.explanation.contains("Identity exchange is not implemented"))
        assertTrue(snapshot.accountTransport.state != MailCapabilityState.AVAILABLE)
    }

    @Test
    fun mailboxAndMessageReadsStayBackendBlockedUntilRoutesExist() {
        val snapshot = MailCapabilitySnapshot.developmentShell()

        assertEquals(MailCapabilityState.BACKEND_BLOCKED, snapshot.mailboxReadContract.state)
        assertEquals(MailCapabilityState.BACKEND_BLOCKED, snapshot.messageReadContract.state)
        assertTrue(snapshot.mailboxReadContract.explanation.contains("backend does not expose"))
        assertTrue(snapshot.messageReadContract.explanation.contains("backend does not expose"))
    }

    @Test
    fun unavailableCapabilitiesCarryAnExplanation() {
        val snapshot = MailCapabilitySnapshot.developmentShell()

        assertTrue(snapshot.accountTransport.explanation.isNotBlank())
        assertTrue(snapshot.secureLocalStorage.explanation.isNotBlank())
    }
}

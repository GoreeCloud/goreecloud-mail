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
    fun sourceContractsAreReadyButRuntimeRemainsBlocked() {
        val snapshot = MailCapabilitySnapshot.developmentShell()

        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.sessionBindingContract.state)
        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.identityRegistrationReadiness.state)
        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.providerAccountContract.state)
        assertEquals(MailCapabilityState.SOURCE_READY, snapshot.providerAccountDecoder.state)
        assertTrue(snapshot.sessionBindingContract.explanation.contains("Identity exchange is not implemented"))
        assertTrue(snapshot.identityRegistrationReadiness.explanation.contains("client ID"))
        assertTrue(snapshot.identityRegistrationReadiness.explanation.contains("no runtime registration is accepted"))
        assertTrue(snapshot.providerAccountContract.explanation.contains("no network transport is enabled"))
        assertTrue(snapshot.providerAccountDecoder.explanation.contains("JSON/network transport is not enabled"))
        assertTrue(snapshot.accountTransport.state != MailCapabilityState.AVAILABLE)
    }

    @Test
    fun unavailableCapabilitiesCarryAnExplanation() {
        val snapshot = MailCapabilitySnapshot.developmentShell()

        assertTrue(snapshot.accountTransport.explanation.isNotBlank())
        assertTrue(snapshot.secureLocalStorage.explanation.isNotBlank())
    }
}

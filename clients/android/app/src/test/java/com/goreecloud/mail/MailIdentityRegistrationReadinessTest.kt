package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MailIdentityRegistrationReadinessTest {
    @Test
    fun defaultCandidateKeepsEveryIdentityOwnedRegistrationFieldBlocked() {
        val result = MailIdentityRegistrationReadinessPolicy.evaluate(MailIdentityRegistrationCandidate())

        assertTrue(result.sourceContractReady)
        assertFalse(result.runtimeRegistrationAccepted)
        assertEquals(
            setOf(
                MailIdentityRegistrationBlocker.CLIENT_ID_UNRESOLVED,
                MailIdentityRegistrationBlocker.REDIRECT_URIS_UNRESOLVED,
                MailIdentityRegistrationBlocker.ALLOWED_SCOPES_UNRESOLVED,
                MailIdentityRegistrationBlocker.LIFECYCLE_UNRESOLVED,
            ),
            result.blockers,
        )
    }

    @Test
    fun wrongApplicationOrAudienceCannotBeAccepted() {
        val result = MailIdentityRegistrationReadinessPolicy.evaluate(
            MailIdentityRegistrationCandidate(
                applicationId = "goreecloud-tasks",
                audience = "goreecloud-tasks-android",
            ),
        )

        assertTrue(MailIdentityRegistrationBlocker.INVALID_APPLICATION_ID in result.blockers)
        assertTrue(MailIdentityRegistrationBlocker.INVALID_AUDIENCE in result.blockers)
        assertFalse(result.runtimeRegistrationAccepted)
    }

    @Test
    fun malformedConcreteFieldsFailClosed() {
        val result = MailIdentityRegistrationReadinessPolicy.evaluate(
            MailIdentityRegistrationCandidate(
                clientId = " client-id ",
                redirectUris = setOf("goreecloud-mail://callback\u0000"),
                allowedScopes = setOf("*"),
                enabled = false,
            ),
        )

        assertTrue(MailIdentityRegistrationBlocker.INVALID_CLIENT_ID in result.blockers)
        assertTrue(MailIdentityRegistrationBlocker.INVALID_REDIRECT_URI in result.blockers)
        assertTrue(MailIdentityRegistrationBlocker.INVALID_SCOPE in result.blockers)
        assertTrue(MailIdentityRegistrationBlocker.DISABLED in result.blockers)
        assertFalse(result.runtimeRegistrationAccepted)
    }

    @Test
    fun evenCompleteSourceValuesDoNotManufactureRuntimeAcceptance() {
        val result = MailIdentityRegistrationReadinessPolicy.evaluate(
            MailIdentityRegistrationCandidate(
                clientId = "example-public-native-client",
                redirectUris = setOf("https://example.invalid/callback"),
                allowedScopes = setOf("openid"),
                enabled = true,
            ),
        )

        assertTrue(result.blockers.isEmpty())
        assertFalse(result.runtimeRegistrationAccepted)
    }

    @Test
    fun identityReferencePinsOnlyVerifiedSharedIdentifiers() {
        assertEquals("goreecloud.identity.native-application-registration/v1", MailIdentityRegistrationReference.SCHEMA)
        assertEquals("73c3c00ff44906849baa711c588a0466e72999d7", MailIdentityRegistrationReference.CANDIDATE_REVISION)
        assertEquals("GoreeCloud Identity", MailIdentityRegistrationReference.CANONICAL_AUTHORITY)
        assertEquals("goreecloud-mail", MailIdentityRegistrationReference.APPLICATION_ID)
        assertEquals("goreecloud-mail-android", MailIdentityRegistrationReference.AUDIENCE)
    }
}

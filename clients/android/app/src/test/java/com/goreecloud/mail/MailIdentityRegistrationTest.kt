package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MailIdentityRegistrationTest {
    private val expectation = MailIdentityRegistrationExpectation(
        applicationId = "mail-android-app",
        clientId = "mail-android-public-client",
        audience = MailSessionExpectation.ANDROID_MAIL_AUDIENCE,
        redirectUri = "https://identity.goreecloud.com/native/mail/callback",
        requiredScopes = setOf("openid", "mail.accounts.read"),
    )

    private fun registration(
        applicationId: String = expectation.applicationId,
        clientId: String = expectation.clientId,
        audience: String = expectation.audience,
        redirectUris: List<String> = listOf(expectation.redirectUri),
        allowedScopes: List<String> = listOf("openid", "mail.accounts.read"),
        enabled: Boolean = true,
    ) = MailIdentityRegistrationRecord(
        applicationId = applicationId,
        clientId = clientId,
        audience = audience,
        redirectUris = redirectUris,
        allowedScopes = allowedScopes,
        enabled = enabled,
    )

    @Test
    fun pinnedIdentityRegistryIsExplicitlyEmptyAndRuntimeBlocked() {
        assertEquals(
            "goreecloud.identity.native-application-registration/v1",
            MailIdentityRegistrationReference.SCHEMA,
        )
        assertEquals(
            "73c3c00ff44906849baa711c588a0466e72999d7",
            MailIdentityRegistrationReference.CANDIDATE_REVISION,
        )
        assertFalse(MailIdentityRegistrationReference.PINNED_REGISTRY_HAS_RUNTIME_REGISTRATIONS)
        assertTrue(MailIdentityRegistrationContractState.SOURCE_READY.name.isNotBlank())
        assertTrue(MailIdentityRegistrationContractState.PINNED_IDENTITY_REGISTRY_EMPTY.name.isNotBlank())
        assertTrue(MailIdentityRegistrationContractState.RUNTIME_BLOCKED.name.isNotBlank())
    }

    @Test
    fun exactDecoderAcceptsOnlyRegistrationPublicShape() {
        val decoded = MailIdentityRegistrationDecoder.decode(
            mapOf(
                "applicationId" to expectation.applicationId,
                "clientId" to expectation.clientId,
                "audience" to expectation.audience,
                "redirectUris" to listOf(expectation.redirectUri),
                "allowedScopes" to listOf("openid", "mail.accounts.read"),
                "enabled" to true,
            ),
        )

        assertTrue(decoded is MailIdentityRegistrationDecodeResult.Accepted)
    }

    @Test
    fun decoderRejectsUnknownSecretFieldAndMissingField() {
        val valid = mapOf<String, Any>(
            "applicationId" to expectation.applicationId,
            "clientId" to expectation.clientId,
            "audience" to expectation.audience,
            "redirectUris" to listOf(expectation.redirectUri),
            "allowedScopes" to listOf("openid", "mail.accounts.read"),
            "enabled" to true,
        )

        assertEquals(
            MailIdentityRegistrationDecodeResult.InvalidShape,
            MailIdentityRegistrationDecoder.decode(valid + ("clientSecret" to "forbidden")),
        )
        assertEquals(
            MailIdentityRegistrationDecodeResult.InvalidShape,
            MailIdentityRegistrationDecoder.decode(valid - "enabled"),
        )
    }

    @Test
    fun decoderRejectsTypeCoercionAndNonStringCollections() {
        val invalidEnabled = mapOf<String, Any>(
            "applicationId" to expectation.applicationId,
            "clientId" to expectation.clientId,
            "audience" to expectation.audience,
            "redirectUris" to listOf(expectation.redirectUri),
            "allowedScopes" to listOf("openid"),
            "enabled" to "true",
        )
        val invalidScopes = invalidEnabled + mapOf(
            "enabled" to true,
            "allowedScopes" to listOf("openid", 7),
        )

        assertEquals(
            MailIdentityRegistrationDecodeResult.InvalidShape,
            MailIdentityRegistrationDecoder.decode(invalidEnabled),
        )
        assertEquals(
            MailIdentityRegistrationDecodeResult.InvalidShape,
            MailIdentityRegistrationDecoder.decode(invalidScopes),
        )
    }

    @Test
    fun missingRegistrationFailsClosed() {
        assertEquals(
            MailIdentityRegistrationDecision.MissingRegistration,
            MailIdentityRegistrationPolicy.evaluate(null, expectation),
        )
    }

    @Test
    fun matchingRegistrationProducesSourceMatchOnly() {
        val decision = MailIdentityRegistrationPolicy.evaluate(registration(), expectation)
        assertTrue(decision is MailIdentityRegistrationDecision.Matched)
        decision as MailIdentityRegistrationDecision.Matched
        assertEquals(expectation.applicationId, decision.applicationId)
        assertEquals(expectation.clientId, decision.clientId)
        assertEquals(expectation.audience, decision.audience)
        assertEquals(expectation.redirectUri, decision.redirectUri)
        assertEquals(expectation.requiredScopes, decision.requiredScopes)
        assertFalse(MailIdentityRegistrationReference.PINNED_REGISTRY_HAS_RUNTIME_REGISTRATIONS)
    }

    @Test
    fun disabledRegistrationFailsBeforeIdentityComparison() {
        assertEquals(
            MailIdentityRegistrationDecision.Disabled,
            MailIdentityRegistrationPolicy.evaluate(
                registration(applicationId = "other", enabled = false),
                expectation,
            ),
        )
    }

    @Test
    fun exactIdentityMismatchesFailClosed() {
        assertEquals(
            MailIdentityRegistrationDecision.ApplicationMismatch,
            MailIdentityRegistrationPolicy.evaluate(registration(applicationId = "other"), expectation),
        )
        assertEquals(
            MailIdentityRegistrationDecision.ClientIdMismatch,
            MailIdentityRegistrationPolicy.evaluate(registration(clientId = "other"), expectation),
        )
        assertEquals(
            MailIdentityRegistrationDecision.AudienceMismatch,
            MailIdentityRegistrationPolicy.evaluate(registration(audience = "other"), expectation),
        )
    }

    @Test
    fun redirectAndScopeExpansionFailClosed() {
        assertEquals(
            MailIdentityRegistrationDecision.RedirectNotRegistered,
            MailIdentityRegistrationPolicy.evaluate(
                registration(redirectUris = listOf("https://identity.goreecloud.com/other")),
                expectation,
            ),
        )
        assertEquals(
            MailIdentityRegistrationDecision.ScopeNotAllowed,
            MailIdentityRegistrationPolicy.evaluate(
                registration(allowedScopes = listOf("openid")),
                expectation,
            ),
        )
    }

    @Test
    fun malformedRegistrationIsRejectedBeforeMatching() {
        assertEquals(
            MailIdentityRegistrationDecision.InvalidRegistration,
            MailIdentityRegistrationPolicy.evaluate(
                registration(allowedScopes = listOf("openid", "*")),
                expectation,
            ),
        )
        assertEquals(
            MailIdentityRegistrationDecision.InvalidRegistration,
            MailIdentityRegistrationPolicy.evaluate(
                registration(redirectUris = listOf("https://user@example.com/callback")),
                expectation,
            ),
        )
        assertEquals(
            MailIdentityRegistrationDecision.InvalidRegistration,
            MailIdentityRegistrationPolicy.evaluate(
                registration(redirectUris = listOf(expectation.redirectUri, expectation.redirectUri)),
                expectation,
            ),
        )
    }

    @Test
    fun expectationCannotInventWildcardOrUnapprovedLoopbackRedirect() {
        assertEquals(
            MailIdentityRegistrationDecision.InvalidExpectation,
            MailIdentityRegistrationPolicy.evaluate(
                registration(),
                expectation.copy(requiredScopes = setOf("mail.*")),
            ),
        )
        assertEquals(
            MailIdentityRegistrationDecision.InvalidExpectation,
            MailIdentityRegistrationPolicy.evaluate(
                registration(redirectUris = listOf("http://127.0.0.1:7357/callback")),
                expectation.copy(redirectUri = "http://127.0.0.1:7357/callback"),
            ),
        )
    }

    @Test
    fun explicitLoopbackDevelopmentCanMatchButDoesNotGrantRuntimeAuthority() {
        val loopback = "http://127.0.0.1:7357/callback"
        val decision = MailIdentityRegistrationPolicy.evaluate(
            registration(redirectUris = listOf(loopback)),
            expectation.copy(
                redirectUri = loopback,
                allowExplicitLoopbackDevelopment = true,
            ),
        )

        assertTrue(decision is MailIdentityRegistrationDecision.Matched)
        assertFalse(MailIdentityRegistrationReference.PINNED_REGISTRY_HAS_RUNTIME_REGISTRATIONS)
    }
}

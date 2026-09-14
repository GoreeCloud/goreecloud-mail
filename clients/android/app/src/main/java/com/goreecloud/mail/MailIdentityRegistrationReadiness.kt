package com.goreecloud.mail

/**
 * Source-only readiness model for the future GoreeCloud Identity native registration owned by
 * Android Mail.
 *
 * The current Identity registration contract is contract-only and contains no concrete native
 * registrations. Mail therefore fixes only the identifiers already established by authoritative
 * source and leaves client ID, redirects, and allowed scopes unresolved instead of inventing them.
 */
object MailIdentityRegistrationReference {
    const val SCHEMA = "goreecloud.identity.native-application-registration/v1"
    const val CANDIDATE_REVISION = "73c3c00ff44906849baa711c588a0466e72999d7"
    const val CANONICAL_AUTHORITY = "GoreeCloud Identity"
    const val APPLICATION_ID = "goreecloud-mail"
    const val AUDIENCE = MailSessionExpectation.ANDROID_MAIL_AUDIENCE
}

data class MailIdentityRegistrationCandidate(
    val applicationId: String = MailIdentityRegistrationReference.APPLICATION_ID,
    val audience: String = MailIdentityRegistrationReference.AUDIENCE,
    val clientId: String? = null,
    val redirectUris: Set<String>? = null,
    val allowedScopes: Set<String>? = null,
    val enabled: Boolean? = null,
)

enum class MailIdentityRegistrationBlocker {
    INVALID_APPLICATION_ID,
    INVALID_AUDIENCE,
    CLIENT_ID_UNRESOLVED,
    REDIRECT_URIS_UNRESOLVED,
    ALLOWED_SCOPES_UNRESOLVED,
    LIFECYCLE_UNRESOLVED,
    INVALID_CLIENT_ID,
    INVALID_REDIRECT_URI,
    INVALID_SCOPE,
    DISABLED,
}

data class MailIdentityRegistrationReadiness(
    val sourceContractReady: Boolean,
    val runtimeRegistrationAccepted: Boolean,
    val blockers: Set<MailIdentityRegistrationBlocker>,
)

object MailIdentityRegistrationReadinessPolicy {
    fun evaluate(candidate: MailIdentityRegistrationCandidate): MailIdentityRegistrationReadiness {
        val blockers = linkedSetOf<MailIdentityRegistrationBlocker>()

        if (!isExactNonBlank(candidate.applicationId) ||
            candidate.applicationId != MailIdentityRegistrationReference.APPLICATION_ID
        ) {
            blockers += MailIdentityRegistrationBlocker.INVALID_APPLICATION_ID
        }
        if (!isExactNonBlank(candidate.audience) ||
            candidate.audience != MailIdentityRegistrationReference.AUDIENCE
        ) {
            blockers += MailIdentityRegistrationBlocker.INVALID_AUDIENCE
        }

        val clientId = candidate.clientId
        when {
            clientId == null -> blockers += MailIdentityRegistrationBlocker.CLIENT_ID_UNRESOLVED
            !isExactNonBlank(clientId) -> blockers += MailIdentityRegistrationBlocker.INVALID_CLIENT_ID
        }

        val redirects = candidate.redirectUris
        when {
            redirects == null -> blockers += MailIdentityRegistrationBlocker.REDIRECT_URIS_UNRESOLVED
            redirects.isEmpty() || redirects.any { !isExactNonBlank(it) } ->
                blockers += MailIdentityRegistrationBlocker.INVALID_REDIRECT_URI
        }

        val scopes = candidate.allowedScopes
        when {
            scopes == null -> blockers += MailIdentityRegistrationBlocker.ALLOWED_SCOPES_UNRESOLVED
            scopes.isEmpty() || scopes.any { !isExactNonBlank(it) || it == "*" } ->
                blockers += MailIdentityRegistrationBlocker.INVALID_SCOPE
        }

        when (candidate.enabled) {
            null -> blockers += MailIdentityRegistrationBlocker.LIFECYCLE_UNRESOLVED
            false -> blockers += MailIdentityRegistrationBlocker.DISABLED
            true -> Unit
        }

        return MailIdentityRegistrationReadiness(
            sourceContractReady = true,
            runtimeRegistrationAccepted = false,
            blockers = blockers,
        )
    }

    private fun isExactNonBlank(value: String): Boolean =
        value.isNotBlank() && value == value.trim() && value.none(Char::isISOControl)
}

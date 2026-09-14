package com.goreecloud.mail

import java.net.URI

/**
 * Exact GoreeCloud Identity source authority used by this Development tranche.
 *
 * The pinned Identity revision defines the native registration schema but intentionally contains
 * no runtime registrations. Mail must therefore remain transport-blocked even when synthetic test
 * records satisfy this consumer-side policy.
 */
object MailIdentityRegistrationReference {
    const val SCHEMA = "goreecloud.identity.native-application-registration/v1"
    const val CANDIDATE_REVISION = "73c3c00ff44906849baa711c588a0466e72999d7"
    const val PINNED_REGISTRY_HAS_RUNTIME_REGISTRATIONS = false
}

enum class MailIdentityRegistrationContractState {
    SOURCE_READY,
    PINNED_IDENTITY_REGISTRY_EMPTY,
    RUNTIME_BLOCKED,
}

data class MailIdentityRegistrationRecord(
    val applicationId: String,
    val clientId: String,
    val audience: String,
    val redirectUris: List<String>,
    val allowedScopes: List<String>,
    val enabled: Boolean,
)

/**
 * Mail-owned expectations supplied only after Identity establishes an authoritative registration.
 *
 * There are intentionally no default application ID, client ID, redirect URI, or scopes here.
 * Those values belong to GoreeCloud Identity registration authority and must not be invented by the
 * consuming application before a concrete registration exists.
 */
data class MailIdentityRegistrationExpectation(
    val applicationId: String,
    val clientId: String,
    val audience: String,
    val redirectUri: String,
    val requiredScopes: Set<String>,
    val allowExplicitLoopbackDevelopment: Boolean = false,
)

sealed interface MailIdentityRegistrationDecodeResult {
    data class Accepted(val registration: MailIdentityRegistrationRecord) :
        MailIdentityRegistrationDecodeResult

    data object InvalidShape : MailIdentityRegistrationDecodeResult
}

sealed interface MailIdentityRegistrationDecision {
    /**
     * Source configuration matches the supplied Identity-owned expectation.
     * This does not authenticate a principal or enable Mail transport.
     */
    data class Matched(
        val applicationId: String,
        val clientId: String,
        val audience: String,
        val redirectUri: String,
        val requiredScopes: Set<String>,
    ) : MailIdentityRegistrationDecision

    data object MissingRegistration : MailIdentityRegistrationDecision
    data object InvalidExpectation : MailIdentityRegistrationDecision
    data object InvalidRegistration : MailIdentityRegistrationDecision
    data object Disabled : MailIdentityRegistrationDecision
    data object ApplicationMismatch : MailIdentityRegistrationDecision
    data object ClientIdMismatch : MailIdentityRegistrationDecision
    data object AudienceMismatch : MailIdentityRegistrationDecision
    data object RedirectNotRegistered : MailIdentityRegistrationDecision
    data object ScopeNotAllowed : MailIdentityRegistrationDecision
}

/** Exact-field decoder for the public native application-registration record. */
object MailIdentityRegistrationDecoder {
    val EXACT_FIELDS: Set<String> = setOf(
        "applicationId",
        "clientId",
        "audience",
        "redirectUris",
        "allowedScopes",
        "enabled",
    )

    fun decode(value: Map<*, *>): MailIdentityRegistrationDecodeResult {
        if (value.keys.any { it !is String } || value.keys != EXACT_FIELDS) {
            return MailIdentityRegistrationDecodeResult.InvalidShape
        }

        val applicationId = value["applicationId"] as? String
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape
        val clientId = value["clientId"] as? String
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape
        val audience = value["audience"] as? String
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape
        val redirectUris = exactStringList(value["redirectUris"])
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape
        val allowedScopes = exactStringList(value["allowedScopes"])
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape
        val enabled = value["enabled"] as? Boolean
            ?: return MailIdentityRegistrationDecodeResult.InvalidShape

        return MailIdentityRegistrationDecodeResult.Accepted(
            MailIdentityRegistrationRecord(
                applicationId = applicationId,
                clientId = clientId,
                audience = audience,
                redirectUris = redirectUris,
                allowedScopes = allowedScopes,
                enabled = enabled,
            ),
        )
    }

    private fun exactStringList(value: Any?): List<String>? {
        val list = value as? List<*> ?: return null
        if (list.any { it !is String }) return null
        return list.map { it as String }
    }
}

/**
 * Pure fail-closed consumer acceptance policy for an Identity-owned registration record.
 *
 * Identity remains authoritative for registration creation, client identity, redirect validation,
 * scopes, enablement, credential issuance, revocation, and native authorization runtime. This
 * policy only proves that already-decoded registration metadata exactly matches a Mail expectation.
 */
object MailIdentityRegistrationPolicy {
    fun evaluate(
        registration: MailIdentityRegistrationRecord?,
        expectation: MailIdentityRegistrationExpectation,
    ): MailIdentityRegistrationDecision {
        if (!validExpectation(expectation)) {
            return MailIdentityRegistrationDecision.InvalidExpectation
        }
        registration ?: return MailIdentityRegistrationDecision.MissingRegistration
        if (!validRegistration(registration)) {
            return MailIdentityRegistrationDecision.InvalidRegistration
        }
        if (!registration.enabled) {
            return MailIdentityRegistrationDecision.Disabled
        }
        if (registration.applicationId != expectation.applicationId) {
            return MailIdentityRegistrationDecision.ApplicationMismatch
        }
        if (registration.clientId != expectation.clientId) {
            return MailIdentityRegistrationDecision.ClientIdMismatch
        }
        if (registration.audience != expectation.audience) {
            return MailIdentityRegistrationDecision.AudienceMismatch
        }
        if (expectation.redirectUri !in registration.redirectUris) {
            return MailIdentityRegistrationDecision.RedirectNotRegistered
        }
        if (!registration.allowedScopes.containsAll(expectation.requiredScopes)) {
            return MailIdentityRegistrationDecision.ScopeNotAllowed
        }

        return MailIdentityRegistrationDecision.Matched(
            applicationId = registration.applicationId,
            clientId = registration.clientId,
            audience = registration.audience,
            redirectUri = expectation.redirectUri,
            requiredScopes = expectation.requiredScopes.toSet(),
        )
    }

    private fun validExpectation(value: MailIdentityRegistrationExpectation): Boolean {
        if (!exactIdentifier(value.applicationId) ||
            !exactIdentifier(value.clientId) ||
            !exactIdentifier(value.audience) ||
            !validScopes(value.requiredScopes)
        ) {
            return false
        }
        return validRedirect(value.redirectUri, value.allowExplicitLoopbackDevelopment)
    }

    private fun validRegistration(value: MailIdentityRegistrationRecord): Boolean {
        if (!exactIdentifier(value.applicationId) ||
            !exactIdentifier(value.clientId) ||
            !exactIdentifier(value.audience) ||
            value.redirectUris.isEmpty() ||
            value.redirectUris.distinct().size != value.redirectUris.size ||
            value.allowedScopes.isEmpty() ||
            value.allowedScopes.distinct().size != value.allowedScopes.size ||
            !validScopes(value.allowedScopes.toSet())
        ) {
            return false
        }
        return value.redirectUris.all { validRegistrationRedirect(it) }
    }

    private fun exactIdentifier(value: String): Boolean =
        value.isNotBlank() && value == value.trim() && value.none(Char::isISOControl)

    private fun validScopes(scopes: Set<String>): Boolean =
        scopes.isNotEmpty() && scopes.all {
            exactIdentifier(it) && '*' !in it
        }

    private fun validRegistrationRedirect(value: String): Boolean =
        validRedirect(value, allowExplicitLoopbackDevelopment = true)

    private fun validRedirect(
        value: String,
        allowExplicitLoopbackDevelopment: Boolean,
    ): Boolean {
        if (!exactIdentifier(value) || '*' in value) return false
        val uri = try {
            URI(value)
        } catch (_: RuntimeException) {
            return false
        }
        if (!uri.isAbsolute || uri.rawUserInfo != null || uri.rawFragment != null) return false
        val host = uri.host ?: return false
        if (uri.scheme.equals("https", ignoreCase = true)) return true
        if (!allowExplicitLoopbackDevelopment || !uri.scheme.equals("http", ignoreCase = true)) {
            return false
        }
        return host == "127.0.0.1" || host == "::1" || host.equals("localhost", ignoreCase = true)
    }
}

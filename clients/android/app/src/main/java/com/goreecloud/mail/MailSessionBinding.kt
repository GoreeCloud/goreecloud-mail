package com.goreecloud.mail

import java.time.Instant

/**
 * Non-secret identity/session metadata required before Android Mail transport can be considered.
 *
 * This contract intentionally contains no bearer token, refresh token, password, cookie, service
 * credential, or transport implementation. It validates the binding that a future accepted
 * GoreeCloud Identity exchange must prove without defining that exchange itself.
 */
data class MailSessionProof(
    val principalId: String,
    val accountId: String,
    val audience: String,
    val issuedAt: Instant,
    val expiresAt: Instant,
)

data class MailSessionExpectation(
    val principalId: String,
    val accountId: String,
    val audience: String = ANDROID_MAIL_AUDIENCE,
) {
    companion object {
        const val ANDROID_MAIL_AUDIENCE = "goreecloud-mail-android"
    }
}

sealed interface MailSessionBindingDecision {
    /** Binding metadata is internally consistent; transport authority is still a separate gate. */
    data class Bound(
        val principalId: String,
        val accountId: String,
        val expiresAt: Instant,
    ) : MailSessionBindingDecision

    data object MissingProof : MailSessionBindingDecision
    data object InvalidExpectation : MailSessionBindingDecision
    data object InvalidProof : MailSessionBindingDecision
    data object PrincipalMismatch : MailSessionBindingDecision
    data object AccountMismatch : MailSessionBindingDecision
    data object AudienceMismatch : MailSessionBindingDecision
    data object NotYetValid : MailSessionBindingDecision
    data object Expired : MailSessionBindingDecision
}

/**
 * Pure, fail-closed acceptance policy for native Mail session/account binding metadata.
 *
 * Account identifiers are exact opaque values. They are never string-coerced, trimmed, case-folded,
 * decoded, or otherwise normalized here. This preserves the existing provider-runtime identity
 * boundary and prevents Android from creating a second account identity convention.
 */
object MailSessionBindingPolicy {
    fun evaluate(
        proof: MailSessionProof?,
        expectation: MailSessionExpectation,
        now: Instant,
    ): MailSessionBindingDecision {
        if (!isExactNonBlank(expectation.principalId) ||
            !isExactNonBlank(expectation.accountId) ||
            !isExactNonBlank(expectation.audience)
        ) {
            return MailSessionBindingDecision.InvalidExpectation
        }

        proof ?: return MailSessionBindingDecision.MissingProof

        if (!isExactNonBlank(proof.principalId) ||
            !isExactNonBlank(proof.accountId) ||
            !isExactNonBlank(proof.audience) ||
            !proof.issuedAt.isBefore(proof.expiresAt)
        ) {
            return MailSessionBindingDecision.InvalidProof
        }

        if (proof.principalId != expectation.principalId) {
            return MailSessionBindingDecision.PrincipalMismatch
        }
        if (proof.accountId != expectation.accountId) {
            return MailSessionBindingDecision.AccountMismatch
        }
        if (proof.audience != expectation.audience) {
            return MailSessionBindingDecision.AudienceMismatch
        }
        if (now.isBefore(proof.issuedAt)) {
            return MailSessionBindingDecision.NotYetValid
        }
        if (!now.isBefore(proof.expiresAt)) {
            return MailSessionBindingDecision.Expired
        }

        return MailSessionBindingDecision.Bound(
            principalId = proof.principalId,
            accountId = proof.accountId,
            expiresAt = proof.expiresAt,
        )
    }

    private fun isExactNonBlank(value: String): Boolean =
        value.isNotBlank() && value == value.trim() && value.none(Char::isISOControl)
}

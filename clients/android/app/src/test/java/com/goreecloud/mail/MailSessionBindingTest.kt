package com.goreecloud.mail

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MailSessionBindingTest {
    private val now = Instant.parse("2026-09-13T18:00:00Z")
    private val expectation = MailSessionExpectation(
        principalId = "user-42",
        accountId = "provider/account 7",
    )

    private fun proof(
        principalId: String = expectation.principalId,
        accountId: String = expectation.accountId,
        audience: String = MailSessionExpectation.ANDROID_MAIL_AUDIENCE,
        issuedAt: Instant = now.minusSeconds(60),
        expiresAt: Instant = now.plusSeconds(600),
    ) = MailSessionProof(
        principalId = principalId,
        accountId = accountId,
        audience = audience,
        issuedAt = issuedAt,
        expiresAt = expiresAt,
    )

    @Test
    fun missingProofFailsClosed() {
        assertEquals(
            MailSessionBindingDecision.MissingProof,
            MailSessionBindingPolicy.evaluate(null, expectation, now),
        )
    }

    @Test
    fun exactOpaqueAccountIdentityIsPreserved() {
        val decision = MailSessionBindingPolicy.evaluate(proof(), expectation, now)
        assertTrue(decision is MailSessionBindingDecision.Bound)
        decision as MailSessionBindingDecision.Bound
        assertEquals("provider/account 7", decision.accountId)
        assertEquals("user-42", decision.principalId)
    }

    @Test
    fun trimmedOrControlBearingIdentityIsRejectedRatherThanNormalized() {
        assertEquals(
            MailSessionBindingDecision.InvalidProof,
            MailSessionBindingPolicy.evaluate(proof(accountId = " provider/account 7"), expectation, now),
        )
        assertEquals(
            MailSessionBindingDecision.InvalidProof,
            MailSessionBindingPolicy.evaluate(proof(principalId = "user-42\n"), expectation, now),
        )
    }

    @Test
    fun principalAccountAndAudienceMustMatchExactly() {
        assertEquals(
            MailSessionBindingDecision.PrincipalMismatch,
            MailSessionBindingPolicy.evaluate(proof(principalId = "user-41"), expectation, now),
        )
        assertEquals(
            MailSessionBindingDecision.AccountMismatch,
            MailSessionBindingPolicy.evaluate(proof(accountId = "provider/account 8"), expectation, now),
        )
        assertEquals(
            MailSessionBindingDecision.AudienceMismatch,
            MailSessionBindingPolicy.evaluate(proof(audience = "goreecloud-mail-web"), expectation, now),
        )
    }

    @Test
    fun invalidOrFutureLifetimeFailsClosed() {
        assertEquals(
            MailSessionBindingDecision.InvalidProof,
            MailSessionBindingPolicy.evaluate(
                proof(issuedAt = now, expiresAt = now),
                expectation,
                now,
            ),
        )
        assertEquals(
            MailSessionBindingDecision.NotYetValid,
            MailSessionBindingPolicy.evaluate(
                proof(issuedAt = now.plusSeconds(1), expiresAt = now.plusSeconds(600)),
                expectation,
                now,
            ),
        )
    }

    @Test
    fun expiryIsExclusiveAndFailsClosed() {
        assertEquals(
            MailSessionBindingDecision.Expired,
            MailSessionBindingPolicy.evaluate(proof(expiresAt = now), expectation, now),
        )
    }

    @Test
    fun malformedExpectationCannotBeUsedAsAuthority() {
        assertEquals(
            MailSessionBindingDecision.InvalidExpectation,
            MailSessionBindingPolicy.evaluate(
                proof(),
                expectation.copy(accountId = " provider/account 7"),
                now,
            ),
        )
    }
}

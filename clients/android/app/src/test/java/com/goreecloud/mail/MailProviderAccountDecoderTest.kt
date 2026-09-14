package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MailProviderAccountDecoderTest {
    private fun accountObject(): Map<String, Any?> = linkedMapOf(
        "id" to "acct-1",
        "provider" to "gmail",
        "externalAccountId" to null,
        "displayName" to "Personal",
        "createdAt" to "2026-09-14T08:00:00-05:00",
    )

    @Test
    fun exactAccountListShapeDecodes() {
        val result = MailProviderAccountDecoder.decodeAccountList(
            mapOf("accounts" to listOf(accountObject())),
        )
        assertTrue(result is MailProviderDecodeResult.Accepted)
        val envelope = (result as MailProviderDecodeResult.Accepted).value
        assertEquals("acct-1", envelope.accounts.single().id)
        assertEquals(null, envelope.accounts.single().externalAccountId)
    }

    @Test
    fun unknownOrMissingAccountFieldsFailClosed() {
        val unknown = accountObject() + ("accessToken" to "secret")
        val unknownResult = MailProviderAccountDecoder.decodeAccountList(
            mapOf("accounts" to listOf(unknown)),
        )
        assertTrue(unknownResult is MailProviderDecodeResult.Rejected)

        val missing = accountObject().toMutableMap().apply { remove("createdAt") }
        val missingResult = MailProviderAccountDecoder.decodeAccountList(
            mapOf("accounts" to listOf(missing)),
        )
        assertTrue(missingResult is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun ownerAndCredentialFieldsNeverDecodeAsPublicAccountData() {
        for (field in listOf("userId", "password", "accessToken", "refreshToken", "sessionCookie")) {
            val result = MailProviderAccountDecoder.decodeAccountDetail(
                mapOf("account" to (accountObject() + (field to "forbidden"))),
            )
            assertTrue("$field should be rejected", result is MailProviderDecodeResult.Rejected)
        }
    }

    @Test
    fun accountFieldTypesAreNotCoerced() {
        val numericId = accountObject().toMutableMap().apply { put("id", 42) }
        assertTrue(
            MailProviderAccountDecoder.decodeAccountDetail(mapOf("account" to numericId))
                is MailProviderDecodeResult.Rejected,
        )

        val booleanDisplayName = accountObject().toMutableMap().apply { put("displayName", true) }
        assertTrue(
            MailProviderAccountDecoder.decodeAccountDetail(mapOf("account" to booleanDisplayName))
                is MailProviderDecodeResult.Rejected,
        )
    }

    @Test
    fun capabilitiesRequireExactVocabularyAndBooleanValues() {
        val full = MailProviderAccountContract.CAPABILITY_NAMES.associateWith { false }
        val accepted = MailProviderAccountDecoder.decodeCapabilities(
            mapOf("accountId" to "acct-1", "provider" to "gmail", "capabilities" to full),
        )
        assertTrue(accepted is MailProviderDecodeResult.Accepted)

        val incomplete = MailProviderAccountDecoder.decodeCapabilities(
            mapOf(
                "accountId" to "acct-1",
                "provider" to "gmail",
                "capabilities" to mapOf("mailboxAccess" to true),
            ),
        )
        assertTrue(incomplete is MailProviderDecodeResult.Rejected)

        val coerced = full.toMutableMap<String, Any?>().apply { put("mailboxAccess", "true") }
        val coercedResult = MailProviderAccountDecoder.decodeCapabilities(
            mapOf("accountId" to "acct-1", "provider" to "gmail", "capabilities" to coerced),
        )
        assertTrue(coercedResult is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun topLevelUnknownAndMissingFieldsFailClosed() {
        assertTrue(
            MailProviderAccountDecoder.decodeAccountList(
                mapOf("accounts" to emptyList<Any>(), "userId" to "owner"),
            ) is MailProviderDecodeResult.Rejected,
        )
        assertTrue(
            MailProviderAccountDecoder.decodeCapabilities(
                mapOf("accountId" to "acct-1", "capabilities" to emptyMap<String, Boolean>()),
            ) is MailProviderDecodeResult.Rejected,
        )
    }

    @Test
    fun decodedDataStillRequiresSemanticAcceptance() {
        val raw = mapOf("account" to accountObject().toMutableMap().apply { put("createdAt", "not-a-time") })
        val decoded = MailProviderAccountDecoder.decodeAccountDetail(raw)
        assertTrue(decoded is MailProviderDecodeResult.Accepted)
        val envelope = (decoded as MailProviderDecodeResult.Accepted).value
        assertTrue(
            MailProviderAccountContract.acceptAccount("acct-1", envelope)
                is MailProviderAccountDecision.Rejected,
        )
    }
}

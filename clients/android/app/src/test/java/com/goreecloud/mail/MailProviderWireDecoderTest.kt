package com.goreecloud.mail

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class MailProviderWireDecoderTest {
    private fun accountMap(
        id: Any? = "account-1",
        provider: Any? = "gmail",
        externalAccountId: Any? = "alice@example.test",
        displayName: Any? = "Alice",
        createdAt: Any? = "2026-09-14T01:00:00Z",
    ): Map<String, Any?> = linkedMapOf(
        "id" to id,
        "provider" to provider,
        "externalAccountId" to externalAccountId,
        "displayName" to displayName,
        "createdAt" to createdAt,
    )

    private fun capabilityMap(value: Any? = false): Map<String, Any?> =
        MailProviderResponseContract.KNOWN_CAPABILITIES.associateWith { value }

    @Test
    fun exactAccountListDecodesAndPassesResponsePolicy() {
        val result = MailProviderWireDecoder.decodeAccounts(
            mapOf("accounts" to listOf(accountMap(), accountMap(id = "account-2"))),
        )

        assertTrue(result is MailProviderDecodeResult.Accepted)
        val envelope = (result as MailProviderDecodeResult.Accepted).value
        assertEquals(2, envelope.accounts.size)
        assertEquals("account-1", envelope.accounts.first().id)
    }

    @Test
    fun unknownTopLevelAndNestedFieldsFailBeforeTrust() {
        val topLevel = MailProviderWireDecoder.decodeAccounts(
            mapOf(
                "accounts" to listOf(accountMap()),
                "accessToken" to "secret",
            ),
        )
        assertTrue(topLevel is MailProviderDecodeResult.Rejected)

        val nested = MailProviderWireDecoder.decodeAccounts(
            mapOf(
                "accounts" to listOf(accountMap() + ("userId" to "user-1")),
            ),
        )
        assertTrue(nested is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun missingAccountFieldsAndTypeCoercionAreRejected() {
        val missing = accountMap().toMutableMap().also { it.remove("createdAt") }
        assertTrue(
            MailProviderWireDecoder.decodeAccounts(
                mapOf("accounts" to listOf(missing)),
            ) is MailProviderDecodeResult.Rejected,
        )

        assertTrue(
            MailProviderWireDecoder.decodeAccounts(
                mapOf("accounts" to listOf(accountMap(id = 123))),
            ) is MailProviderDecodeResult.Rejected,
        )
        assertTrue(
            MailProviderWireDecoder.decodeAccounts(
                mapOf("accounts" to listOf(accountMap(displayName = true))),
            ) is MailProviderDecodeResult.Rejected,
        )
    }

    @Test
    fun nullablePublicAccountFieldsRemainExplicitlyNullable() {
        val result = MailProviderWireDecoder.decodeAccounts(
            mapOf(
                "accounts" to listOf(
                    accountMap(externalAccountId = null, displayName = null),
                ),
            ),
        )

        assertTrue(result is MailProviderDecodeResult.Accepted)
        val account = (result as MailProviderDecodeResult.Accepted).value.accounts.single()
        assertEquals(null, account.externalAccountId)
        assertEquals(null, account.displayName)
    }

    @Test
    fun accountDetailMustMatchRequestedOpaqueIdentity() {
        val accepted = MailProviderWireDecoder.decodeAccount(
            expectedAccountId = "account-1",
            payload = mapOf("account" to accountMap()),
        )
        assertTrue(accepted is MailProviderDecodeResult.Accepted)

        val mismatch = MailProviderWireDecoder.decodeAccount(
            expectedAccountId = "account-2",
            payload = mapOf("account" to accountMap()),
        )
        assertTrue(mismatch is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun capabilitiesRequireExactFieldsAndActualBooleans() {
        val accepted = MailProviderWireDecoder.decodeCapabilities(
            expectedAccountId = "account-1",
            payload = mapOf(
                "accountId" to "account-1",
                "provider" to "gmail",
                "capabilities" to capabilityMap(false),
            ),
        )
        assertTrue(accepted is MailProviderDecodeResult.Accepted)

        val truthyString = MailProviderWireDecoder.decodeCapabilities(
            expectedAccountId = "account-1",
            payload = mapOf(
                "accountId" to "account-1",
                "provider" to "gmail",
                "capabilities" to capabilityMap("false"),
            ),
        )
        assertTrue(truthyString is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun missingOrExtraCapabilityKeysFailClosed() {
        val missing = capabilityMap().toMutableMap().also { it.remove("messageRead") }
        val missingResult = MailProviderWireDecoder.decodeCapabilities(
            "account-1",
            mapOf(
                "accountId" to "account-1",
                "provider" to "gmail",
                "capabilities" to missing,
            ),
        )
        assertTrue(missingResult is MailProviderDecodeResult.Rejected)

        val extra = capabilityMap().toMutableMap().also { it["rawCredentialAccess"] = false }
        val extraResult = MailProviderWireDecoder.decodeCapabilities(
            "account-1",
            mapOf(
                "accountId" to "account-1",
                "provider" to "gmail",
                "capabilities" to extra,
            ),
        )
        assertTrue(extraResult is MailProviderDecodeResult.Rejected)
    }

    @Test
    fun malformedSemanticValuesStillPassThroughResponsePolicyAndFail() {
        val invalidTimestamp = MailProviderWireDecoder.decodeAccounts(
            mapOf("accounts" to listOf(accountMap(createdAt = "not-an-instant"))),
        )
        assertTrue(invalidTimestamp is MailProviderDecodeResult.Rejected)

        val capabilityAccountMismatch = MailProviderWireDecoder.decodeCapabilities(
            expectedAccountId = "account-1",
            payload = mapOf(
                "accountId" to "account-2",
                "provider" to "gmail",
                "capabilities" to capabilityMap(),
            ),
        )
        assertTrue(capabilityAccountMismatch is MailProviderDecodeResult.Rejected)
    }
}

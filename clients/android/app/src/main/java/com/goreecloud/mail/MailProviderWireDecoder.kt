package com.goreecloud.mail

sealed interface MailProviderDecodeResult<out T> {
    data class Accepted<T>(val value: T) : MailProviderDecodeResult<T>
    data class Rejected(val reason: String) : MailProviderDecodeResult<Nothing>
}

/**
 * Exact-field, transport-neutral decoder for already-parsed Mail provider response objects.
 *
 * This object intentionally does not parse JSON, perform I/O, authenticate a session, or accept
 * credentials. A future transport/parser may supply generic Kotlin maps/lists only after its own
 * byte/encoding/size limits. Unknown fields, missing fields, wrong scalar types, and string/boolean
 * coercion are rejected before trusted wire models are constructed.
 */
object MailProviderWireDecoder {
    fun decodeAccounts(payload: Any?): MailProviderDecodeResult<MailProviderAccountsEnvelope> {
        val root = stringKeyedObject(payload) ?: return reject("accounts payload must be an object")
        exactFields(root, MailProviderResponseContract.ACCOUNTS_TOP_LEVEL_FIELDS)?.let { return reject(it) }

        val rawAccounts = root["accounts"] as? List<*>
            ?: return reject("accounts must be an array")
        val accounts = ArrayList<MailProviderAccountWire>(rawAccounts.size)
        rawAccounts.forEachIndexed { index, rawAccount ->
            when (val decoded = decodeAccountRecord(rawAccount)) {
                is MailProviderDecodeResult.Accepted -> accounts += decoded.value
                is MailProviderDecodeResult.Rejected -> return reject("account[$index]: ${decoded.reason}")
            }
        }

        val envelope = MailProviderAccountsEnvelope(accounts)
        return when (val decision = MailProviderResponseContract.acceptAccounts(envelope)) {
            is MailProviderResponseDecision.Accepted -> MailProviderDecodeResult.Accepted(envelope)
            is MailProviderResponseDecision.Rejected -> reject("response policy: ${decision.reason}")
        }
    }

    fun decodeAccount(
        expectedAccountId: String,
        payload: Any?,
    ): MailProviderDecodeResult<MailProviderAccountEnvelope> {
        val root = stringKeyedObject(payload) ?: return reject("account payload must be an object")
        exactFields(root, MailProviderResponseContract.ACCOUNT_TOP_LEVEL_FIELDS)?.let { return reject(it) }

        val account = when (val decoded = decodeAccountRecord(root["account"])) {
            is MailProviderDecodeResult.Accepted -> decoded.value
            is MailProviderDecodeResult.Rejected -> return reject(decoded.reason)
        }
        val envelope = MailProviderAccountEnvelope(account)
        return when (val decision = MailProviderResponseContract.acceptAccount(expectedAccountId, envelope)) {
            is MailProviderResponseDecision.Accepted -> MailProviderDecodeResult.Accepted(envelope)
            is MailProviderResponseDecision.Rejected -> reject("response policy: ${decision.reason}")
        }
    }

    fun decodeCapabilities(
        expectedAccountId: String,
        payload: Any?,
    ): MailProviderDecodeResult<MailProviderCapabilitiesEnvelope> {
        val root = stringKeyedObject(payload) ?: return reject("capabilities payload must be an object")
        exactFields(root, MailProviderResponseContract.CAPABILITIES_TOP_LEVEL_FIELDS)?.let { return reject(it) }

        val accountId = root["accountId"] as? String
            ?: return reject("accountId must be a string")
        val provider = root["provider"] as? String
            ?: return reject("provider must be a string")
        val rawCapabilities = stringKeyedObject(root["capabilities"])
            ?: return reject("capabilities must be an object")

        if (rawCapabilities.keys != MailProviderResponseContract.KNOWN_CAPABILITIES) {
            val missing = MailProviderResponseContract.KNOWN_CAPABILITIES - rawCapabilities.keys
            val extra = rawCapabilities.keys - MailProviderResponseContract.KNOWN_CAPABILITIES
            return reject("capability field set mismatch: missing=$missing extra=$extra")
        }

        val capabilities = LinkedHashMap<String, Boolean>(rawCapabilities.size)
        rawCapabilities.forEach { (key, value) ->
            if (value !is Boolean) return reject("capability $key must be a boolean")
            capabilities[key] = value
        }

        val envelope = MailProviderCapabilitiesEnvelope(
            accountId = accountId,
            provider = provider,
            capabilities = capabilities,
        )
        return when (val decision = MailProviderResponseContract.acceptCapabilities(expectedAccountId, envelope)) {
            is MailProviderResponseDecision.Accepted -> MailProviderDecodeResult.Accepted(envelope)
            is MailProviderResponseDecision.Rejected -> reject("response policy: ${decision.reason}")
        }
    }

    private fun decodeAccountRecord(payload: Any?): MailProviderDecodeResult<MailProviderAccountWire> {
        val account = stringKeyedObject(payload) ?: return reject("account must be an object")
        exactFields(account, MailProviderResponseContract.ACCOUNT_FIELDS)?.let { return reject(it) }

        val id = account["id"] as? String ?: return reject("id must be a string")
        val provider = account["provider"] as? String ?: return reject("provider must be a string")
        val createdAt = account["createdAt"] as? String ?: return reject("createdAt must be a string")

        val externalAccountId = when (val value = account["externalAccountId"]) {
            null -> null
            is String -> value
            else -> return reject("externalAccountId must be a string or null")
        }
        val displayName = when (val value = account["displayName"]) {
            null -> null
            is String -> value
            else -> return reject("displayName must be a string or null")
        }

        return MailProviderDecodeResult.Accepted(
            MailProviderAccountWire(
                id = id,
                provider = provider,
                externalAccountId = externalAccountId,
                displayName = displayName,
                createdAt = createdAt,
            ),
        )
    }

    private fun stringKeyedObject(value: Any?): Map<String, Any?>? {
        if (value !is Map<*, *>) return null
        val result = LinkedHashMap<String, Any?>(value.size)
        value.forEach { (key, fieldValue) ->
            if (key !is String || result.containsKey(key)) return null
            result[key] = fieldValue
        }
        return result
    }

    private fun exactFields(
        value: Map<String, Any?>,
        expected: Set<String>,
    ): String? {
        val actual = value.keys
        if (actual == expected) return null
        val missing = expected - actual
        val extra = actual - expected
        return "field set mismatch: missing=$missing extra=$extra"
    }

    private fun reject(reason: String): MailProviderDecodeResult.Rejected =
        MailProviderDecodeResult.Rejected(reason)
}

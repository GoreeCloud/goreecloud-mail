package com.goreecloud.mail

sealed interface MailProviderDecodeResult<out T> {
    data class Accepted<T>(val value: T) : MailProviderDecodeResult<T>
    data class Rejected(val reason: String) : MailProviderDecodeResult<Nothing>
}

/**
 * Exact-field decoder for already-parsed trusted Mail API response objects.
 *
 * This decoder deliberately accepts generic in-memory maps rather than a JSON/network library.
 * It rejects missing, unknown, duplicate-by-shape, mistyped, or non-Boolean capability values
 * before constructing the typed transport-neutral models used by MailProviderAccountContract.
 */
object MailProviderAccountDecoder {
    fun decodeAccountList(raw: Map<String, Any?>): MailProviderDecodeResult<MailProviderAccountsEnvelope> {
        exactFields(raw, MailProviderAccountContract.ACCOUNT_LIST_FIELDS)?.let { return reject(it) }
        val accountsRaw = raw["accounts"] as? List<*> ?: return reject("accounts must be a list")
        val accounts = ArrayList<MailProviderAccountWire>(accountsRaw.size)
        accountsRaw.forEachIndexed { index, item ->
            val objectValue = item.asStringMap() ?: return reject("accounts[$index] must be an object")
            when (val decoded = decodeAccountObject(objectValue)) {
                is MailProviderDecodeResult.Accepted -> accounts += decoded.value
                is MailProviderDecodeResult.Rejected -> return reject("accounts[$index]: ${decoded.reason}")
            }
        }
        return accept(MailProviderAccountsEnvelope(accounts))
    }

    fun decodeAccountDetail(raw: Map<String, Any?>): MailProviderDecodeResult<MailProviderAccountEnvelope> {
        exactFields(raw, MailProviderAccountContract.ACCOUNT_DETAIL_FIELDS)?.let { return reject(it) }
        val accountRaw = raw["account"].asStringMap() ?: return reject("account must be an object")
        return when (val decoded = decodeAccountObject(accountRaw)) {
            is MailProviderDecodeResult.Accepted -> accept(MailProviderAccountEnvelope(decoded.value))
            is MailProviderDecodeResult.Rejected -> reject("account: ${decoded.reason}")
        }
    }

    fun decodeCapabilities(raw: Map<String, Any?>): MailProviderDecodeResult<MailProviderCapabilitiesEnvelope> {
        exactFields(raw, MailProviderAccountContract.CAPABILITY_TOP_LEVEL_FIELDS)?.let { return reject(it) }
        val accountId = raw["accountId"] as? String ?: return reject("accountId must be a string")
        val provider = raw["provider"] as? String ?: return reject("provider must be a string")
        val capabilitiesRaw = raw["capabilities"].asStringMap() ?: return reject("capabilities must be an object")
        if (capabilitiesRaw.keys != MailProviderAccountContract.CAPABILITY_NAMES) {
            return reject("capability fields must exactly match the canonical vocabulary")
        }
        val capabilities = LinkedHashMap<String, Boolean>(capabilitiesRaw.size)
        for ((name, value) in capabilitiesRaw) {
            val enabled = value as? Boolean ?: return reject("capability $name must be Boolean")
            capabilities[name] = enabled
        }
        return accept(MailProviderCapabilitiesEnvelope(accountId, provider, capabilities))
    }

    private fun decodeAccountObject(raw: Map<String, Any?>): MailProviderDecodeResult<MailProviderAccountWire> {
        exactFields(raw, MailProviderAccountContract.ACCOUNT_FIELDS)?.let { return reject(it) }
        val id = raw["id"] as? String ?: return reject("id must be a string")
        val provider = raw["provider"] as? String ?: return reject("provider must be a string")
        val externalAccountId = nullableStringField(raw, "externalAccountId") ?: return reject("externalAccountId must be string or null")
        val displayName = nullableStringField(raw, "displayName") ?: return reject("displayName must be string or null")
        val createdAt = raw["createdAt"] as? String ?: return reject("createdAt must be a string")
        return accept(
            MailProviderAccountWire(
                id = id,
                provider = provider,
                externalAccountId = externalAccountId.value,
                displayName = displayName.value,
                createdAt = createdAt,
            ),
        )
    }

    private data class NullableString(val value: String?)

    private fun nullableStringField(raw: Map<String, Any?>, name: String): NullableString? {
        if (!raw.containsKey(name)) return null
        val value = raw[name]
        return when (value) {
            null -> NullableString(null)
            is String -> NullableString(value)
            else -> null
        }
    }

    private fun exactFields(raw: Map<String, Any?>, allowed: Set<String>): String? {
        val actual = raw.keys
        val unknown = actual - allowed
        if (unknown.isNotEmpty()) return "unknown fields: ${unknown.sorted().joinToString(",")}" 
        val missing = allowed - actual
        if (missing.isNotEmpty()) return "missing fields: ${missing.sorted().joinToString(",")}" 
        return null
    }

    private fun Any?.asStringMap(): Map<String, Any?>? {
        val map = this as? Map<*, *> ?: return null
        if (map.keys.any { it !is String }) return null
        @Suppress("UNCHECKED_CAST")
        return map as Map<String, Any?>
    }

    private fun <T> accept(value: T): MailProviderDecodeResult.Accepted<T> =
        MailProviderDecodeResult.Accepted(value)

    private fun reject(reason: String): MailProviderDecodeResult.Rejected =
        MailProviderDecodeResult.Rejected(reason)
}

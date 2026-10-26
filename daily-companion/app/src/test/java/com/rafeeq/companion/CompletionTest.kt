package com.rafeeq.companion

import com.rafeeq.companion.data.AppSettings
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.ai.Completion
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetSocketAddress

/**
 * الطلبات المفردة تتبع المزوّد الفعّال.
 *
 * كانت كلّها تنادي Anthropic مباشرةً: الموجز الصباحي، وخطّة اليوم،
 * واستخراج المهام. فمن بدّل إلى Grok أو Gemini ووضع مفتاحه هناك، كانت
 * هذه المزايا ترسل إلى Anthropic بمفتاح فارغ فتفشل بـ«المفتاح غير صالح» —
 * ويظنّ أن مفتاحه الجديد خاطئ. وهذا ما يُثبت أن الطلب يذهب حيث يجب.
 */
class CompletionTest {

    private class Fake(private val reply: String, private val status: Int = 200) {
        val seen = mutableListOf<JsonObject>()
        val auth = mutableListOf<String>()
        val paths = mutableListOf<String>()
        private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val port: Int get() = server.address.port

        init {
            server.createContext("/") { exchange ->
                paths += exchange.requestURI.path
                auth += exchange.requestHeaders.getFirst("Authorization").orEmpty()
                val body = exchange.requestBody.readBytes().decodeToString()
                if (body.isNotBlank()) seen += Json.parseToJsonElement(body).jsonObject
                val payload = reply.toByteArray()
                exchange.sendResponseHeaders(status, payload.size.toLong())
                exchange.responseBody.use { it.write(payload) }
            }
            server.start()
        }

        fun stop() = server.stop(0)
    }

    private fun settings(port: Int) = AppSettings(
        provider = "custom",
        providerKeys = mapOf("custom" to "grok-key-123"),
        providerModels = mapOf("custom" to "test-model"),
        providerUrls = mapOf("custom" to "http://127.0.0.1:$port/v1"),
    )

    @Test
    fun `المزوّد المتوافق يُنادى بعنوانه ومفتاحه هو لا Anthropic`() = runBlocking {
        val fake = Fake("""{"choices":[{"message":{"role":"assistant","content":"تمّ"}}]}""")
        try {
            val completion = Completion(
                settingsOf = { settings(fake.port) },
                // لو نُودي هذا لفشل الاختبار بعنوان Anthropic الحقيقي.
                claude = ClaudeClient { "مفتاح-أنثروبيك" },
            )
            val out = completion.text(system = "نظام", user = "سؤال")

            assertEquals("تمّ", out)
            assertEquals("/v1/chat/completions", fake.paths.single())
            assertEquals("مفتاح المزوّد المختار لا غيره", "Bearer grok-key-123", fake.auth.single())

            val body = fake.seen.single()
            assertEquals("test-model", body["model"]?.jsonPrimitive?.content)
            val messages = body["messages"]!!.jsonArray
            assertEquals(2, messages.size)
            assertEquals("system", messages[0].jsonObject["role"]?.jsonPrimitive?.content)
            assertEquals("نظام", messages[0].jsonObject["content"]?.jsonPrimitive?.content)
            assertEquals("user", messages[1].jsonObject["role"]?.jsonPrimitive?.content)
            assertEquals("سؤال", messages[1].jsonObject["content"]?.jsonPrimitive?.content)
            // max_tokens غائب عمدًا: بعض المزوّدين يرفضه وبعضهم يسمّيه غير ذلك.
            assertTrue("بلا max_tokens", body["max_tokens"] == null)
        } finally {
            fake.stop()
        }
    }

    @Test
    fun `خطأ المزوّد يصل برسالته هو لا بنصّ عامّ`() = runBlocking {
        val fake = Fake("""{"error":{"message":"Invalid API Key"}}""", status = 401)
        try {
            val completion = Completion({ settings(fake.port) }, ClaudeClient { "x" })
            val error = runCatching { completion.text("نظام", "سؤال") }.exceptionOrNull()
            assertTrue("يُرمى عند الفشل", error != null)
            assertTrue("وفيه رسالة المزوّد", error!!.message!!.contains("Invalid API Key"))
            assertTrue("ورمز الحالة", error.message!!.contains("401"))
        } finally {
            fake.stop()
        }
    }

    @Test
    fun `ردّ بلا محتوى يعيد نصًّا فارغًا لا ينهار`() = runBlocking {
        val fake = Fake("""{"choices":[]}""")
        try {
            val completion = Completion({ settings(fake.port) }, ClaudeClient { "x" })
            assertEquals("", completion.text("نظام", "سؤال"))
        } finally {
            fake.stop()
        }
    }
}

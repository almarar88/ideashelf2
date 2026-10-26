package com.rafeeq.companion

import com.rafeeq.companion.data.ai.AgentRunner
import com.rafeeq.companion.data.ai.OpenAiRunner
import com.rafeeq.companion.data.ai.Provider
import com.rafeeq.companion.data.ai.Providers
import com.rafeeq.companion.data.control.ActionResult
import com.rafeeq.companion.data.control.ToolSpec
import com.sun.net.httpserver.HttpServer
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetSocketAddress

/**
 * محوّل الواجهة المتوافقة، مُختبَرًا على خادم حقيقي يتكلّم بروتوكول البثّ نفسه.
 *
 * الجزء الهشّ ليس بناء الطلب بل تجميع استدعاءات الأدوات: تصل مجزّأة، والاسم
 * والوسائط مقطّعان، وتُجمَّع بالفهرس لا بترتيب الوصول. قراءة الكود لا تُثبت
 * هذا؛ خادم يقطّع الأجزاء عمدًا يُثبته. ونفس الحالات مُختبَرة في نسخة ويندوز.
 */
class OpenAiRunnerTest {

    private val xai = Providers.byId("xai")

    /** خادم يردّ بأحداث SSE معطاة ويسجّل أجسام الطلبات. */
    private class Fake(private val replies: (Int) -> List<String>) {
        val seen = mutableListOf<JsonObject>()
        private val server: HttpServer = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        val port: Int get() = server.address.port

        init {
            server.createContext("/chat/completions") { exchange ->
                val body = exchange.requestBody.readBytes().decodeToString()
                seen += Json.parseToJsonElement(body).jsonObject
                val payload = buildString {
                    for (chunk in replies(seen.size)) append("data: ").append(chunk).append("\n\n")
                    append("data: [DONE]\n\n")
                }.toByteArray()
                exchange.sendResponseHeaders(200, payload.size.toLong())
                exchange.responseBody.use { it.write(payload) }
            }
            server.start()
        }

        fun stop() = server.stop(0)
    }

    private fun spec(name: String) = ToolSpec(
        name = name,
        description = "أداة اختبار",
        schema = buildJsonObject { put("type", "object"); putJsonObject("properties") {} },
    )

    private fun tools(name: String) = buildJsonArray {
        add(buildJsonObject {
            put("name", name)
            put("description", "أداة اختبار")
            put("input_schema", buildJsonObject {
                put("type", "object"); putJsonObject("properties") {}
            })
        })
    }

    @Test
    fun `الأدوات تُترجم وأدوات الخادم تُسقَط`() {
        val input = buildJsonArray {
            add(buildJsonObject {
                put("name", "open_app")
                put("description", "يفتح")
                put("input_schema", buildJsonObject { put("type", "object") })
            })
            // أداة البحث: بلا مخطّط، ولا مقابل لها هنا.
            add(buildJsonObject { put("type", "web_search_20260209"); put("name", "web_search") })
        }
        val out = OpenAiRunner.toolsToOpenAi(input)
        assertEquals(1, out.size)
        assertEquals("function", out[0].jsonObject["type"]?.jsonPrimitive?.content)
        assertEquals(
            "open_app",
            out[0].jsonObject["function"]?.jsonObject?.get("name")?.jsonPrimitive?.content,
        )
    }

    @Test
    fun `الصورة لا تُرسل بل يُقال إنها غير مدعومة`() {
        val withImage = OpenAiRunner.toolResult(
            "c1", ActionResult(true, "لقطة", "التقطت الشاشة", imageBase64 = "AAAABBBB"),
        )
        val content = withImage["content"]?.jsonPrimitive?.content.orEmpty()
        assertFalse("بيانات الصورة يجب ألّا تُرسل", content.contains("AAAABBBB"))
        assertTrue(content.contains("غير مدعومة"))
        assertEquals("tool", withImage["role"]?.jsonPrimitive?.content)
        assertEquals("c1", withImage["tool_call_id"]?.jsonPrimitive?.content)
    }

    @Test
    fun `استدعاء الأداة يُجمَّع من أجزائه ثم يُنفَّذ`() = runBlocking {
        val fake = Fake { call ->
            if (call == 1) listOf(
                """{"choices":[{"delta":{"content":"أفتح "}}]}""",
                """{"choices":[{"delta":{"content":"المتصفّح."}}]}""",
                // الاسم والوسائط مقطّعان على أربعة أجزاء.
                """{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_9","function":{"name":"open_"}}]}}]}""",
                """{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"name":"app"}}]}}]}""",
                """{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"na"}}]}}]}""",
                """{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"me\":\"chrome\"}"}}]}}]}""",
                """{"choices":[{"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":11,"completion_tokens":4}}""",
            ) else listOf(
                """{"choices":[{"delta":{"content":"فتحته."},"finish_reason":"stop"}]}""",
            )
        }

        val runner = OpenAiRunner({ "k" }, { "http://127.0.0.1:${fake.port}" })
        val history = mutableListOf<JsonObject>(
            buildJsonObject { put("role", "user"); put("content", "افتح المتصفّح") },
        )
        val events = mutableListOf<AgentRunner.Event>()
        val executed = mutableListOf<AgentRunner.ToolCall>()

        runner.run(
            provider = xai, model = "grok-4.7", system = "كن مختصرًا",
            history = history, tools = tools("open_app"),
            specOf = { spec(it) },
            confirm = { _, _ -> true },
            execute = { call -> executed += call; ActionResult(true, "فُتح", "تمّ فتح chrome") },
            emit = { events += it },
        )
        fake.stop()

        assertEquals(1, executed.size)
        assertEquals("open_app", executed[0].name)
        assertEquals("call_9", executed[0].id)
        assertEquals("chrome", executed[0].input["name"]?.jsonPrimitive?.content)

        val text = events.filterIsInstance<AgentRunner.Event.Text>().joinToString("") { it.delta }
        assertEquals("أفتح المتصفّح.فتحته.", text)
        assertTrue(events.any { it is AgentRunner.Event.ToolFinished })
        assertTrue(events.any { it is AgentRunner.Event.Usage && it.input == 11L })

        // تعليمات النظام رسالة أولى، لا حقلًا مستقلًّا.
        val first = fake.seen[0]["messages"]!!.jsonArray
        assertEquals("system", first[0].jsonObject["role"]?.jsonPrimitive?.content)
        assertEquals("كن مختصرًا", first[0].jsonObject["content"]?.jsonPrimitive?.content)

        // الدور الثاني: ردّ المساعد ثم نتيجة الأداة بالترتيب.
        val second = fake.seen[1]["messages"]!!.jsonArray
        val assistant = second[second.size - 2].jsonObject
        assertEquals("assistant", assistant["role"]?.jsonPrimitive?.content)
        assertNotNull(assistant["tool_calls"])
        val toolMessage = second[second.size - 1].jsonObject
        assertEquals("tool", toolMessage["role"]?.jsonPrimitive?.content)
        assertEquals("call_9", toolMessage["tool_call_id"]?.jsonPrimitive?.content)
    }

    @Test
    fun `الرفض يُعاد كنتيجة ولا تُنفَّذ الأداة`() = runBlocking {
        val fake = Fake { call ->
            if (call == 1) listOf(
                """{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"wipe","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}""",
            ) else listOf("""{"choices":[{"delta":{"content":"ما سويت شي."},"finish_reason":"stop"}]}""")
        }
        val runner = OpenAiRunner({ "k" }, { "http://127.0.0.1:${fake.port}" })
        val events = mutableListOf<AgentRunner.Event>()
        var ran = false

        runner.run(
            provider = xai, model = "m", system = "s",
            history = mutableListOf(buildJsonObject { put("role", "user"); put("content", "امسح") }),
            tools = tools("wipe"),
            specOf = { spec(it) },
            confirm = { _, _ -> false },
            execute = { ran = true; ActionResult(true, "", "") },
            emit = { events += it },
        )
        fake.stop()

        assertFalse("الأداة المرفوضة يجب ألّا تُنفَّذ", ran)
        assertTrue(events.any { it is AgentRunner.Event.ToolDenied })
    }

    @Test
    fun `خطأ المزوّد يصل مترجمًا باسمه لا خامًا`() = runBlocking {
        val server = HttpServer.create(InetSocketAddress("127.0.0.1", 0), 0)
        server.createContext("/chat/completions") { exchange ->
            val body = """{"error":{"message":"Incorrect API key provided"}}""".toByteArray()
            exchange.sendResponseHeaders(401, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }
        server.start()

        val runner = OpenAiRunner({ "bad" }, { "http://127.0.0.1:${server.address.port}" })
        val events = mutableListOf<AgentRunner.Event>()
        runner.run(
            provider = xai, model = "m", system = "s",
            history = mutableListOf(buildJsonObject { put("role", "user"); put("content", "مرحبا") }),
            tools = buildJsonArray { },
            specOf = { spec(it) },
            confirm = { _, _ -> true },
            execute = { ActionResult(true, "", "") },
            emit = { events += it },
        )
        server.stop(0)

        val failed = events.filterIsInstance<AgentRunner.Event.Failed>().firstOrNull()
        assertNotNull("يجب أن يصل حدث فشل", failed)
        assertTrue("يجب أن يُسمّى المزوّد", failed!!.message.contains("xAI"))
        assertFalse("لا نصّ إنجليزي خام", failed.message.contains("Incorrect"))
    }

    @Test
    fun `سجلّ المزوّدين مكتمل ومتّسق`() {
        val ids = Providers.all.map { it.id }
        for (needed in listOf("anthropic", "xai", "google", "openai")) {
            assertTrue("ناقص: $needed", ids.contains(needed))
        }
        for (one in Providers.all) {
            assertTrue(one.label.isNotBlank() && one.note.isNotBlank())
            assertTrue(one.models.isNotEmpty())
            // العنوان الفارغ مسموح للمخصّص وحده، وهو قابل للتحرير.
            if (one.baseUrl.isBlank()) assertTrue("${one.id} بلا عنوان", one.editableUrl)
        }
        assertEquals(Provider.Kind.OPENAI, Providers.byId("xai").kind)
        assertEquals("anthropic", Providers.byId("لا يوجد").id, )
    }

    /*
     * الردود أدناه منسوخة حرفيًا من ردود حقيقية طُلبت من كل مزوّد بمفتاح
     * باطل. كُتبت أوّل مرّة على افتراض أن الجميع يردّ 401 بصيغة OpenAI —
     * وهو افتراض خاطئ: xAI وGoogle يردّان 400 بصياغتهما الخاصّة، فكان
     * المستخدم يرى إنجليزيةً خامًا. هذه الحالات تمنع عودة ذلك.
     */
    @Test
    fun `مفتاح مرفوض يُقرأ بصيغة كل مزوّد لا بصيغة واحدة`() {
        val cases = mapOf(
            "xai" to "400: Incorrect API key provided. You can obtain an API key from " +
                "https://console.x.ai.",
            "google" to "400: Please pass a valid API key",
            "openai" to "401: Incorrect API key provided: sk-inval****robe.",
            "groq" to "401: Invalid API Key",
            "openrouter" to "401: Missing Authentication header",
        )
        for ((id, body) in cases) {
            val provider = Providers.byId(id)
            val message = OpenAiRunner.friendly(IllegalStateException(body), provider)
            assertEquals(
                "ردّ $id يجب أن يُقرأ كمفتاح غير صالح",
                "مفتاح ${provider.label} غير صالح.",
                message,
            )
        }
    }

    /**
     * استثناء بلا رسالة يعني خطأً برمجيًا، لا انقطاع شبكة.
     *
     * كان يُترجم إلى «تعذّر الوصول إلى المزوّد»، فظهر عطلُ خيطٍ رئيسي في
     * شاشة الإعدادات على أنه مشكلة إنترنت لدى كل مزوّد على حدة — وهي رسالة
     * تدفع المستخدم لتغيير مفتاحه بينما العطل في التطبيق.
     */
    @Test
    fun `الاستثناء بلا رسالة لا يُقدَّم كعطل شبكة`() {
        val message = OpenAiRunner.friendly(IllegalStateException(), Providers.byId("xai"))
        assertFalse("ما يصح يُلام الاتصال", message.contains("اتصال"))
        assertFalse("ولا يُلام الوصول للمزوّد", message.contains("تعذّر الوصول"))
        assertTrue("يذكر أنه خطأ داخلي", message.contains("خطأ داخلي"))
    }

    @Test
    fun `النموذج المجهول يُحيل إلى جلب النماذج لا إلى الإعدادات`() {
        val message = OpenAiRunner.friendly(
            IllegalStateException("404: The model `gpt-5.2` does not exist"),
            Providers.byId("openai"),
        )
        assertTrue(message.contains("اجلب النماذج"))
    }

    /**
     * لا معرّف نموذج مخترع في السجلّ.
     *
     * `gemini-3.8-flash` و`gpt-5.2` كانا مكتوبَين هنا ولا وجود لهما، فكان
     * المزوّدان يفشلان دائمًا مهما كان المفتاح صحيحًا.
     */
    @Test
    fun `لا معرّفات نماذج ملغاة في السجلّ`() {
        val retired = setOf("gemini-3.8-flash", "gpt-5.2", "gemini-2.0-flash")
        for (provider in Providers.all) {
            for (model in provider.models) {
                assertFalse(
                    "معرّف ملغى في ${provider.id}: ${model.id}",
                    model.id in retired,
                )
            }
        }
    }
}

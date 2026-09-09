package com.rafeeq.companion.notify

import android.content.Context
import com.rafeeq.companion.RafeeqApp
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.ai.ControlPrompt
import com.rafeeq.companion.data.control.ToolCatalog
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * ينفّذ روتينًا خارج الواجهة.
 *
 * التنفيذ هنا مقصود بلا شاشة: الروتين يعمل والهاتف في الجيب. لذلك:
 *  • بلا أدوات حسّاسة تحتاج تأكيدًا — لا أحد أمام الشاشة ليؤكّد.
 *  • بمهلة قصوى، حتى لا تعلق العملية إن تعذّرت الشبكة.
 *  • النتيجة تصل كإشعار، فيعرف المستخدم ما جرى دون أن يفتح شيئًا.
 */
object RoutineRunner {

    private const val TIMEOUT_MS = 90_000L
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * [pending] هو نتيجة `goAsync()` من المستقبِل: بدونه قد يُقتل الإجراء
     * بمجرد انتهاء `onReceive` فلا يكتمل الطلب. نُنهيه في كل الحالات.
     */
    fun run(
        context: Context,
        label: String,
        prompt: String,
        pending: android.content.BroadcastReceiver.PendingResult? = null,
    ) {
        val app = context.applicationContext as? RafeeqApp
        if (app == null) {
            pending?.finish()
            return
        }

        scope.launch {
            val text = withTimeoutOrNull(TIMEOUT_MS) { execute(app, prompt) }
                ?: "تعذّر إكمال الروتين في الوقت المتاح."

            Notifier.show(
                context = context,
                id = 600 + label.hashCode().and(0xFF),
                channel = Channels.TASKS,
                title = "⏰ $label",
                body = text.take(400),
                big = true,
            )
            runCatching { pending?.finish() }
        }
    }

    private suspend fun execute(app: RafeeqApp, prompt: String): String {
        val settings = app.repos.settings.settings.first()
        if (!settings.hasApiKey) return "الروتين يحتاج مفتاح Anthropic."

        val capabilities = app.repos.phone.availableCapabilities()
        val system = Assistant.stableSystem(
            persona = settings.aiPersona,
            control = if (settings.controlEnabled) {
                ControlPrompt.instructions(voiceMode = false, missing = emptyList())
            } else "",
            dialect = settings.dialect,
            webSearch = settings.webSearch,
        ) + BACKGROUND_RULE

        val history = mutableListOf(
            buildJsonObject {
                put("role", "user")
                put("content", prompt)
            } as JsonObject,
        )

        val builder = StringBuilder()
        runCatching {
            app.repos.agent.run(
                model = settings.effectiveModel,
                system = system,
                history = history,
                tools = if (settings.controlEnabled) ToolCatalog.toJson(capabilities)
                else JsonArray(emptyList()),
                effort = settings.effectiveEffort,
                maxTurns = 8,
                specOf = { ToolCatalog.byName(it) },
                // لا أحد أمام الشاشة ليوافق، فالأوامر الحسّاسة تُرفض بدل أن تُنفَّذ بصمت.
                confirm = { _, _ -> false },
                execute = { call -> app.repos.phone.execute(call.name, call.input) },
            ) { event ->
                if (event is com.rafeeq.companion.data.ai.AgentRunner.Event.Text) {
                    builder.append(event.delta)
                }
            }
        }

        return builder.toString().trim().ifBlank { "نُفِّذ الروتين." }
    }

    private const val BACKGROUND_RULE = """

<تنفيذ_تلقائي>
هذا روتين مجدول يعمل والهاتف في جيب المستخدم، ولا أحد يقرأ ردّك الآن.
اجعل الرد سطرين على الأكثر يلخّصان ما فعلته أو ما وجدته.
لا تسأل أسئلة ولا تنتظر ردًا — لن يصلك.
</تنفيذ_تلقائي>
"""
}

package com.rafeeq.companion.data.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.Locale

/**
 * محرّك الصوت: يحوّل كلام المستخدم إلى نص، ويقرأ رد المساعد بصوت عربي.
 *
 * يعتمد على `SpeechRecognizer` و`TextToSpeech` المدمجين في أندرويد،
 * فلا يحتاج أي خدمة خارجية ولا يرفع الصوت إلى خوادمنا — التعرّف يتم
 * عبر محرّك النظام (غالبًا Google) والنص فقط هو ما يصل إلى المساعد.
 */
class VoiceEngine(private val context: Context) {

    /** حالة الاستماع كما تعرضها الواجهة. */
    enum class State { IDLE, LISTENING, PROCESSING, SPEAKING }

    private val _state = MutableStateFlow(State.IDLE)
    val state: StateFlow<State> = _state.asStateFlow()

    /** مستوى الصوت من ٠ إلى ١ — يحرّك الموجة في الواجهة. */
    private val _amplitude = MutableStateFlow(0f)
    val amplitude: StateFlow<Float> = _amplitude.asStateFlow()

    /** النص أثناء التعرّف عليه. */
    private val _partial = MutableStateFlow("")
    val partial: StateFlow<String> = _partial.asStateFlow()

    private var recognizer: SpeechRecognizer? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var arabicAvailable = true

    private var onFinal: ((String) -> Unit)? = null
    private var onError: ((String) -> Unit)? = null
    private var onDoneSpeaking: (() -> Unit)? = null

    /**
     * النطق الواقعي بأصوات ElevenLabs.
     *
     * يُنشأ كسولًا ولا يعمل إلا إذا ضبط المستخدم مفتاحًا وصوتًا. حين لا يكون
     * مضبوطًا — أو يفشل نداء — يبقى صوت النظام هو المسار، فلا يصمت المساعد.
     */
    private var realistic: RealisticSpeaker? = null

    /** آخر خطأ صوت واقعي، ليعرضه المستخدم بدل أن يتساءل عن سبب الصوت الآلي. */
    private val _voiceError = MutableStateFlow("")
    val voiceError: StateFlow<String> = _voiceError.asStateFlow()

    /**
     * يضبط الصوت الواقعي. [apiKey] فارغ أو [voiceId] فارغ يعني إيقافه
     * والعودة إلى صوت النظام.
     */
    fun configureRealisticVoice(
        apiKey: String,
        voiceId: String,
        modelId: String,
        stability: Float,
        similarity: Float,
        speed: Float,
        cacheDir: java.io.File,
    ) {
        if (apiKey.isBlank() || voiceId.isBlank()) {
            realistic?.release()
            realistic = null
            return
        }
        RealisticSpeaker.attachContext(context)
        val speaker = realistic ?: RealisticSpeaker(
            cacheDir = cacheDir,
            // الجملة التي فشل نطقها واقعيًا تُقال بصوت النظام فورًا.
            onFallback = { sentence ->
                runCatching { tts?.speak(sentence, TextToSpeech.QUEUE_ADD, null, "fallback-" + System.nanoTime()) }
            },
            onStateChange = { speaking ->
                _state.value = if (speaking) State.SPEAKING else State.IDLE
            },
            onError = { message -> _voiceError.value = message },
        ).also { realistic = it }

        speaker.config = RealisticSpeaker.Config(
            apiKey = apiKey,
            settings = ElevenLabs.SpeechSettings(
                voiceId = voiceId,
                modelId = modelId,
                stability = stability,
                similarity = similarity,
                speed = speed,
            ),
        )
    }

    /** هل النطق يجري بصوت واقعي الآن؟ */
    val usingRealisticVoice: Boolean get() = realistic?.isConfigured == true

    val isRecognitionAvailable: Boolean
        get() = SpeechRecognizer.isRecognitionAvailable(context)

    /** هل عثرنا على صوت عربي للقراءة؟ */
    val hasArabicVoice: Boolean get() = arabicAvailable

    // ------------------------------------------------- الاستماع عبر Scribe

    private var recorder: android.media.MediaRecorder? = null
    private var recordFile: java.io.File? = null

    /** إعدادات التفريغ عبر ElevenLabs، أو null لاستعمال محرّك النظام. */
    @Volatile
    private var scribe: Pair<String, String>? = null

    /** [apiKey] فارغ يعني العودة إلى محرّك النظام. */
    fun configureScribe(apiKey: String, languageCode: String) {
        scribe = if (apiKey.isBlank()) null else apiKey to languageCode
    }

    val usingScribe: Boolean get() = scribe != null

    /**
     * يبدأ تسجيلًا للتفريغ عبر Scribe.
     *
     * نسجّل بأنفسنا بدل SpeechRecognizer لأن الأخير يعيد نصًّا من محرّك
     * النظام — دقّته في اللهجات العربية أضعف بوضوح من Scribe، ولا يعطينا
     * الصوت الخام لنرسله لغيره.
     */
    fun startScribeRecording(): Boolean {
        val target = java.io.File(context.cacheDir, "speech-${System.currentTimeMillis()}.m4a")
        return runCatching {
            RealisticSpeaker.attachContext(context)
            recorder = RealisticSpeaker.startRecording(target)
            recordFile = target
            _state.value = State.LISTENING
            true
        }.getOrElse { error ->
            _state.value = State.IDLE
            onError?.invoke(
                if (error is SecurityException) "صلاحية الميكروفون مرفوضة."
                else "تعذّر بدء التسجيل.",
            )
            false
        }
    }

    /** يوقف التسجيل ويفرّغه. يستدعي [onResult] بالنصّ أو [onFailure] بالسبب. */
    suspend fun stopScribeRecording(
        onResult: (String) -> Unit,
        onFailure: (String) -> Unit,
    ) {
        val active = recorder
        val file = recordFile
        recorder = null
        recordFile = null
        runCatching { active?.stop() }
        runCatching { active?.release() }

        if (file == null || !file.exists()) {
            _state.value = State.IDLE
            onFailure("ما في تسجيل.")
            return
        }

        _state.value = State.PROCESSING
        val credentials = scribe
        if (credentials == null) {
            _state.value = State.IDLE
            onFailure("التفريغ الدقيق غير مضبوط.")
            return
        }

        runCatching { ElevenLabs.transcribe(credentials.first, file, credentials.second) }
            .onSuccess { text ->
                _state.value = State.IDLE
                // نحذف التسجيل فور تفريغه: صوت المستخدم لا يبقى على القرص.
                runCatching { file.delete() }
                if (text.isBlank()) onFailure("ما سمعت شيئًا — جرّب مرّة ثانية.")
                else onResult(text)
            }
            .onFailure { error ->
                _state.value = State.IDLE
                runCatching { file.delete() }
                onFailure(ElevenLabs.friendly(error))
            }
    }

    /** يُلغي تسجيلًا جاريًا بلا تفريغ. */
    fun cancelScribeRecording() {
        runCatching { recorder?.stop() }
        runCatching { recorder?.release() }
        recorder = null
        runCatching { recordFile?.delete() }
        recordFile = null
        if (_state.value == State.LISTENING) _state.value = State.IDLE
    }

    // ------------------------------------------------------------ الاستماع

    fun startListening(
        languageTag: String = "ar-AE",
        onResult: (String) -> Unit,
        onFailure: (String) -> Unit,
    ) {
        if (!isRecognitionAvailable) {
            onFailure("خدمة التعرّف على الكلام غير متاحة على هذا الجهاز.")
            return
        }
        stopSpeaking()
        onFinal = onResult
        onError = onFailure
        _partial.value = ""

        recognizer?.destroy()
        recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
            setRecognitionListener(listener)
        }

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(
                RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                RecognizerIntent.LANGUAGE_MODEL_FREE_FORM,
            )
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, languageTag)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, languageTag)
            // نسمح بالعربية والإنجليزية معًا لأن الكلام اليومي يخلط بينهما.
            putExtra(
                RecognizerIntent.EXTRA_SUPPORTED_LANGUAGES,
                arrayListOf(languageTag, "en-US"),
            )
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            // النموذج المحلي يتعثّر في اللهجات؛ نفضّل التعرّف المتصل حين يتوفّر.
            putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, false)
            // صمت أطول قبل القطع: الجملة العربية المحكية تتخللها وقفات،
            // والقطع المبكر كان يبتر نصف الأمر.
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L)
            putExtra(
                RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS,
                1200L,
            )
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1500L)
        }

        runCatching {
            recognizer?.startListening(intent)
            _state.value = State.LISTENING
        }.onFailure {
            _state.value = State.IDLE
            onFailure("تعذّر بدء الاستماع: ${it.message}")
        }
    }

    fun stopListening() {
        runCatching { recognizer?.stopListening() }
        if (_state.value == State.LISTENING) _state.value = State.PROCESSING
    }

    fun cancel() {
        runCatching { recognizer?.cancel() }
        _amplitude.value = 0f
        _partial.value = ""
        _state.value = State.IDLE
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {
            _state.value = State.LISTENING
        }

        override fun onBeginningOfSpeech() = Unit

        override fun onRmsChanged(rmsdB: Float) {
            // المدى العملي تقريبًا من ‎-2‎ إلى ‎10‎ ديسيبل.
            _amplitude.value = ((rmsdB + 2f) / 12f).coerceIn(0f, 1f)
        }

        override fun onBufferReceived(buffer: ByteArray?) = Unit

        override fun onEndOfSpeech() {
            _amplitude.value = 0f
            _state.value = State.PROCESSING
        }

        override fun onError(error: Int) {
            _amplitude.value = 0f
            _state.value = State.IDLE
            val message = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH,
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "لم أسمع شيئًا. حاول مرة أخرى."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "أذن للتطبيق باستخدام الميكروفون."
                SpeechRecognizer.ERROR_NETWORK,
                SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "تعذّر الاتصال بخدمة التعرّف على الكلام."
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "المتعرّف مشغول، أعد المحاولة."
                else -> "تعذّر التعرّف على الكلام."
            }
            onError?.invoke(message)
        }

        override fun onResults(results: Bundle?) {
            _amplitude.value = 0f
            val text = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                ?.trim()
                .orEmpty()
            _partial.value = ""
            if (text.isBlank()) {
                _state.value = State.IDLE
                onError?.invoke("لم أفهم ما قلته. حاول مرة أخرى.")
            } else {
                _state.value = State.PROCESSING
                onFinal?.invoke(text)
            }
        }

        override fun onPartialResults(partialResults: Bundle?) {
            partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                ?.let { _partial.value = it }
        }

        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    // ------------------------------------------------------------ النطق

    /**
     * يهيّئ النطق بلغة محدّدة.
     *
     * ملاحظة صادقة: محرّكات أندرويد العربية لا تملك صوتًا إماراتيًا مستقلًا
     * في الغالب. نطلب ar-AE فإن لم يوجد ننزل إلى ar-SA ثم ar. اللهجة تظهر
     * في **الكلمات** التي يكتبها المساعد، أما اللكنة فتبقى تابعة لمحرّك الجهاز.
     */
    fun prepareTts(languageTag: String = "ar-AE", onReady: (Boolean) -> Unit = {}) {
        if (ttsReady) {
            applyLanguage(languageTag)
            onReady(true)
            return
        }
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                applyLanguage(languageTag)
                tts?.setSpeechRate(speechRate)
                tts?.setPitch(1.0f)
                tts?.setOnUtteranceProgressListener(utteranceListener)
            }
            onReady(ttsReady)
        }
    }

    /** سرعة القراءة — أسرع قليلًا من الافتراضي يجعل الرد يبدو أرشق. */
    var speechRate: Float = 1.05f
        set(value) {
            field = value.coerceIn(0.6f, 1.8f)
            runCatching { tts?.setSpeechRate(field) }
        }

    private fun applyLanguage(languageTag: String) {
        val engine = tts ?: return
        val candidates = candidateLocales(languageTag)
        var chosen: Locale? = null
        for (locale in candidates) {
            val result = runCatching { engine.setLanguage(locale) }.getOrNull() ?: continue
            if (result != TextToSpeech.LANG_MISSING_DATA && result != TextToSpeech.LANG_NOT_SUPPORTED) {
                chosen = locale
                break
            }
        }
        arabicAvailable = chosen != null
        if (chosen == null) {
            runCatching { engine.setLanguage(Locale.getDefault()) }
            return
        }
        // من بين أصوات نفس اللغة نختار الأعلى جودة وغير المحدود بالشبكة.
        runCatching {
            engine.voices
                ?.filter { it.locale.language == chosen.language && !it.isNetworkConnectionRequired }
                ?.maxByOrNull { voice ->
                    val exact = if (voice.locale.country == chosen.country) 1000 else 0
                    exact + voice.quality
                }
                ?.let { engine.voice = it }
        }
    }

    /** ar-AE ← ar-SA ← ar: أول لغة متاحة تفوز. */
    private fun candidateLocales(tag: String): List<Locale> {
        val requested = runCatching { Locale.forLanguageTag(tag) }.getOrNull()
        return listOfNotNull(
            requested,
            Locale("ar", "AE"),
            Locale("ar", "SA"),
            Locale("ar"),
        ).distinctBy { it.toLanguageTag() }
    }

    private val utteranceListener = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
            _state.value = State.SPEAKING
        }

        override fun onDone(utteranceId: String?) {
            // في النطق المتدفّق تتوالى عدة نطقات؛ الأخيرة وحدها تُنهي الدور.
            if (utteranceId?.startsWith(FINAL_PREFIX) != false) {
                _state.value = State.IDLE
                onDoneSpeaking?.invoke()
                onDoneSpeaking = null
            }
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
            _state.value = State.IDLE
            onDoneSpeaking?.invoke()
            onDoneSpeaking = null
        }
    }

    // -------------------------------------------------- النطق المتدفّق

    private val streamBuffer = StringBuilder()
    private var streamStarted = false

    /**
     * يبدأ نطقًا متدفّقًا: يُقرأ الرد جملةً جملةً أثناء وصوله بدل انتظار اكتماله.
     *
     * هذا هو الفارق الأوضح في الإحساس بالسرعة — الانتظار حتى آخر حرف قبل
     * بدء الكلام يجعل ردًا من ثلاث جمل يبدو أبطأ بثلاث مرات مما هو عليه.
     */
    fun beginStreamSpeech(languageTag: String = "ar-AE") {
        streamBuffer.setLength(0)
        streamStarted = false
        onDoneSpeaking = null
        runCatching { tts?.stop() }
        // نُهيّئ صوت النظام دائمًا حتى لو كان الواقعي مضبوطًا: هو شبكة
        // الأمان حين يفشل نداء ElevenLabs في منتصف الرد.
        prepareTts(languageTag)
        realistic?.takeIf { it.isConfigured }?.begin()
    }

    /** يضيف جزءًا جديدًا من الرد، وينطق ما اكتمل منه من جمل. */
    fun pushStreamSpeech(delta: String) {
        streamBuffer.append(delta)
        while (true) {
            val cut = sentenceEnd(streamBuffer) ?: break
            val sentence = streamBuffer.substring(0, cut)
            streamBuffer.delete(0, cut)
            enqueueChunk(sentence, final = false)
        }
    }

    /** ينطق ما تبقّى ويستدعي [onDone] بعد آخر كلمة. */
    fun endStreamSpeech(onDone: (() -> Unit)? = null) {
        onDoneSpeaking = onDone
        val rest = streamBuffer.toString()
        streamBuffer.setLength(0)

        val speaker = realistic
        if (speaker != null && speaker.isConfigured) {
            enqueueChunk(rest, final = true)
            speaker.finish {
                onDoneSpeaking = null
                onDone?.invoke()
            }
            return
        }

        if (!enqueueChunk(rest, final = true) && !streamStarted) {
            // لا شيء يُنطق أصلًا.
            onDoneSpeaking = null
            onDone?.invoke()
        }
    }

    /** يُرجع موضع نهاية أول جملة مكتملة، أو null إن لم تكتمل بعد. */
    private fun sentenceEnd(text: CharSequence): Int? {
        val minimum = 18
        for (i in text.indices) {
            if (i + 1 < minimum) continue
            val c = text[i]
            if (c == '.' || c == '؟' || c == '?' || c == '!' || c == '\n' || c == '؛') {
                return i + 1
            }
        }
        // جملة طويلة بلا علامة ترقيم: نقطعها عند فاصلة بعد طول معقول
        // حتى لا يبقى المستخدم في صمت.
        if (text.length > 160) {
            val comma = text.indexOf('،', 60)
            if (comma in 60..159) return comma + 1
        }
        return null
    }

    private fun enqueueChunk(raw: String, final: Boolean): Boolean {
        val clean = stripForSpeech(raw)
        if (clean.isBlank()) return false

        val speaker = realistic
        if (speaker != null && speaker.isConfigured) {
            speaker.enqueue(clean)
            streamStarted = true
            return true
        }
        val id = (if (final) FINAL_PREFIX else "part-") + System.nanoTime()
        val mode = if (streamStarted) TextToSpeech.QUEUE_ADD else TextToSpeech.QUEUE_FLUSH
        streamStarted = true
        runCatching { tts?.speak(clean, mode, null, id) }
        return true
    }

    /** يقرأ النص بصوت عالٍ. [onDone] تُستدعى عند الانتهاء. */
    fun speak(text: String, languageTag: String = "ar-AE", onDone: (() -> Unit)? = null) {
        val clean = stripForSpeech(text)
        if (clean.isBlank()) { onDone?.invoke(); return }
        onDoneSpeaking = onDone
        streamStarted = false

        if (!ttsReady) {
            prepareTts(languageTag) { ready ->
                if (ready) enqueueChunk(clean, final = true) else onDone?.invoke()
            }
        } else {
            enqueueChunk(clean, final = true)
        }
    }

    fun stopSpeaking() {
        realistic?.stop()
        runCatching { tts?.stop() }
        streamBuffer.setLength(0)
        streamStarted = false
        onDoneSpeaking = null
        if (_state.value == State.SPEAKING) _state.value = State.IDLE
    }

    /**
     * ينظّف النص قبل نطقه: يزيل رموز الماركداون والروابط الطويلة والرموز التعبيرية،
     * لأن قراءتها حرفيًا تُفسد التجربة.
     */
    internal fun stripForSpeech(text: String): String = Companion.stripForSpeech(text)

    companion object {
        private const val FINAL_PREFIX = "final-"

        internal fun stripForSpeech(text: String): String = text
        .replace(Regex("```[\\s\\S]*?```"), " ")
        .replace(Regex("`([^`]*)`"), "$1")
        .replace(Regex("\\*\\*([^*]*)\\*\\*"), "$1")
        .replace(Regex("(?m)^#{1,6}\\s*"), "")
        .replace(Regex("(?m)^[-*•]\\s*"), "")
        .replace(Regex("https?://\\S+"), "رابط")
        .replace(
            Regex("[\\p{So}\\p{Cn}\\uFE0F\\u200D]"),
            " ",
        )
        .replace(Regex("[ \\t]+"), " ")
            .replace(Regex("\n{2,}"), "\n")
            .trim()
    }

    fun release() {
        cancelScribeRecording()
        realistic?.release()
        realistic = null
        runCatching { recognizer?.destroy() }
        runCatching { tts?.stop(); tts?.shutdown() }
        recognizer = null
        tts = null
        ttsReady = false
        _state.value = State.IDLE
    }
}

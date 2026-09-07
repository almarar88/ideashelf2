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

    val isRecognitionAvailable: Boolean
        get() = SpeechRecognizer.isRecognitionAvailable(context)

    /** هل عثرنا على صوت عربي للقراءة؟ */
    val hasArabicVoice: Boolean get() = arabicAvailable

    // ------------------------------------------------------------ الاستماع

    fun startListening(
        languageTag: String = "ar-SA",
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
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1500L)
            putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 1200L)
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

    fun prepareTts(onReady: (Boolean) -> Unit = {}) {
        if (ttsReady) { onReady(true); return }
        tts = TextToSpeech(context) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                val result = runCatching {
                    tts?.setLanguage(Locale("ar"))
                }.getOrNull()
                arabicAvailable = result != TextToSpeech.LANG_MISSING_DATA &&
                    result != TextToSpeech.LANG_NOT_SUPPORTED
                if (!arabicAvailable) runCatching { tts?.setLanguage(Locale.getDefault()) }
                tts?.setSpeechRate(1.0f)
                tts?.setPitch(1.0f)
                tts?.setOnUtteranceProgressListener(utteranceListener)
            }
            onReady(ttsReady)
        }
    }

    private val utteranceListener = object : UtteranceProgressListener() {
        override fun onStart(utteranceId: String?) {
            _state.value = State.SPEAKING
        }

        override fun onDone(utteranceId: String?) {
            _state.value = State.IDLE
            onDoneSpeaking?.invoke()
        }

        @Deprecated("Deprecated in Java")
        override fun onError(utteranceId: String?) {
            _state.value = State.IDLE
            onDoneSpeaking?.invoke()
        }
    }

    /** يقرأ النص بصوت عالٍ. [onDone] تُستدعى عند الانتهاء. */
    fun speak(text: String, onDone: (() -> Unit)? = null) {
        val clean = stripForSpeech(text)
        if (clean.isBlank()) { onDone?.invoke(); return }
        onDoneSpeaking = onDone

        if (!ttsReady) {
            prepareTts { ready ->
                if (ready) enqueue(clean) else onDone?.invoke()
            }
        } else {
            enqueue(clean)
        }
    }

    private fun enqueue(text: String) {
        runCatching {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "rafeeq-${System.nanoTime()}")
        }.onFailure { onDoneSpeaking?.invoke() }
    }

    fun stopSpeaking() {
        runCatching { tts?.stop() }
        if (_state.value == State.SPEAKING) _state.value = State.IDLE
    }

    /**
     * ينظّف النص قبل نطقه: يزيل رموز الماركداون والروابط الطويلة والرموز التعبيرية،
     * لأن قراءتها حرفيًا تُفسد التجربة.
     */
    internal fun stripForSpeech(text: String): String = Companion.stripForSpeech(text)

    companion object {
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
        runCatching { recognizer?.destroy() }
        runCatching { tts?.stop(); tts?.shutdown() }
        recognizer = null
        tts = null
        ttsReady = false
        _state.value = State.IDLE
    }
}

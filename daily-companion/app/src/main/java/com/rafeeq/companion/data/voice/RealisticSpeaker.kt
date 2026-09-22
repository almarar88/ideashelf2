package com.rafeeq.companion.data.voice

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.os.Build
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import java.io.File
import kotlin.coroutines.resume

/**
 * النطق الواقعي بأصوات ElevenLabs، والتسجيل للتفريغ.
 *
 * طابور متسلسل لا نداءات متوازية: النطق المتدفّق يرسل جملة بعد جملة، وتشغيلها
 * فور وصولها يعني جملتين تتكلّمان معًا. الطابور يُبقي الترتيب ويُبقي الكلام
 * متّصلًا.
 *
 * وكل فشل يسقط إلى صوت النظام عبر [onFallback] بدل أن يصمت المساعد: انقطاع
 * شبكة أو نفاد رصيد يجب أن يُسمع بصوت آلي، لا أن يُفقد الرد.
 */
class RealisticSpeaker(
    private val cacheDir: File,
    private val onFallback: (String) -> Unit,
    private val onStateChange: (speaking: Boolean) -> Unit,
    private val onError: (String) -> Unit,
) {

    data class Config(
        val apiKey: String,
        val settings: ElevenLabs.SpeechSettings,
    )

    @Volatile
    var config: Config? = null

    val isConfigured: Boolean
        get() = config?.let { it.apiKey.isNotBlank() && it.settings.voiceId.isNotBlank() } == true

    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.Main + job)
    private var queue: Channel<String>? = null
    private var worker: Job? = null
    private var player: MediaPlayer? = null

    /** يبدأ دورة نطق جديدة ويُلغي ما قبلها. */
    fun begin() {
        stop()
        val channel = Channel<String>(Channel.UNLIMITED)
        queue = channel
        worker = scope.launch {
            for (sentence in channel) {
                val current = config ?: continue
                val file = runCatching {
                    ElevenLabs.speak(current.apiKey, sentence, current.settings, cacheDir)
                }.getOrElse { error ->
                    onError(ElevenLabs.friendly(error))
                    // لا نصمت: نُسمع الجملة بصوت النظام ونكمل.
                    onFallback(sentence)
                    null
                } ?: continue
                play(file)
            }
        }
    }

    /** يضيف جملة إلى الطابور. تُنظَّف هنا مرّة واحدة لا في كل مُنادٍ. */
    fun enqueue(raw: String) {
        val clean = Speakable.clean(raw)
        if (clean.isBlank()) return
        queue?.trySend(clean)
    }

    /** يُغلق الطابور: ما فيه يُنطق ثم ينتهي الدور. */
    fun finish(onDone: (() -> Unit)? = null) {
        val channel = queue ?: run { onDone?.invoke(); return }
        channel.close()
        scope.launch {
            worker?.join()
            onStateChange(false)
            onDone?.invoke()
        }
    }

    fun stop() {
        queue?.close()
        queue = null
        worker?.cancel()
        worker = null
        runCatching {
            player?.stop()
            player?.release()
        }
        player = null
        onStateChange(false)
    }

    fun release() {
        stop()
        job.cancel()
    }

    private suspend fun play(file: File) = suspendCancellableCoroutine { cont ->
        val media = MediaPlayer().apply {
            setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            setDataSource(file.absolutePath)
            setOnCompletionListener {
                runCatching { it.release() }
                if (cont.isActive) cont.resume(Unit)
            }
            setOnErrorListener { mp, _, _ ->
                runCatching { mp.release() }
                if (cont.isActive) cont.resume(Unit)
                true
            }
        }
        player = media
        onStateChange(true)
        runCatching { media.prepare(); media.start() }.onFailure {
            runCatching { media.release() }
            if (cont.isActive) cont.resume(Unit)
        }
        cont.invokeOnCancellation { runCatching { media.release() } }
    }

    companion object {
        /**
         * يبدأ تسجيلًا للتفريغ.
         *
         * AAC داخل MPEG-4: مدعوم على كل إصدارات أندرويد المستهدَفة، وحجمه
         * جزء يسير من WAV — والتسجيل يُرفع عبر شبكة الهاتف.
         */
        fun startRecording(target: File): MediaRecorder {
            @Suppress("DEPRECATION")
            val recorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                MediaRecorder(androidContextless())
            } else {
                MediaRecorder()
            }
            return recorder.apply {
                setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                // ١٦ كيلوهرتز أحادي: ما تتوقّعه نماذج التفريغ، وأصغر من
                // ٤٤.١ بثلاث مرات بلا أي خسارة في دقّة الكلام.
                setAudioSamplingRate(16_000)
                setAudioChannels(1)
                setAudioEncodingBitRate(32_000)
                setOutputFile(target.absolutePath)
                prepare()
                start()
            }
        }

        /**
         * MediaRecorder على أندرويد ١٢+ يطلب سياقًا. نمرّره من المُنادي عبر
         * [contextHolder]؛ هذه الدالة موجودة لتبقى توقيعات الاستدعاء بسيطة.
         */
        @Volatile
        private var contextHolder: android.content.Context? = null

        fun attachContext(context: android.content.Context) {
            contextHolder = context.applicationContext
        }

        private fun androidContextless(): android.content.Context =
            contextHolder ?: error("لم يُربط سياق التطبيق قبل التسجيل")
    }
}

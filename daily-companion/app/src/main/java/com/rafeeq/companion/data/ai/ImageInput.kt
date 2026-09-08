package com.rafeeq.companion.data.ai

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.exifinterface.media.ExifInterface
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.ByteArrayOutputStream
import java.io.File

/**
 * تجهيز الصور التي يُريها المستخدم للمساعد.
 *
 * الصورة الخام من كاميرا حديثة تتجاوز ١٢ ميجابكسل وعدة ميجابايت؛ إرسالها
 * كما هي يبطئ الطلب ويضاعف كلفته بلا فائدة — النموذج لا يستفيد من التفاصيل
 * فوق حدّ معيّن. لذلك نصغّرها ونضغطها ونصحّح دورانها قبل الإرسال.
 */
object ImageInput {

    /** أقصى ضلع بالبكسل. أعلى من ذلك لا يزيد الدقة عمليًا. */
    private const val MAX_SIDE = 1400
    private const val QUALITY = 82

    /** يحفظ صورة المستخدم داخل التطبيق ويعيد مسارها. */
    suspend fun store(context: Context, source: Uri): String? = withContext(Dispatchers.IO) {
        runCatching {
            val bitmap = decode(context, source) ?: return@runCatching null
            val dir = File(context.filesDir, "images").apply { mkdirs() }
            val file = File(dir, "img_${System.currentTimeMillis()}.jpg")
            file.outputStream().use { out ->
                bitmap.compress(Bitmap.CompressFormat.JPEG, QUALITY, out)
            }
            file.absolutePath
        }.getOrNull()
    }

    /** يقرأ صورة محفوظة ويحوّلها إلى base64 كما تتوقّعها الواجهة. */
    suspend fun encode(path: String): String? = withContext(Dispatchers.IO) {
        runCatching {
            val file = File(path)
            if (!file.exists()) return@runCatching null
            Base64.encodeToString(file.readBytes(), Base64.NO_WRAP)
        }.getOrNull()
    }

    /** يحذف صور محادثة حُذفت — وإلا تراكمت في التخزين بلا مالك. */
    fun delete(path: String?) {
        if (path.isNullOrBlank()) return
        runCatching { File(path).delete() }
    }

    private fun decode(context: Context, uri: Uri): Bitmap? {
        // قياس أولي بلا تحميل، ثم تحميل مصغّر — يتفادى نفاد الذاكرة على الصور الكبيرة.
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, bounds)
        }
        if (bounds.outWidth <= 0) return null

        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > MAX_SIDE * 2) sample *= 2

        val options = BitmapFactory.Options().apply { inSampleSize = sample }
        val decoded = context.contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, options)
        } ?: return null

        val scale = MAX_SIDE.toFloat() / maxOf(decoded.width, decoded.height)
        val sized = if (scale < 1f) {
            Bitmap.createScaledBitmap(
                decoded,
                (decoded.width * scale).toInt().coerceAtLeast(1),
                (decoded.height * scale).toInt().coerceAtLeast(1),
                true,
            )
        } else decoded

        return rotate(context, uri, sized)
    }

    /** صور الكاميرا تُحفظ غالبًا بدوران في البيانات الوصفية لا في البكسل. */
    private fun rotate(context: Context, uri: Uri, bitmap: Bitmap): Bitmap = runCatching {
        val degrees = context.contentResolver.openInputStream(uri)?.use { stream ->
            when (
                ExifInterface(stream).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                )
            ) {
                ExifInterface.ORIENTATION_ROTATE_90 -> 90f
                ExifInterface.ORIENTATION_ROTATE_180 -> 180f
                ExifInterface.ORIENTATION_ROTATE_270 -> 270f
                else -> 0f
            }
        } ?: 0f
        if (degrees == 0f) return bitmap
        val matrix = android.graphics.Matrix().apply { postRotate(degrees) }
        Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    }.getOrDefault(bitmap)
}

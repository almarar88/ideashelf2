package com.rafeeq.companion.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

/** طبقة الشبكة المشتركة لكل التطبيق. */
object Net {

    val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(90, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build()
    }

    val json: Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        coerceInputValues = true
        explicitNulls = false
        encodeDefaults = true
    }

    const val USER_AGENT =
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36 Rafeeq/1.0"

    /** ينفّذ طلبًا ويعيد النص. يرمي [HttpFailure] عند فشل الاستجابة. */
    suspend fun text(url: String, headers: Map<String, String> = emptyMap()): String =
        withContext(Dispatchers.IO) {
            val builder = Request.Builder().url(url).header("User-Agent", USER_AGENT)
            headers.forEach { (k, v) -> builder.header(k, v) }
            execute(builder.build()).use { response ->
                val body = response.body?.string().orEmpty()
                if (!response.isSuccessful) throw HttpFailure(response.code, body.take(400))
                body
            }
        }

    /** ينفّذ الطلب بشكل غير حاجب باستخدام كوروتين. */
    suspend fun execute(request: Request): Response = suspendCoroutine { cont ->
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) = cont.resumeWithException(e)
            override fun onResponse(call: Call, response: Response) = cont.resume(response)
        })
    }
}

class HttpFailure(val code: Int, val bodyPreview: String) :
    IOException("HTTP $code — $bodyPreview")

/** يحوّل الاستثناء إلى رسالة عربية مفهومة للمستخدم بدل نص تقني. */
fun Throwable.friendlyMessage(): String = when (this) {
    is HttpFailure -> when (code) {
        401, 403 -> "المفتاح غير صالح أو منتهي الصلاحية."
        429 -> "تجاوزت حد الطلبات المسموح. حاول بعد قليل."
        in 500..599 -> "الخدمة غير متاحة حاليًا. حاول لاحقًا."
        else -> "تعذّر إتمام الطلب (رمز $code)."
    }
    is java.net.UnknownHostException -> "لا يوجد اتصال بالإنترنت."
    is java.net.SocketTimeoutException -> "انتهت مهلة الاتصال. تحقّق من الشبكة."
    is IOException -> "مشكلة في الشبكة: ${message ?: "غير معروفة"}"
    else -> message ?: "حدث خطأ غير متوقع."
}

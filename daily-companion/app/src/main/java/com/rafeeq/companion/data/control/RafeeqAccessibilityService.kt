package com.rafeeq.companion.data.control

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import androidx.annotation.RequiresApi
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.Locale

/**
 * خدمة الوصول — هي ما يمنح المساعد القدرة الفعلية على التحكّم داخل التطبيقات الأخرى:
 * قراءة ما على الشاشة، الضغط، الكتابة، والتمرير.
 *
 * أندرويد لا يوفّر أي وسيلة أخرى لتطبيق عادي كي يتحكّم بتطبيق آخر، ولهذا
 * يجب على المستخدم تفعيلها يدويًا من إعدادات النظام. الخدمة لا تعمل إلا حين
 * يطلب المساعد ذلك، ولا ترسل شيئًا خارج الجهاز من تلقاء نفسها.
 */
class RafeeqAccessibilityService : AccessibilityService() {

    companion object {
        @Volatile
        var instance: RafeeqAccessibilityService? = null
            private set

        fun isRunning(): Boolean = instance != null
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }

    override fun onInterrupt() = Unit

    override fun onAccessibilityEvent(event: AccessibilityEvent?) = Unit

    fun currentPackage(): String =
        runCatching { rootInActiveWindow?.packageName?.toString() }.getOrNull() ?: "غير معروف"

    // ------------------------------------------------------------ قراءة الشاشة

    private data class ScreenNode(
        val text: String,
        val clickable: Boolean,
        val editable: Boolean,
        val bounds: Rect,
    )

    private fun collect(
        node: AccessibilityNodeInfo?,
        into: MutableList<ScreenNode>,
        depth: Int = 0,
    ) {
        if (node == null || depth > 40 || into.size > 220) return

        val label = listOfNotNull(
            node.text?.toString()?.trim()?.takeIf { it.isNotBlank() },
            node.contentDescription?.toString()?.trim()?.takeIf { it.isNotBlank() },
        ).firstOrNull()

        if (!label.isNullOrBlank() && label.length <= 160) {
            val bounds = Rect().also { node.getBoundsInScreen(it) }
            if (bounds.width() > 0 && bounds.height() > 0) {
                into += ScreenNode(
                    text = label,
                    clickable = node.isClickable || node.parent?.isClickable == true,
                    editable = node.isEditable,
                    bounds = bounds,
                )
            }
        }
        for (i in 0 until node.childCount) collect(node.getChild(i), into, depth + 1)
    }

    /** وصف نصّي للشاشة يفهمه النموذج: النص، نوعه، وموضعه. */
    fun describeScreen(): String {
        val root = rootInActiveWindow ?: return ""
        val nodes = mutableListOf<ScreenNode>()
        collect(root, nodes)

        return nodes
            .distinctBy { it.text + it.bounds.centerY() / 20 }
            .joinToString("\n") { node ->
                val kind = when {
                    node.editable -> "[خانة إدخال]"
                    node.clickable -> "[قابل للضغط]"
                    else -> "[نص]"
                }
                "$kind ${node.text}  @(${node.bounds.centerX()},${node.bounds.centerY()})"
            }
    }

    // ------------------------------------------------------------ الضغط والكتابة

    private fun normalize(value: String) = value.trim().lowercase(Locale.ROOT)
        .replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
        .replace("ة", "ه").replace("ى", "ي")

    // الدالة الوصفية تأتي أخيرًا ليمكن تمريرها كقوس لامدا خلفي.
    private fun findNode(
        node: AccessibilityNodeInfo?,
        depth: Int = 0,
        predicate: (AccessibilityNodeInfo) -> Boolean,
    ): AccessibilityNodeInfo? {
        if (node == null || depth > 40) return null
        if (predicate(node)) return node
        for (i in 0 until node.childCount) {
            findNode(node.getChild(i), depth + 1, predicate)?.let { return it }
        }
        return null
    }

    private fun labelOf(node: AccessibilityNodeInfo): String =
        listOfNotNull(node.text?.toString(), node.contentDescription?.toString())
            .joinToString(" ")

    /** يضغط على عنصر بنصّه — يجرّب المطابقة التامة ثم الاحتواء. */
    fun clickByText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val wanted = normalize(text)

        val exact = findNode(root) { normalize(labelOf(it)) == wanted }
        val partial = exact ?: findNode(root) { normalize(labelOf(it)).contains(wanted) }
        val target = partial ?: return false

        // العنصر الحامل للنص قد لا يكون القابل للضغط، فنصعد إلى أقرب أب قابل للضغط.
        var clickable: AccessibilityNodeInfo? = target
        var hops = 0
        while (clickable != null && !clickable.isClickable && hops < 6) {
            clickable = clickable.parent
            hops++
        }

        clickable?.let {
            if (it.performAction(AccessibilityNodeInfo.ACTION_CLICK)) return true
        }

        // إن رفض العنصر الضغط المنطقي، نضغط على مركزه بإيماءة حقيقية.
        val bounds = Rect().also { target.getBoundsInScreen(it) }
        return tapAt(bounds.exactCenterX(), bounds.exactCenterY())
    }

    /** هل يظهر هذا النص على الشاشة الآن؟ يُستعمل قبل الضغط وبعد التمرير. */
    fun hasText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val wanted = normalize(text)
        return findNode(root) { normalize(labelOf(it)).contains(wanted) } != null
    }

    /** ضغطة مطوّلة على عنصر بنصّه — تفتح قوائم السياق. */
    fun longPressText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val wanted = normalize(text)
        val target = findNode(root) { normalize(labelOf(it)).contains(wanted) } ?: return false

        var node: AccessibilityNodeInfo? = target
        var hops = 0
        while (node != null && !node.isLongClickable && hops < 6) {
            node = node.parent
            hops++
        }
        if (node?.performAction(AccessibilityNodeInfo.ACTION_LONG_CLICK) == true) return true

        // إن لم يقبل العنصر الضغط المطوّل المنطقي، نرسل إيماءة حقيقية بمدّة أطول.
        val bounds = Rect().also { target.getBoundsInScreen(it) }
        val path = Path().apply { moveTo(bounds.exactCenterX(), bounds.exactCenterY()) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 700))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    fun tapAt(x: Float, y: Float): Boolean {
        val path = Path().apply { moveTo(x, y) }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 60))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    fun typeText(text: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
            ?: findNode(root) { it.isEditable }
            ?: return false

        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }

    fun swipe(direction: String): Boolean {
        val metrics = resources.displayMetrics
        val width = metrics.widthPixels.toFloat()
        val height = metrics.heightPixels.toFloat()
        val centerX = width / 2f
        val centerY = height / 2f

        val (startX, startY, endX, endY) = when (direction.lowercase(Locale.ROOT)) {
            "up", "فوق" -> listOf(centerX, height * 0.72f, centerX, height * 0.28f)
            "down", "تحت" -> listOf(centerX, height * 0.28f, centerX, height * 0.72f)
            "left", "يسار" -> listOf(width * 0.8f, centerY, width * 0.2f, centerY)
            "right", "يمين" -> listOf(width * 0.2f, centerY, width * 0.8f, centerY)
            else -> return false
        }.let { Quad(it[0], it[1], it[2], it[3]) }

        val path = Path().apply {
            moveTo(startX, startY)
            lineTo(endX, endY)
        }
        val gesture = GestureDescription.Builder()
            .addStroke(GestureDescription.StrokeDescription(path, 0, 320))
            .build()
        return dispatchGesture(gesture, null, null)
    }

    private data class Quad(val a: Float, val b: Float, val c: Float, val d: Float)

    private operator fun Quad.component1() = a
    private operator fun Quad.component2() = b
    private operator fun Quad.component3() = c
    private operator fun Quad.component4() = d

    /**
     * يلتقط صورة الشاشة الحالية. متاح من أندرويد ١١ فقط، وهو الطريق الوحيد
     * المسموح به لتطبيق عادي دون طلب إذن تسجيل الشاشة في كل مرة.
     */
    @RequiresApi(Build.VERSION_CODES.R)
    suspend fun captureScreen(): Bitmap? = suspendCancellableCoroutine { cont ->
        runCatching {
            takeScreenshot(
                android.view.Display.DEFAULT_DISPLAY,
                { runnable -> runnable.run() },
                object : TakeScreenshotCallback {
                    override fun onSuccess(result: ScreenshotResult) {
                        val bitmap = runCatching {
                            Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
                                ?.copy(Bitmap.Config.ARGB_8888, false)
                        }.getOrNull()
                        runCatching { result.hardwareBuffer.close() }
                        if (cont.isActive) cont.resumeWith(Result.success(bitmap))
                    }

                    override fun onFailure(errorCode: Int) {
                        if (cont.isActive) cont.resumeWith(Result.success(null))
                    }
                },
            )
        }.onFailure { if (cont.isActive) cont.resumeWith(Result.success(null)) }
    }

    fun pressKey(key: String): Boolean = when (key.lowercase(Locale.ROOT)) {
        "back", "رجوع" -> performGlobalAction(GLOBAL_ACTION_BACK)
        "home", "الرئيسية" -> performGlobalAction(GLOBAL_ACTION_HOME)
        "recents", "التطبيقات" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
        "notifications", "الإشعارات" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
        "power", "خيارات الطاقة" ->
            performGlobalAction(GLOBAL_ACTION_POWER_DIALOG)
        "quick_settings", "الإعدادات السريعة" ->
            performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
        "split", "تقسيم الشاشة" ->
            performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
        "dismiss", "إغلاق الشريط" ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                performGlobalAction(GLOBAL_ACTION_DISMISS_NOTIFICATION_SHADE)
            } else false
        "lock", "قفل" ->
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            } else false
        else -> false
    }
}

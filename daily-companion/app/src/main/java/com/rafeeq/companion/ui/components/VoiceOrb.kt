package com.rafeeq.companion.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import kotlin.math.min
import kotlin.math.sin

/** حالات الكرة الصوتية. */
enum class OrbState { IDLE, LISTENING, THINKING, SPEAKING }

/**
 * الكرة الصوتية — العنصر البصري الرئيسي في المساعد الصوتي.
 *
 * ترسم بالكامل على Canvas بدل صور أو رسوم متحرّكة جاهزة، فتبقى حادّة على أي دقة
 * وبحجم لا يُذكر. تتفاعل مع مستوى الصوت الحقيقي أثناء الاستماع.
 */
@Composable
fun VoiceOrb(
    state: OrbState,
    amplitude: Float,
    colors: List<Color>,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "orb")

    val rotation by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            tween(if (state == OrbState.THINKING) 2200 else 9000, easing = LinearEasing),
        ),
        label = "rotation",
    )

    val breathe by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(3200, easing = LinearEasing)),
        label = "breathe",
    )

    // نُنعّم مستوى الصوت حتى لا تهتزّ الكرة بعنف مع كل مقطع.
    val level by animateFloatAsState(
        targetValue = when (state) {
            OrbState.LISTENING -> amplitude.coerceIn(0f, 1f)
            OrbState.SPEAKING -> 0.45f
            OrbState.THINKING -> 0.25f
            OrbState.IDLE -> 0f
        },
        animationSpec = spring(dampingRatio = Spring.DampingRatioLowBouncy, stiffness = 260f),
        label = "level",
    )

    val glow by animateFloatAsState(
        targetValue = if (state == OrbState.IDLE) 0.25f else 0.6f,
        animationSpec = tween(500),
        label = "glow",
    )

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val center = Offset(size.width / 2f, size.height / 2f)
            val base = min(size.width, size.height) / 2f
            val pulse = 1f + 0.06f * sin(breathe)

            // الهالة الخارجية
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        colors.first().copy(alpha = glow * 0.32f),
                        Color.Transparent,
                    ),
                    center = center,
                    radius = base * (0.95f + level * 0.35f),
                ),
                radius = base * (0.95f + level * 0.35f),
                center = center,
            )

            // حلقات تتمدّد مع الصوت
            if (level > 0.02f) {
                for (ring in 1..3) {
                    val spread = base * (0.52f + ring * 0.13f + level * 0.22f * ring)
                    drawCircle(
                        color = colors[ring % colors.size].copy(alpha = (0.22f - ring * 0.05f) * (0.4f + level)),
                        radius = spread,
                        center = center,
                        style = Stroke(width = 2f + level * 3f),
                    )
                }
            }

            // الحلقة الدوّارة بتدرّج مخروطي
            rotate(degrees = rotation, pivot = center) {
                drawCircle(
                    brush = Brush.sweepGradient(colors + colors.first(), center),
                    radius = base * 0.62f * pulse,
                    center = center,
                    style = Stroke(width = base * 0.075f, cap = StrokeCap.Round),
                )
            }

            // القلب المتوهّج
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(
                        Color.White.copy(alpha = 0.92f),
                        colors.first().copy(alpha = 0.75f),
                        colors.last().copy(alpha = 0.28f),
                    ),
                    center = center,
                    radius = base * (0.34f + level * 0.20f),
                ),
                radius = base * (0.34f + level * 0.20f) * pulse,
                center = center,
            )
        }
    }
}

/**
 * موجة صوتية أفقية بسيطة — تُعرض تحت النص أثناء الاستماع.
 */
@Composable
fun VoiceWave(
    amplitude: Float,
    active: Boolean,
    color: Color,
    modifier: Modifier = Modifier,
    bars: Int = 28,
) {
    val transition = rememberInfiniteTransition(label = "wave")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(1100, easing = LinearEasing), RepeatMode.Restart),
        label = "phase",
    )
    val level by animateFloatAsState(
        targetValue = if (active) amplitude.coerceIn(0.05f, 1f) else 0.04f,
        animationSpec = spring(stiffness = 320f),
        label = "waveLevel",
    )

    Canvas(modifier) {
        val gap = size.width / (bars * 1.7f)
        val barWidth = (size.width - gap * (bars - 1)) / bars
        for (i in 0 until bars) {
            // منحنى جيبي يجعل الأعمدة الوسطى أطول، فتبدو الموجة طبيعية.
            val envelope = sin(Math.PI * i / (bars - 1)).toFloat()
            val wobble = 0.45f + 0.55f * sin(phase + i * 0.55f)
            val height = (size.height * level * envelope * wobble).coerceAtLeast(3f)
            val x = i * (barWidth + gap)
            drawRoundRect(
                color = color.copy(alpha = 0.35f + 0.55f * envelope),
                topLeft = Offset(x, (size.height - height) / 2f),
                size = androidx.compose.ui.geometry.Size(barWidth, height),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2f),
            )
        }
    }
}

/**
 * مؤشّر صوتي مضغوط وهادئ — دائرة واحدة تتنفّس مع الصوت وحلقة رفيعة حولها.
 *
 * صُمّم للبطاقة الصغيرة: عند الأحجام الصغيرة تبدو الحلقات المتعدّدة مزدحمة،
 * فاكتفينا بعنصرين اثنين ليبقى المؤشّر واضحًا ومتزنًا.
 */
@Composable
fun VoicePulse(
    state: OrbState,
    amplitude: Float,
    accent: Color,
    modifier: Modifier = Modifier,
) {
    val transition = rememberInfiniteTransition(label = "pulse")

    val sweep by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(1400, easing = LinearEasing)),
        label = "sweep",
    )
    val breathe by transition.animateFloat(
        initialValue = 0f,
        targetValue = (2 * Math.PI).toFloat(),
        animationSpec = infiniteRepeatable(tween(2600, easing = LinearEasing)),
        label = "breathe",
    )

    val level by animateFloatAsState(
        targetValue = when (state) {
            OrbState.LISTENING -> amplitude.coerceIn(0f, 1f)
            OrbState.SPEAKING -> 0.4f
            OrbState.THINKING -> 0.15f
            OrbState.IDLE -> 0f
        },
        animationSpec = spring(dampingRatio = Spring.DampingRatioNoBouncy, stiffness = 300f),
        label = "level",
    )

    Canvas(modifier) {
        val center = Offset(size.width / 2f, size.height / 2f)
        val base = min(size.width, size.height) / 2f
        val idle = 1f + 0.04f * sin(breathe)

        // حلقة رفيعة ثابتة
        drawCircle(
            color = accent.copy(alpha = 0.22f),
            radius = base * 0.92f,
            center = center,
            style = Stroke(width = 1.5f),
        )

        // قوس دوّار أثناء التفكير فقط — إشارة تقدّم بلا ضجيج
        if (state == OrbState.THINKING) {
            drawArc(
                color = accent,
                startAngle = sweep,
                sweepAngle = 80f,
                useCenter = false,
                topLeft = Offset(center.x - base * 0.92f, center.y - base * 0.92f),
                size = androidx.compose.ui.geometry.Size(base * 1.84f, base * 1.84f),
                style = Stroke(width = 2f, cap = StrokeCap.Round),
            )
        }

        // هالة ناعمة تكبر مع الصوت
        if (level > 0.02f) {
            drawCircle(
                brush = Brush.radialGradient(
                    listOf(accent.copy(alpha = 0.30f * level), Color.Transparent),
                    center = center,
                    radius = base * (0.6f + level * 0.5f),
                ),
                radius = base * (0.6f + level * 0.5f),
                center = center,
            )
        }

        // القلب
        drawCircle(
            color = accent,
            radius = base * (0.34f + level * 0.24f) * idle,
            center = center,
        )
    }
}

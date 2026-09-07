package com.rafeeq.companion.ui.components

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

/** حلقة تقدّم دائرية بتدرّج لوني — تُستخدم لعدّاد الصلاة القادمة. */
@Composable
fun ProgressRing(
    progress: Float,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    strokeWidth: Dp = 10.dp,
    trackAlpha: Float = 0.18f,
    content: @Composable () -> Unit = {},
) {
    val animated by animateFloatAsState(
        targetValue = progress.coerceIn(0f, 1f),
        animationSpec = tween(700),
        label = "ring",
    )
    val trackColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = trackAlpha)

    Box(modifier = modifier, contentAlignment = Alignment.Center) {
        Canvas(Modifier.fillMaxSize()) {
            val stroke = strokeWidth.toPx()
            val diameter = min(size.width, size.height) - stroke
            val topLeft = Offset((size.width - diameter) / 2f, (size.height - diameter) / 2f)
            val arcSize = Size(diameter, diameter)

            drawArc(
                color = trackColor,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
            drawArc(
                brush = Brush.sweepGradient(colors + colors.first()),
                startAngle = -90f,
                sweepAngle = 360f * animated,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = stroke, cap = StrokeCap.Round),
            )
        }
        content()
    }
}

/** بوصلة القبلة: سهم يدور نحو اتجاه الكعبة بناءً على اتجاه الجهاز. */
@Composable
fun QiblaCompass(
    qiblaBearing: Double,
    deviceHeading: Float,
    modifier: Modifier = Modifier,
) {
    val needle by animateFloatAsState(
        targetValue = (qiblaBearing.toFloat() - deviceHeading + 360f) % 360f,
        animationSpec = tween(320),
        label = "needle",
    )
    val dialColor = MaterialTheme.colorScheme.outlineVariant
    val markColor = MaterialTheme.colorScheme.onSurfaceVariant
    val accent = MaterialTheme.colorScheme.primary
    val secondary = MaterialTheme.colorScheme.tertiary

    Canvas(modifier) {
        val radius = min(size.width, size.height) / 2f - 12f
        val center = Offset(size.width / 2f, size.height / 2f)

        drawCircle(color = dialColor.copy(alpha = 0.35f), radius = radius, center = center, style = Stroke(2f))
        drawCircle(color = dialColor.copy(alpha = 0.2f), radius = radius * 0.72f, center = center, style = Stroke(1.5f))

        // علامات كل ١٥ درجة، وأطول عند الجهات الأصلية.
        for (angle in 0 until 360 step 15) {
            val rotated = Math.toRadians((angle - deviceHeading - 90f).toDouble())
            val isCardinal = angle % 90 == 0
            val outer = radius
            val inner = radius - if (isCardinal) 16f else 8f
            val start = Offset(
                center.x + cos(rotated).toFloat() * inner,
                center.y + sin(rotated).toFloat() * inner,
            )
            val end = Offset(
                center.x + cos(rotated).toFloat() * outer,
                center.y + sin(rotated).toFloat() * outer,
            )
            drawLine(
                color = if (isCardinal) markColor else markColor.copy(alpha = 0.4f),
                start = start,
                end = end,
                strokeWidth = if (isCardinal) 3f else 1.5f,
                cap = StrokeCap.Round,
            )
        }

        // سهم القبلة.
        val needleRad = Math.toRadians((needle - 90f).toDouble())
        val tip = Offset(
            center.x + cos(needleRad).toFloat() * (radius - 26f),
            center.y + sin(needleRad).toFloat() * (radius - 26f),
        )
        val backRad = needleRad + Math.PI
        val tail = Offset(
            center.x + cos(backRad).toFloat() * (radius * 0.35f),
            center.y + sin(backRad).toFloat() * (radius * 0.35f),
        )
        drawLine(
            brush = Brush.linearGradient(listOf(secondary, accent), start = tail, end = tip),
            start = tail,
            end = tip,
            strokeWidth = 10f,
            cap = StrokeCap.Round,
        )
        drawCircle(color = accent, radius = 13f, center = tip)
        drawCircle(color = accent.copy(alpha = 0.25f), radius = 24f, center = tip)
        drawCircle(color = markColor, radius = 6f, center = center)
    }
}

/** رسم بياني خطّي ناعم لدرجات الحرارة على مدار الساعات. */
@Composable
fun TemperatureSparkline(
    values: List<Double>,
    modifier: Modifier = Modifier,
    lineColors: List<Color>,
) {
    if (values.size < 2) return
    val minValue = values.min()
    val maxValue = values.max()
    val range = (maxValue - minValue).takeIf { it > 0.5 } ?: 1.0

    Canvas(modifier) {
        val stepX = size.width / (values.size - 1)
        val points = values.mapIndexed { index, value ->
            Offset(
                x = index * stepX,
                y = size.height - ((value - minValue) / range).toFloat() * size.height * 0.82f - size.height * 0.09f,
            )
        }
        val path = androidx.compose.ui.graphics.Path().apply {
            moveTo(points.first().x, points.first().y)
            for (i in 0 until points.size - 1) {
                val current = points[i]
                val next = points[i + 1]
                val controlX = (current.x + next.x) / 2f
                cubicTo(controlX, current.y, controlX, next.y, next.x, next.y)
            }
        }
        val fill = androidx.compose.ui.graphics.Path().apply {
            addPath(path)
            lineTo(size.width, size.height)
            lineTo(0f, size.height)
            close()
        }
        drawPath(
            path = fill,
            brush = Brush.verticalGradient(
                listOf(lineColors.first().copy(alpha = 0.28f), Color.Transparent),
            ),
        )
        drawPath(
            path = path,
            brush = Brush.horizontalGradient(lineColors),
            style = Stroke(width = 5f, cap = StrokeCap.Round),
        )
    }
}

/** أعمدة صغيرة لسجلّ العادة خلال آخر أيام. */
@Composable
fun HabitBars(
    values: List<Float>,
    modifier: Modifier = Modifier,
    activeColor: Color,
) {
    val track = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.16f)
    Canvas(modifier) {
        if (values.isEmpty()) return@Canvas
        val gap = 5f
        val barWidth = (size.width - gap * (values.size - 1)) / values.size
        values.forEachIndexed { index, value ->
            val x = index * (barWidth + gap)
            drawRoundRect(
                color = track,
                topLeft = Offset(x, 0f),
                size = Size(barWidth, size.height),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2f),
            )
            if (value > 0f) {
                val height = (size.height * value.coerceIn(0f, 1f)).coerceAtLeast(barWidth)
                drawRoundRect(
                    color = activeColor,
                    topLeft = Offset(x, size.height - height),
                    size = Size(barWidth, height),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2f),
                )
            }
        }
    }
}

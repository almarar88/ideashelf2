package com.rafeeq.companion.ui.components

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Ink
import com.rafeeq.companion.ui.theme.PastelDeck
import com.rafeeq.companion.ui.theme.PastelInkDeck

/**
 * عناصر واجهة "الرمل الدافئ".
 *
 * القاعدة البصرية واحدة عبر التطبيق كله: بطاقة بيضاء كبيرة الاستدارة على
 * خلفية رملية، عنوان أسود عريض، لمسة باستيل واحدة، وظلّ خفيف جدًا.
 * كل ما دون ذلك زخرفة تُشوّش.
 */

/** بطاقة بيضاء ناعمة — الوحدة الأساسية لكل الشاشات. */
@Composable
fun SoftCard(
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.surface,
    radius: Int = 26,
    padding: PaddingValues = PaddingValues(18.dp),
    onClick: (() -> Unit)? = null,
    content: @Composable androidx.compose.foundation.layout.ColumnScope.() -> Unit,
) {
    val shape = RoundedCornerShape(radius.dp)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .shadow(
                6.dp, shape,
                ambientColor = Ink.copy(alpha = 0.05f),
                spotColor = Ink.copy(alpha = 0.07f),
            )
            .clip(shape)
            .background(color)
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(padding),
        content = content,
    )
}

/** زر دائري أبيض بظلّ — يُستعمل للرجوع و«…» أعلى الشاشات. */
@Composable
fun CircleButton(
    icon: ImageVector,
    contentDescription: String?,
    modifier: Modifier = Modifier,
    size: Int = 52,
    background: Color = MaterialTheme.colorScheme.surface,
    tint: Color = MaterialTheme.colorScheme.onSurface,
    onClick: () -> Unit,
) {
    Box(
        modifier = modifier
            .size(size.dp)
            .shadow(5.dp, CircleShape, ambientColor = Ink.copy(alpha = 0.06f))
            .clip(CircleShape)
            .background(background)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            icon,
            contentDescription = contentDescription,
            tint = tint,
            modifier = Modifier.size((size * 0.38f).dp),
        )
    }
}

/** رأس شاشة فرعية: رجوع يمينًا و«…» يسارًا كما في التصميم. */
@Composable
fun ScreenTopBar(
    onBack: () -> Unit,
    modifier: Modifier = Modifier,
    backIcon: ImageVector,
    onMore: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircleButton(backIcon, "رجوع", onClick = onBack)
        Spacer(Modifier.weight(1f))
        if (onMore != null) {
            CircleButton(Icons.Filled.MoreHoriz, "المزيد", onClick = onMore)
        }
    }
}

/** عنوان قسم مع رابط «الكل» بلون العنبر — نمط متكرّر في التصميم. */
@Composable
fun SectionRow(
    title: String,
    modifier: Modifier = Modifier,
    actionLabel: String = "الكل",
    onAction: (() -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth().padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.weight(1f),
        )
        if (onAction != null) {
            Text(
                actionLabel,
                style = MaterialTheme.typography.labelLarge,
                color = Amber,
                modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { onAction() }
                    .padding(horizontal = 6.dp, vertical = 2.dp),
            )
        }
    }
}

/** شريحة فئة بعدّاد داخلي — مثل «UI Design 23». */
@Composable
fun CountChip(
    label: String,
    count: Int?,
    selected: Boolean,
    color: Color,
    ink: Color,
    onClick: () -> Unit,
) {
    val bg by animateColorAsState(
        if (selected) color else MaterialTheme.colorScheme.surface,
        tween(220),
        label = "chip",
    )
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(start = 16.dp, end = 8.dp, top = 11.dp, bottom = 11.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = FontWeight.SemiBold,
            color = if (selected) ink else MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (count != null) {
            Spacer(Modifier.width(8.dp))
            Box(
                Modifier
                    .clip(RoundedCornerShape(9.dp))
                    .background(
                        if (selected) Color.White.copy(alpha = 0.55f)
                        else MaterialTheme.colorScheme.surfaceContainerHighest,
                    )
                    .padding(horizontal = 7.dp, vertical = 2.dp),
            ) {
                Text(
                    "$count",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = if (selected) ink else MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** كبسولة معلومة: دائرة أيقونة بيضاء ثم نص — «٢ ساعة ١٠ دقائق». */
@Composable
fun MetaPill(
    icon: ImageVector,
    text: String,
    modifier: Modifier = Modifier,
    tint: Color = MaterialTheme.colorScheme.onSurface,
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(22.dp))
            .background(MaterialTheme.colorScheme.surface)
            .padding(start = 6.dp, end = 16.dp, top = 6.dp, bottom = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .size(34.dp)
                .clip(CircleShape)
                .background(MaterialTheme.colorScheme.surfaceContainerHigh),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = tint, modifier = Modifier.size(17.dp))
        }
        Spacer(Modifier.width(10.dp))
        Text(text, style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.Medium)
    }
}

/** كومة رموز متداخلة تنتهي بدائرة سوداء «+23». */
@Composable
fun AvatarStack(
    emojis: List<String>,
    extra: Int,
    modifier: Modifier = Modifier,
    size: Int = 30,
) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        emojis.forEachIndexed { index, emoji ->
            Box(
                Modifier
                    .offset(x = (-(index * (size * 0.32f))).dp)
                    .size(size.dp)
                    .clip(CircleShape)
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(2.dp)
                    .clip(CircleShape)
                    .background(PastelDeck[index % PastelDeck.size]),
                contentAlignment = Alignment.Center,
            ) {
                Text(emoji, style = MaterialTheme.typography.labelMedium)
            }
        }
        if (extra > 0) {
            Box(
                Modifier
                    .offset(x = (-(emojis.size * (size * 0.32f))).dp)
                    .size(size.dp)
                    .clip(CircleShape)
                    .background(Ink),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "+$extra",
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
            }
        }
    }
}

/** زر تشغيل أسود دائري — نقطة الفعل في بطاقة البطل. */
@Composable
fun PlayFab(size: Int = 52, onClick: () -> Unit) {
    Box(
        Modifier
            .size(size.dp)
            .shadow(8.dp, CircleShape, spotColor = Ink.copy(alpha = 0.3f))
            .clip(CircleShape)
            .background(Ink)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            Icons.Filled.PlayArrow,
            contentDescription = "ابدأ",
            tint = Color.White,
            modifier = Modifier.size((size * 0.44f).dp),
        )
    }
}

/**
 * بطاقة بطل باستيلية: عنوان أسود عريض، كومة رموز، شريط فعل سفلي،
 * وزخرفة هندسية أصلية في الخلفية بدل صورة جاهزة.
 */
@Composable
fun FeatureCard(
    title: String,
    subtitle: String,
    actionLabel: String,
    background: Color,
    decoration: Decor,
    modifier: Modifier = Modifier,
    avatars: List<String> = emptyList(),
    extraAvatars: Int = 0,
    onAction: () -> Unit,
) {
    val shape = RoundedCornerShape(26.dp)
    Box(
        modifier
            .fillMaxWidth()
            .height(216.dp)
            .shadow(6.dp, shape, ambientColor = Ink.copy(alpha = 0.05f))
            .clip(shape)
            .background(background)
            .clickable(onClick = onAction),
    ) {
        DecorCanvas(decoration, Modifier.fillMaxSize())

        Column(Modifier.fillMaxSize().padding(18.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
                color = Ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.fillMaxWidth(0.7f),
            )
            if (subtitle.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = Ink.copy(alpha = 0.6f),
                    maxLines = 2,
                    modifier = Modifier.fillMaxWidth(0.65f),
                )
            }
            if (avatars.isNotEmpty() || extraAvatars > 0) {
                Spacer(Modifier.height(10.dp))
                AvatarStack(avatars, extraAvatars)
            }
            Spacer(Modifier.weight(1f))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White.copy(alpha = 0.42f))
                    .padding(start = 16.dp, end = 6.dp, top = 6.dp, bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    actionLabel,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = Ink,
                    modifier = Modifier.weight(1f),
                )
                PlayFab(44, onAction)
            }
        }
    }
}

/** بطاقة تقدّم صغيرة أفقية: أيقونة، عنوان، شريط، ونسبة. */
@Composable
fun ProgressCard(
    title: String,
    subtitle: String,
    percent: Int,
    background: Color,
    barColor: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onMore: (() -> Unit)? = null,
) {
    val shape = RoundedCornerShape(24.dp)
    Column(
        modifier
            .width(238.dp)
            .clip(shape)
            .background(background)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(38.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.7f)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(icon, null, tint = Ink, modifier = Modifier.size(18.dp))
            }
            Spacer(Modifier.weight(1f))
            if (onMore != null) {
                Icon(
                    Icons.Filled.MoreHoriz,
                    "المزيد",
                    tint = Ink.copy(alpha = 0.55f),
                    modifier = Modifier.size(20.dp).clip(CircleShape).clickable { onMore() },
                )
            }
        }
        Spacer(Modifier.height(14.dp))
        Text(
            title,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
            color = Ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (subtitle.isNotBlank()) {
            Text(
                subtitle,
                style = MaterialTheme.typography.labelSmall,
                color = Ink.copy(alpha = 0.55f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(10.dp))
        val fraction by animateFloatAsState(
            (percent / 100f).coerceIn(0f, 1f), tween(600), label = "progress",
        )
        Box(
            Modifier
                .fillMaxWidth()
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Color.White.copy(alpha = 0.6f)),
        ) {
            Box(
                Modifier
                    .fillMaxWidth(fraction)
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp))
                    .background(barColor),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "التقدّم",
                style = MaterialTheme.typography.labelMedium,
                color = Ink.copy(alpha = 0.6f),
                modifier = Modifier.weight(1f),
            )
            Text(
                "$percent٪",
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = Ink,
            )
        }
    }
}

/** صفّ قائمة بصورة مصغّرة باستيلية — «الجاري» في التصميم. */
@Composable
fun ListRowCard(
    title: String,
    subtitle: String,
    meta: String,
    trailing: String,
    trailingColor: Color,
    accent: Color,
    icon: ImageVector,
    modifier: Modifier = Modifier,
    onClick: () -> Unit = {},
) {
    val shape = RoundedCornerShape(20.dp)
    Row(
        modifier
            .fillMaxWidth()
            .clip(shape)
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(52.dp).clip(RoundedCornerShape(16.dp)).background(accent),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, null, tint = Ink.copy(alpha = 0.7f), modifier = Modifier.size(22.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (subtitle.isNotBlank()) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Spacer(Modifier.height(3.dp))
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    meta,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    trailing,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.SemiBold,
                    color = trailingColor,
                )
            }
        }
    }
}

/** لون باستيل ثابت لكل عنصر بحسب موضعه — لتبقى الشاشة متوازنة لا عشوائية. */
fun pastelAt(index: Int): Color = PastelDeck[index.mod(PastelDeck.size)]
fun pastelInkAt(index: Int): Color = PastelInkDeck[index.mod(PastelInkDeck.size)]

/**
 * زخارف البطاقات.
 *
 * التصميم المرجعي يستعمل رسومًا مسطّحة جاهزة. لا نُعيد رسمها — ذلك نسخ —
 * بل نرسم أشكالًا هندسية أصلية بنفس الروح: أقواس وحلقات ونقاط بلون واحد
 * شفّاف فوق خلفية الباستيل. الميزة الإضافية أنها متجهة، فلا تزيد حجم التطبيق.
 */
enum class Decor { ARCS, RINGS, WAVES, DOTS, LEAF, BURST }

@Composable
fun DecorCanvas(decor: Decor, modifier: Modifier = Modifier, ink: Color = Ink) {
    androidx.compose.foundation.Canvas(modifier) {
        val w = size.width
        val h = size.height
        val soft = ink.copy(alpha = 0.07f)
        val softer = ink.copy(alpha = 0.045f)

        when (decor) {
            Decor.ARCS -> {
                for (i in 0..3) {
                    val r = w * (0.30f + i * 0.14f)
                    drawArc(
                        color = if (i % 2 == 0) soft else softer,
                        startAngle = 200f, sweepAngle = 120f, useCenter = false,
                        topLeft = androidx.compose.ui.geometry.Offset(w - r * 0.55f, h - r * 0.35f),
                        size = androidx.compose.ui.geometry.Size(r, r),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = w * 0.012f),
                    )
                }
            }

            Decor.RINGS -> {
                listOf(0.42f to 0.22f, 0.26f to 0.62f, 0.14f to 0.34f).forEachIndexed { i, (r, cy) ->
                    drawCircle(
                        color = if (i % 2 == 0) soft else softer,
                        radius = w * r * 0.5f,
                        center = androidx.compose.ui.geometry.Offset(w * (0.80f - i * 0.10f), h * cy),
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = w * 0.014f),
                    )
                }
            }

            Decor.WAVES -> {
                for (i in 0..2) {
                    val path = androidx.compose.ui.graphics.Path().apply {
                        val y = h * (0.55f + i * 0.14f)
                        moveTo(0f, y)
                        cubicTo(w * 0.3f, y - h * 0.12f, w * 0.6f, y + h * 0.12f, w, y - h * 0.05f)
                    }
                    drawPath(
                        path,
                        color = if (i % 2 == 0) soft else softer,
                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = w * 0.012f),
                    )
                }
            }

            Decor.DOTS -> {
                val step = w / 9f
                for (row in 0..3) {
                    for (col in 0..4) {
                        drawCircle(
                            color = if ((row + col) % 2 == 0) soft else softer,
                            radius = w * 0.012f,
                            center = androidx.compose.ui.geometry.Offset(
                                w - step * (col + 0.8f),
                                h * 0.18f + step * row * 0.9f,
                            ),
                        )
                    }
                }
            }

            Decor.LEAF -> {
                val path = androidx.compose.ui.graphics.Path().apply {
                    moveTo(w * 0.98f, h * 0.10f)
                    cubicTo(w * 0.55f, h * 0.18f, w * 0.50f, h * 0.72f, w * 0.86f, h * 0.96f)
                    cubicTo(w * 1.02f, h * 0.70f, w * 1.04f, h * 0.34f, w * 0.98f, h * 0.10f)
                    close()
                }
                drawPath(path, color = soft)
                drawLine(
                    color = softer,
                    start = androidx.compose.ui.geometry.Offset(w * 0.97f, h * 0.14f),
                    end = androidx.compose.ui.geometry.Offset(w * 0.84f, h * 0.92f),
                    strokeWidth = w * 0.01f,
                )
            }

            Decor.BURST -> {
                val cx = w * 0.82f
                val cy = h * 0.30f
                for (i in 0 until 10) {
                    val angle = (i * 36f) * (Math.PI / 180f).toFloat()
                    val inner = w * 0.06f
                    val outer = w * (if (i % 2 == 0) 0.17f else 0.12f)
                    drawLine(
                        color = if (i % 2 == 0) soft else softer,
                        start = androidx.compose.ui.geometry.Offset(
                            cx + inner * kotlin.math.cos(angle),
                            cy + inner * kotlin.math.sin(angle),
                        ),
                        end = androidx.compose.ui.geometry.Offset(
                            cx + outer * kotlin.math.cos(angle),
                            cy + outer * kotlin.math.sin(angle),
                        ),
                        strokeWidth = w * 0.012f,
                    )
                }
            }
        }
    }
}

/** زخرفة ثابتة لكل موضع، فلا يتغيّر شكل البطاقة مع كل إعادة رسم. */
fun decorAt(index: Int): Decor = Decor.entries[index.mod(Decor.entries.size)]

/**
 * شريط أسبوع أفقي: اسم الشهر بين سهمين، ثم أحرف الأيام وأرقامها،
 * واليوم المختار داخل كبسولة سوداء — كما في التصميم المرجعي.
 */
@Composable
fun WeekStrip(
    selected: java.time.LocalDate,
    modifier: Modifier = Modifier,
    today: java.time.LocalDate = java.time.LocalDate.now(),
    onSelect: (java.time.LocalDate) -> Unit,
) {
    // الأسبوع يبدأ من الأحد كما هو معتاد في المنطقة.
    val start = selected.minusDays(((selected.dayOfWeek.value % 7)).toLong())
    val days = (0..6).map { start.plusDays(it.toLong()) }
    val letters = listOf("أح", "إث", "ثل", "أر", "خم", "جم", "سب")

    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier.fillMaxWidth().padding(bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.ChevronRight,
                contentDescription = "الأسبوع السابق",
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .clickable { onSelect(selected.minusWeeks(1)) }
                    .padding(6.dp),
            )
            Text(
                monthLabelAr(selected),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
                modifier = Modifier.weight(1f),
            )
            Icon(
                Icons.Filled.ChevronLeft,
                contentDescription = "الأسبوع التالي",
                modifier = Modifier
                    .size(30.dp)
                    .clip(CircleShape)
                    .clickable { onSelect(selected.plusWeeks(1)) }
                    .padding(6.dp),
            )
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            days.forEachIndexed { index, date ->
                val isSelected = date == selected
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .clip(RoundedCornerShape(22.dp))
                        .clickable { onSelect(date) }
                        .padding(horizontal = 2.dp),
                ) {
                    Text(
                        letters[index],
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.height(6.dp))
                    Box(
                        Modifier
                            .size(width = 34.dp, height = 42.dp)
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) Ink else Color.Transparent),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            "${date.dayOfMonth}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = if (isSelected || date == today) FontWeight.Bold
                            else FontWeight.Normal,
                            color = when {
                                isSelected -> Color.White
                                date == today -> Amber
                                else -> MaterialTheme.colorScheme.onSurface
                            },
                        )
                    }
                }
            }
        }
    }
}

private fun monthLabelAr(date: java.time.LocalDate): String {
    val months = listOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    )
    return "${months[date.monthValue - 1]} ${date.year}"
}

// ------------------------------------------------------ مساحة الشريط العائم

/** ارتفاع كبسولة التنقّل نفسها: حشوة + دائرة + حشوة. */
val NavPillHeight = 62.dp

/** المسافة بين الكبسولة وحافة الشاشة. */
val NavPillMargin = 14.dp

/**
 * الحساب نفسه، معزولًا عن Compose ليمكن اختباره.
 *
 * [inset] هو ارتفاع أزرار النظام: صفر على أجهزة الإيماءات، و‎48dp‎ تقريبًا
 * على أجهزة الأزرار الثلاثة — وإهماله هو ما جعل الشريط يغطّي حقل الكتابة.
 */
fun navSpaceFor(
    inset: androidx.compose.ui.unit.Dp,
    extra: androidx.compose.ui.unit.Dp = 12.dp,
): androidx.compose.ui.unit.Dp = inset + NavPillHeight + NavPillMargin + extra

/**
 * المساحة التي يجب حجزها أسفل أي شاشة كي لا يغطّيها الشريط العائم.
 *
 * تُحسب ولا تُخمَّن: القيمة الثابتة تكفي على جهاز بإيماءات وتفشل على جهاز
 * بأزرار تنقّل (٤٨dp إضافية) — وهذا بالضبط ما كان يغطّي حقل الكتابة.
 */
@Composable
fun floatingNavSpace(extra: androidx.compose.ui.unit.Dp = 12.dp): androidx.compose.ui.unit.Dp {
    val inset = WindowInsets.navigationBars
        .asPaddingValues()
        .calculateBottomPadding()
    return navSpaceFor(inset, extra)
}

/**
 * مساحة أمان أسفل الشاشات التي لا شريط عائم فيها.
 *
 * المحتوى يمتدّ خلف أزرار النظام بعد أن صار الشريط عائمًا، فآخر عنصر
 * في القائمة كان يقع تحتها. هذه تُعيد له مكانه.
 */
@Composable
fun safeBottomSpace(
    extra: androidx.compose.ui.unit.Dp = 24.dp,
): androidx.compose.ui.unit.Dp {
    val inset = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    return inset + extra
}

/** هل لوحة المفاتيح ظاهرة الآن؟ نُخفي الشريط العائم حينها. */
@Composable
fun keyboardVisible(): Boolean {
    val density = androidx.compose.ui.platform.LocalDensity.current
    return WindowInsets.ime.getBottom(density) > 0
}

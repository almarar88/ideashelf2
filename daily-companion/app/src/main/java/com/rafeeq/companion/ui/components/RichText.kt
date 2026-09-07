package com.rafeeq.companion.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp

/**
 * عارض ماركداون خفيف مصمّم لردود المساعد:
 * عناوين، نقاط، قوائم مرقّمة، **عريض**، *مائل*، `كود`، وكتل كود.
 * كتبناه يدويًا بدل مكتبة كاملة لتفادي تضخيم حجم التطبيق.
 */
@Composable
fun RichText(
    text: String,
    modifier: Modifier = Modifier,
    color: Color = MaterialTheme.colorScheme.onSurface,
) {
    val blocks = remember(text) { parseBlocks(text) }

    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(6.dp)) {
        blocks.forEach { block ->
            when (block) {
                is Block.Heading -> Text(
                    text = inline(block.text),
                    style = when (block.level) {
                        1 -> MaterialTheme.typography.titleLarge
                        2 -> MaterialTheme.typography.titleMedium
                        else -> MaterialTheme.typography.titleSmall
                    },
                    fontWeight = FontWeight.Bold,
                    color = color,
                    modifier = Modifier.padding(top = 6.dp),
                )

                is Block.Bullet -> Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                ) {
                    Text(
                        "•",
                        style = MaterialTheme.typography.bodyLarge,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = inline(block.text),
                        style = MaterialTheme.typography.bodyMedium,
                        color = color,
                        modifier = Modifier.weight(1f),
                    )
                }

                is Block.Numbered -> Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.Top,
                ) {
                    Text(
                        "${block.number}.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = inline(block.text),
                        style = MaterialTheme.typography.bodyMedium,
                        color = color,
                        modifier = Modifier.weight(1f),
                    )
                }

                is Block.Code -> Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(MaterialTheme.colorScheme.surfaceContainerHighest)
                        .padding(12.dp),
                ) {
                    Text(
                        text = block.text,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        color = color,
                        modifier = Modifier.horizontalScroll(rememberScrollState()),
                    )
                }

                is Block.Divider -> Spacer(
                    Modifier
                        .fillMaxWidth()
                        .height(1.dp)
                        .background(MaterialTheme.colorScheme.outlineVariant),
                )

                is Block.Paragraph -> Text(
                    text = inline(block.text),
                    style = MaterialTheme.typography.bodyMedium,
                    color = color,
                )
            }
        }
    }
}

private sealed interface Block {
    data class Heading(val level: Int, val text: String) : Block
    data class Bullet(val text: String) : Block
    data class Numbered(val number: Int, val text: String) : Block
    data class Paragraph(val text: String) : Block
    data class Code(val text: String) : Block
    data object Divider : Block
}

private fun parseBlocks(input: String): List<Block> {
    val blocks = mutableListOf<Block>()
    val lines = input.replace("\r\n", "\n").split("\n")
    var i = 0
    val paragraph = StringBuilder()

    fun flushParagraph() {
        if (paragraph.isNotBlank()) blocks += Block.Paragraph(paragraph.toString().trim())
        paragraph.clear()
    }

    while (i < lines.size) {
        val line = lines[i]
        val trimmed = line.trim()
        when {
            trimmed.startsWith("```") -> {
                flushParagraph()
                val code = StringBuilder()
                i++
                while (i < lines.size && !lines[i].trim().startsWith("```")) {
                    code.appendLine(lines[i]); i++
                }
                blocks += Block.Code(code.toString().trimEnd())
            }

            trimmed.isEmpty() -> flushParagraph()

            trimmed == "---" || trimmed == "___" || trimmed == "***" -> {
                flushParagraph(); blocks += Block.Divider
            }

            trimmed.startsWith("#") -> {
                flushParagraph()
                val level = trimmed.takeWhile { it == '#' }.length.coerceIn(1, 3)
                blocks += Block.Heading(level, trimmed.dropWhile { it == '#' }.trim())
            }

            trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ") -> {
                flushParagraph()
                blocks += Block.Bullet(trimmed.drop(2).trim())
            }

            Regex("^\\d+[.)]\\s+").containsMatchIn(trimmed) -> {
                flushParagraph()
                val number = trimmed.takeWhile { it.isDigit() }.toIntOrNull() ?: 1
                blocks += Block.Numbered(number, trimmed.replace(Regex("^\\d+[.)]\\s+"), ""))
            }

            else -> {
                if (paragraph.isNotEmpty()) paragraph.append(' ')
                paragraph.append(trimmed)
            }
        }
        i++
    }
    flushParagraph()
    return blocks
}

/** يعالج التنسيق داخل السطر: **عريض** و*مائل* و`كود` و~~مشطوب~~. */
private fun inline(text: String): AnnotatedString = buildAnnotatedString {
    var i = 0
    while (i < text.length) {
        when {
            text.startsWith("**", i) -> {
                val end = text.indexOf("**", i + 2)
                if (end > 0) {
                    withStyleSpan(SpanStyle(fontWeight = FontWeight.Bold)) {
                        append(text.substring(i + 2, end))
                    }
                    i = end + 2
                } else { append(text[i]); i++ }
            }
            text.startsWith("`", i) -> {
                val end = text.indexOf("`", i + 1)
                if (end > 0) {
                    withStyleSpan(SpanStyle(fontFamily = FontFamily.Monospace)) {
                        append(text.substring(i + 1, end))
                    }
                    i = end + 1
                } else { append(text[i]); i++ }
            }
            text.startsWith("~~", i) -> {
                val end = text.indexOf("~~", i + 2)
                if (end > 0) {
                    withStyleSpan(SpanStyle(textDecoration = TextDecoration.LineThrough)) {
                        append(text.substring(i + 2, end))
                    }
                    i = end + 2
                } else { append(text[i]); i++ }
            }
            text.startsWith("*", i) && i + 1 < text.length && text[i + 1] != ' ' -> {
                val end = text.indexOf("*", i + 1)
                if (end > 0) {
                    withStyleSpan(SpanStyle(fontStyle = FontStyle.Italic)) {
                        append(text.substring(i + 1, end))
                    }
                    i = end + 1
                } else { append(text[i]); i++ }
            }
            else -> { append(text[i]); i++ }
        }
    }
}

private inline fun androidx.compose.ui.text.AnnotatedString.Builder.withStyleSpan(
    style: SpanStyle,
    block: androidx.compose.ui.text.AnnotatedString.Builder.() -> Unit,
) {
    val index = pushStyle(style)
    block()
    pop(index)
}

package com.rafeeq.companion.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.voice.ElevenLabs
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.SwitchRow
import kotlinx.coroutines.launch

/**
 * شاشة الصوت الواقعي.
 *
 * الأصوات تُجلب من حساب المستخدم لا من قائمة مضمّنة: معرّفات ElevenLabs
 * مرتبطة بالحساب، وأي معرّف نكتبه هنا قد لا يعمل عند غيرنا.
 */
@Composable
fun VoiceScreen(viewModel: AppViewModel) {
    val settings by viewModel.settings.collectAsState()
    val scope = rememberCoroutineScope()

    var key by remember { mutableStateOf("") }
    var keyState by remember { mutableStateOf("") }
    var checking by remember { mutableStateOf(false) }
    var voices by remember { mutableStateOf<List<ElevenLabs.Voice>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var loadError by remember { mutableStateOf("") }
    var arabicOnly by remember { mutableStateOf(true) }

    fun loadVoices() {
        if (settings.elevenKey.isBlank()) return
        loading = true
        loadError = ""
        scope.launch {
            runCatching { ElevenLabs.voices(settings.elevenKey) }
                .onSuccess { voices = it }
                .onFailure { loadError = ElevenLabs.friendly(it) }
            loading = false
        }
    }

    LazyColumn(
        contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 120.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "الصوت الواقعي",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "أصوات ElevenLabs تُحاسَب بالحرف على حسابك أنت. بدون مفتاح يبقى " +
                    "النطق عاملًا بأصوات هاتفك — مجّانًا وبلا إنترنت، لكنها آلية النبرة.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        item { SectionTitle("المفتاح") }
        item {
            GlassCard {
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = { Text(if (settings.elevenKey.isBlank()) "sk_..." else "مضبوط ✓ — الصق مفتاحًا جديدًا") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    enabled = key.isNotBlank() && !checking,
                    onClick = {
                        checking = true
                        keyState = ""
                        scope.launch {
                            val candidate = key.trim()
                            val result = ElevenLabs.testKey(candidate)
                            checking = false
                            if (result.isSuccess) {
                                viewModel.setElevenKey(candidate)
                                keyState = "✅ المفتاح يعمل"
                                key = ""
                                loadVoices()
                            } else {
                                keyState = "⚠️ " +
                                    ElevenLabs.friendly(result.exceptionOrNull() ?: Exception())
                            }
                        }
                    },
                ) { Text(if (checking) "أتحقّق…" else "حفظ وتحقّق") }

                if (keyState.isNotBlank()) {
                    Text(keyState, style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp))
                }
            }
        }

        if (settings.elevenKey.isNotBlank()) {
            item {
                Row(
                    Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionTitle(
                        if (settings.elevenVoiceName.isBlank()) "اختر صوتًا"
                        else "الصوت: ${settings.elevenVoiceName}",
                    )
                    Spacer(Modifier.weight(1f))
                    TextButton(onClick = { loadVoices() }) {
                        Text(if (loading) "أجلب…" else "تحديث")
                    }
                }
            }

            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf(true to "العربية فقط", false to "الكل").forEach { (only, label) ->
                        TextButton(onClick = { arabicOnly = only }) {
                            Text(
                                label,
                                fontWeight = if (arabicOnly == only) FontWeight.Bold
                                else FontWeight.Normal,
                            )
                        }
                    }
                }
            }

            if (loadError.isNotBlank()) {
                item {
                    Text(loadError, color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall)
                }
            }

            val shown = if (arabicOnly) voices.filter { it.isArabic } else voices

            if (shown.isEmpty() && !loading && loadError.isBlank()) {
                item {
                    GlassCard {
                        Text(
                            if (voices.isEmpty()) "اضغط «تحديث» لجلب أصواتك."
                            else "ما في أصوات عربية في حسابك. أضِف صوتًا من مكتبة " +
                                "ElevenLabs، أو اعرض «الكل» — النماذج متعدّدة اللغات " +
                                "تنطق العربية بأي صوت، بجودة تتفاوت.",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            items(shown, key = { it.id }) { voice ->
                val selected = settings.elevenVoiceId == voice.id
                GlassCard(padding = PaddingValues(12.dp)) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.setElevenVoice(voice.id, voice.name) },
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(
                                voice.name,
                                fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                            )
                            if (voice.accent.isNotBlank()) {
                                Text(
                                    voice.accent,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                        }
                        if (selected) Text("✓", fontWeight = FontWeight.Bold)
                    }
                }
            }

            item { SectionTitle("النموذج") }
            items(ElevenLabs.models, key = { it.id }) { model ->
                val selected = settings.elevenModel == model.id
                GlassCard(padding = PaddingValues(12.dp)) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clickable { viewModel.setElevenModel(model.id) },
                    ) {
                        Text(
                            model.arabic + if (selected) "  ✓" else "",
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                        )
                        Text(
                            model.hint,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }

            item { SectionTitle("النبرة") }
            item {
                GlassCard {
                    Tune(
                        "الثبات",
                        "أقل = تعبير أكثر · أعلى = نبرة رتيبة ومستقرّة",
                        settings.elevenStability, 0f..1f,
                    ) {
                        viewModel.setElevenTuning(it, settings.elevenSimilarity, settings.elevenSpeed)
                    }
                    Tune("القرب من الصوت الأصلي", null, settings.elevenSimilarity, 0f..1f) {
                        viewModel.setElevenTuning(settings.elevenStability, it, settings.elevenSpeed)
                    }
                    Tune("السرعة", null, settings.elevenSpeed, 0.7f..1.2f) {
                        viewModel.setElevenTuning(settings.elevenStability, settings.elevenSimilarity, it)
                    }
                }
            }
        }

        item { SectionTitle("الإملاء") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SwitchRow(
                    title = "تفريغ أدقّ للعربية (Scribe)",
                    subtitle = "يرفع تسجيلك إلى ElevenLabs بدل محرّك الهاتف — أدقّ في " +
                        "اللهجات، ويحتاج مفتاحًا واتصالًا",
                    checked = settings.useScribe && settings.elevenKey.isNotBlank(),
                    onCheckedChange = { viewModel.setUseScribe(it) },
                )
            }
        }
    }
}

@Composable
private fun Tune(
    label: String,
    hint: String?,
    value: Float,
    range: ClosedFloatingPointRange<Float>,
    onChange: (Float) -> Unit,
) {
    Column(Modifier.padding(vertical = 6.dp)) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
            Text(String.format("%.2f", value), style = MaterialTheme.typography.bodySmall)
        }
        Slider(value = value, onValueChange = onChange, valueRange = range)
        if (hint != null) {
            Text(
                hint,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

package com.rafeeq.companion.ui.screens

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
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.ai.Provider
import com.rafeeq.companion.data.ai.Providers
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.SectionTitle
import kotlinx.coroutines.launch

/**
 * اختيار مزوّد النموذج.
 *
 * لكل مزوّد مفتاحه ونموذجه، فالتبديل بينها لا يفقد شيئًا ولا يُعاد لصق مفتاح
 * في كل مرّة. والمفاتيح كلها تبقى على الجهاز ولا تُرسل إلا إلى مزوّدها.
 */
@Composable
fun ProviderScreen(viewModel: AppViewModel) {
    val settings by viewModel.settings.collectAsState()
    val scope = rememberCoroutineScope()

    var key by remember { mutableStateOf("") }
    var state by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var fetched by remember { mutableStateOf<List<String>>(emptyList()) }
    var modelsState by remember { mutableStateOf("") }

    val active = settings.activeProvider
    val isAnthropic = active.kind == Provider.Kind.ANTHROPIC
    val hasKey = if (isAnthropic) settings.apiKey.isNotBlank()
    else settings.providerKeys[active.id].orEmpty().isNotBlank()

    LazyColumn(
        contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 120.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "النموذج والمزوّد",
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "لست محبوسًا في نموذج واحد. لكل مزوّد مفتاحه ونموذجه، والتبديل " +
                    "بينها لا يفقد شيئًا.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        item { SectionTitle("المزوّد") }
        items(Providers.all, key = { it.id }) { one ->
            val selected = settings.provider == one.id
            val configured = if (one.kind == Provider.Kind.ANTHROPIC) {
                settings.apiKey.isNotBlank()
            } else {
                settings.providerKeys[one.id].orEmpty().isNotBlank()
            }
            GlassCard(padding = PaddingValues(12.dp)) {
                Column(
                    Modifier
                        .fillMaxWidth()
                        .clickable {
                            viewModel.setProvider(one.id)
                            key = ""
                            state = ""
                            fetched = emptyList()
                            modelsState = ""
                        },
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            one.label,
                            fontWeight = if (selected) FontWeight.Bold else FontWeight.Medium,
                            modifier = Modifier.weight(1f),
                        )
                        if (configured && !selected) Text("✓", color = MaterialTheme.colorScheme.primary)
                        if (selected) Text("●", color = MaterialTheme.colorScheme.primary)
                    }
                    Text(
                        one.note,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
        }

        item { SectionTitle("النموذج") }
        item {
            GlassCard {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    active.models.filter { it.id.isNotBlank() }.forEach { model ->
                        TextButton(onClick = {
                            if (isAnthropic) viewModel.setAiModel(model.id)
                            else viewModel.setProviderModel(active.id, model.id)
                        }) {
                            Text(
                                model.label,
                                fontWeight = if (settings.activeModel == model.id) {
                                    FontWeight.Bold
                                } else {
                                    FontWeight.Normal
                                },
                            )
                        }
                    }
                }
                Spacer(Modifier.height(6.dp))
                // معرّفات النماذج تتبدّل أسرع من أي قائمة نكتبها، فنترك الحقل حرًّا.
                OutlinedTextField(
                    value = settings.activeModel,
                    onValueChange = { value ->
                        if (isAnthropic) viewModel.setAiModel(value.trim())
                        else viewModel.setProviderModel(active.id, value.trim())
                    },
                    label = { Text("أو اكتب معرّف نموذج آخر") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )

                /*
                 * المعرّفات المكتوبة فوق اقتراحاتٌ تَقدُم. هذا الزرّ يسأل
                 * حساب المستخدم نفسه عمّا يملكه فعلًا، فلا يبقى «النموذج غير
                 * موجود» لغزًا يحلّه بالتخمين.
                 */
                if (!isAnthropic) {
                    Spacer(Modifier.height(6.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        TextButton(
                            enabled = hasKey && !busy,
                            onClick = {
                                busy = true
                                modelsState = ""
                                scope.launch {
                                    viewModel.fetchModels(active.id).fold(
                                        onSuccess = {
                                            fetched = it
                                            modelsState = if (it.isEmpty()) {
                                                "ما رجع أي نموذج."
                                            } else {
                                                "${it.size} نموذجًا متاحًا لمفتاحك"
                                            }
                                        },
                                        onFailure = { error ->
                                            fetched = emptyList()
                                            modelsState = "⚠️ " +
                                                com.rafeeq.companion.data.ai.OpenAiRunner
                                                    .friendly(error, active)
                                        },
                                    )
                                    busy = false
                                }
                            },
                        ) { Text(if (hasKey) "اجلب النماذج من حسابي" else "احفظ مفتاحًا أولًا") }

                        if (modelsState.isNotBlank()) {
                            Text(
                                modelsState,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }
            }
        }

        items(fetched, key = { "model-$it" }) { id ->
            GlassCard(padding = PaddingValues(10.dp)) {
                Text(
                    id,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (settings.activeModel == id) FontWeight.Bold
                    else FontWeight.Normal,
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.setProviderModel(active.id, id) },
                )
            }
        }

        if (active.editableUrl) {
            item { SectionTitle("عنوان الخدمة") }
            item {
                GlassCard {
                    OutlinedTextField(
                        value = settings.activeUrl,
                        onValueChange = { viewModel.setProviderUrl(active.id, it.trim()) },
                        label = { Text("https://…/v1") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }

        item { SectionTitle("المفتاح") }
        item {
            GlassCard {
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = {
                        Text(if (hasKey) "مضبوط ✓ — الصق مفتاحًا جديدًا لتغييره" else "الصق مفتاحك")
                    },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        enabled = key.isNotBlank() && !busy,
                        onClick = {
                            busy = true
                            state = ""
                            scope.launch {
                                val value = key.trim()
                                if (isAnthropic) viewModel.setApiKeyNow(value)
                                else viewModel.setProviderKeyNow(active.id, value)
                                val result = viewModel.testProvider(active.id)
                                busy = false
                                state = if (result == null) "✅ يعمل" else "⚠️ $result"
                                if (result == null) key = ""
                            }
                        },
                    ) { Text(if (busy) "أتحقّق…" else "حفظ وتحقّق") }

                    if (hasKey) {
                        TextButton(
                            enabled = !busy,
                            onClick = {
                                busy = true
                                state = ""
                                scope.launch {
                                    val result = viewModel.testProvider(active.id)
                                    busy = false
                                    state = if (result == null) "✅ يعمل" else "⚠️ $result"
                                }
                            },
                        ) { Text("جرّب الاتصال") }
                    }
                }
                if (state.isNotBlank()) {
                    Text(
                        state,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                if (active.keyUrl.isNotBlank()) {
                    TextButton(onClick = { viewModel.openUrl(active.keyUrl) }) {
                        Text("من وين أجيب مفتاحًا؟ ↗")
                    }
                }
            }
        }

        item {
            Text(
                "المفتاح يُحفظ على جهازك ولا يُرسل إلا إلى مزوّده. ما يفقده غير " +
                    "Anthropic: البحث في الإنترنت من داخل التطبيق، ورؤية لقطات الشاشة، " +
                    "والتخزين المؤقت للبادئة. بقية الأدوات تعمل مع الجميع.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 4.dp),
            )
        }
    }
}

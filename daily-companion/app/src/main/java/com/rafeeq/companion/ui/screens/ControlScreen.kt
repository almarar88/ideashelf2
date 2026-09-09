package com.rafeeq.companion.ui.screens

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.rafeeq.companion.data.control.Capability
import com.rafeeq.companion.data.control.ToolCatalog
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.safeBottomSpace
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.GradientCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.SecondaryButton
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.SwitchRow
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.Gradients

/**
 * شاشة التحكّم: تشرح ما يستطيع المساعد فعله بهاتفك، وتتيح تفعيل كل قدرة على حدة.
 * لا شيء مفعّل تلقائيًا — كل صلاحية يمنحها المستخدم بنفسه ويستطيع سحبها متى شاء.
 */
@Composable
fun ControlScreen(viewModel: AppViewModel) {
    val settings by viewModel.settings.collectAsState()
    val capabilities by viewModel.capabilities.collectAsState()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // نعيد فحص الصلاحيات كلما رجع المستخدم من إعدادات النظام.
    LaunchedEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) viewModel.refreshCapabilities()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
    }

    val runtimePermissions = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { viewModel.refreshCapabilities() }

    val enabledCount = Capability.entries.count { it != Capability.NONE && it in capabilities }
    val totalCount = Capability.entries.count { it != Capability.NONE }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = safeBottomSpace()),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        item {
            Column {
                Text(
                    "التحكّم بالهاتف",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "امنح Alcode Ai ما تريده فقط — وكل صلاحية يمكن سحبها في أي وقت.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            GradientCard(colors = Gradients.Dusk) {
                Text(
                    "$enabledCount من $totalCount قدرات مفعّلة",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    if (Capability.ACCESSIBILITY in capabilities) {
                        "التحكّم الكامل مفعّل. يستطيع Alcode Ai فتح التطبيقات والضغط والكتابة نيابةً عنك."
                    } else {
                        "لتحكّم كامل داخل التطبيقات الأخرى، فعّل «خدمة الوصول» أدناه. " +
                            "بدونها يبقى Alcode Ai قادرًا على فتح التطبيقات وضبط المنبّهات والاتصال والرسائل."
                    },
                    style = MaterialTheme.typography.bodyMedium,
                    color = Color.White.copy(alpha = 0.92f),
                )
            }
        }

        // ------------------------------------------------ الإعدادات العامة
        item { SectionTitle("الإعدادات") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SwitchRow(
                    title = "تفعيل التحكّم بالهاتف",
                    subtitle = "حين يُطفأ، يصبح المساعد للمحادثة فقط ولا ينفّذ أي أمر",
                    checked = settings.controlEnabled,
                    onCheckedChange = { viewModel.setControlEnabled(it) },
                )
                SwitchRow(
                    title = "تأكيد الأوامر الحسّاسة",
                    subtitle = if (settings.confirmSensitive)
                        "يسألك قبل الاتصال أو إرسال رسالة أو مسح الإشعارات"
                    else
                        "معطّل — الأوامر تُنفَّذ فور صدورها بلا سؤال، بما فيها المكالمات والرسائل",
                    checked = settings.confirmSensitive,
                    onCheckedChange = { viewModel.setConfirmSensitive(it) },
                )
                SwitchRow(
                    title = "الرد بالصوت",
                    subtitle = "يقرأ الرد بصوت عالٍ حين تسأله صوتيًا",
                    checked = settings.voiceReplies,
                    onCheckedChange = { viewModel.setVoiceReplies(it) },
                )
            }
        }

        // ------------------------------------------------ زر التشغيل
        item { SectionTitle("استدعاء Alcode Ai بزر التشغيل") }
        item {
            GlassCard {
                Text(
                    "اجعل Alcode Ai مساعدك الافتراضي ليظهر عند الضغط المطوّل على زر التشغيل — " +
                        "تمامًا كما يظهر مساعد جوجل.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(10.dp))
                Text(
                    "الخطوات:\n" +
                        "١. اضغط الزر أدناه لفتح إعدادات المساعد.\n" +
                        "٢. اختر «تطبيق المساعد الرقمي» ثم اختر «Alcode Ai».\n" +
                        "٣. من الإعدادات ← النظام ← الإيماءات ← «الضغط المطوّل على زر التشغيل»، " +
                        "فعّل «المساعد الرقمي».",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "أسماء الشاشات تختلف قليلًا بين الأجهزة (سامسونج، شاومي، هواوي).",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(14.dp))
                PrimaryButton("افتح إعدادات المساعد") {
                    if (!viewModel.phone.openAssistantSettings()) {
                        viewModel.showMessage("لم أجد الشاشة على هذا الجهاز — ابحث في الإعدادات عن «المساعد».")
                    }
                }
            }
        }

        // ------------------------------------------------ القدرات
        item { SectionTitle("القدرات") }

        val entries = listOf(
            Capability.ACCESSIBILITY to true,
            Capability.NOTIFICATION_ACCESS to true,
            Capability.DND_ACCESS to true,
            Capability.WRITE_SETTINGS to true,
            Capability.CONTACTS to false,
            Capability.PHONE to false,
            Capability.SMS to false,
            Capability.CALENDAR to false,
        )

        items(entries) { (capability, viaSystemScreen) ->
            CapabilityRow(
                capability = capability,
                enabled = capability in capabilities,
                onEnable = {
                    if (viaSystemScreen) {
                        viewModel.phone.openCapabilitySettings(capability)
                    } else {
                        runtimePermissions.launch(permissionsFor(capability))
                    }
                },
            )
        }

        // ------------------------------------------------ ما يستطيع فعله
        item { SectionTitle("ما يستطيع Alcode Ai تنفيذه") }
        item {
            GlassCard {
                val available = ToolCatalog.all.count {
                    it.capability == Capability.NONE || it.capability in capabilities
                }
                Text(
                    "$available أمرًا متاحًا الآن من أصل ${ToolCatalog.all.size}",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(10.dp))
                listOf(
                    "«افتح واتساب وأرسل لأحمد أني متأخر»",
                    "«ضبط منبّه ٦ ونص الصبح»",
                    "«كم البطارية وكيف الجو؟»",
                    "«شغّل الكشّاف وخفّض السطوع»",
                    "«اقرأ إشعاراتي ولخّصها لي»",
                    "«وجّهني إلى أقرب صيدلية»",
                ).forEach {
                    Text(
                        "• $it",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(vertical = 2.dp),
                    )
                }
            }
        }

        // ------------------------------------------------ الحدود
        item {
            GlassCard {
                Text(
                    "ما لا يستطيع أي تطبيق فعله",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "أندرويد يمنع التطبيقات من تبديل وضع الطيران أو الواي فاي أو بيانات الجوّال " +
                        "برمجيًا، مهما كانت الأذونات. في هذه الحالات يفتح لك Alcode Ai الشاشة الصحيحة، " +
                        "ومع خدمة الوصول يستطيع الضغط على المفتاح نيابةً عنك.\n\n" +
                        "كذلك لا يستطيع قراءة بيانات التطبيقات الأخرى مباشرة — يقرأ ما هو معروض " +
                        "على الشاشة فقط.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        item {
            GlassCard {
                Text(
                    "الخصوصية",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                )
                Spacer(Modifier.height(8.dp))
                Text(
                    "لا يقرأ Alcode Ai شاشتك ولا إشعاراتك إلا في اللحظة التي تطلب فيها أمرًا يحتاج ذلك، " +
                        "وما يُقرأ يُرسل إلى Anthropic ضمن سؤالك فقط ولا يُخزَّن عندنا.\n\n" +
                        "ولأن ما يظهر على الشاشة يكتبه آخرون، فقد بُرمج المساعد ليعامله كمعلومات " +
                        "لا كأوامر — فلا تستطيع رسالة واردة أن توجّهه لفعل شيء.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

private fun permissionsFor(capability: Capability): Array<String> = when (capability) {
    Capability.CONTACTS -> arrayOf(Manifest.permission.READ_CONTACTS)
    Capability.PHONE -> arrayOf(Manifest.permission.CALL_PHONE)
    Capability.SMS -> arrayOf(Manifest.permission.SEND_SMS, Manifest.permission.READ_SMS)
    Capability.CALENDAR -> arrayOf(
        Manifest.permission.READ_CALENDAR,
        Manifest.permission.WRITE_CALENDAR,
    )
    Capability.CAMERA -> arrayOf(Manifest.permission.CAMERA)
    Capability.CALL_LOG -> arrayOf(Manifest.permission.READ_CALL_LOG)
    else -> emptyArray()
}

@Composable
private fun CapabilityRow(
    capability: Capability,
    enabled: Boolean,
    onEnable: () -> Unit,
) {
    GlassCard(padding = PaddingValues(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(34.dp)
                    .clip(CircleShape)
                    .background(
                        if (enabled) Emerald.copy(alpha = 0.18f)
                        else MaterialTheme.colorScheme.surfaceContainerHighest,
                    ),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    if (enabled) Icons.Filled.CheckCircle else Icons.Filled.RadioButtonUnchecked,
                    contentDescription = null,
                    tint = if (enabled) Emerald else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp),
                )
            }
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    capability.arabic,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    capability.why,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.width(8.dp))
            if (enabled) {
                Text(
                    "مفعّلة",
                    style = MaterialTheme.typography.labelMedium,
                    color = Emerald,
                    fontWeight = FontWeight.Bold,
                )
            } else {
                SecondaryButton("تفعيل") { onEnable() }
            }
        }

        if (capability == Capability.ACCESSIBILITY && !enabled) {
            Spacer(Modifier.height(10.dp))
            Box(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(MaterialTheme.colorScheme.surfaceContainerHighest.copy(alpha = 0.7f))
                    .padding(12.dp),
            ) {
                Text(
                    "بعد الضغط على «تفعيل»: اختر «Alcode Ai» من القائمة ثم شغّل المفتاح.\n" +
                        "إن ظهرت رسالة «إعداد مقيّد» على أندرويد ١٣ فأحدث، اذهب إلى " +
                        "الإعدادات ← التطبيقات ← Alcode Ai ← القائمة (⋮) ← «السماح بالإعدادات المقيّدة».",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

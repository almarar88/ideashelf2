package com.rafeeq.companion.ui.screens

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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.Bolt
import androidx.compose.material.icons.filled.Brightness4
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PhonelinkSetup
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.data.Place
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.HighLatitudeRule
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.PickerDialog
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.SectionTitle
import com.rafeeq.companion.ui.components.SettingRow
import com.rafeeq.companion.ui.components.SwitchRow
import com.rafeeq.companion.ui.theme.Amber
import com.rafeeq.companion.ui.theme.Cyan
import com.rafeeq.companion.ui.theme.Emerald
import com.rafeeq.companion.ui.theme.ThemeMode
import com.rafeeq.companion.ui.theme.Violet
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    viewModel: AppViewModel,
    onOpenSources: () -> Unit,
    onOpenControl: () -> Unit = {},
) {
    val settings by viewModel.settings.collectAsState()
    val locating by viewModel.locating.collectAsState()

    var showPlacePicker by remember { mutableStateOf(false) }
    var showMethodPicker by remember { mutableStateOf(false) }
    var showAsrPicker by remember { mutableStateOf(false) }
    var showHighLatPicker by remember { mutableStateOf(false) }
    var showModelPicker by remember { mutableStateOf(false) }
    var showEffortPicker by remember { mutableStateOf(false) }
    var showThemePicker by remember { mutableStateOf(false) }
    var showApiKeyDialog by remember { mutableStateOf(false) }
    var showOffsets by remember { mutableStateOf(false) }
    var showPersona by remember { mutableStateOf(false) }
    var showNameDialog by remember { mutableStateOf(false) }

    LazyColumn(
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 30.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Text(
                "الإعدادات",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(bottom = 4.dp),
            )
        }

        // ------------------------------------------------ الموقع
        item { SectionTitle("الموقع") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "موقعي",
                    value = settings.place?.name ?: "غير محدّد",
                    subtitle = settings.place?.let { "${it.latitude.format()} , ${it.longitude.format()}" }
                        ?: "يُستخدم للطقس وأوقات الصلاة والقبلة",
                    icon = Icons.Filled.LocationOn,
                    tint = Cyan,
                ) { showPlacePicker = true }

                SettingRow(
                    title = if (locating) "جارٍ تحديد موقعك…" else "تحديد الموقع تلقائيًا",
                    subtitle = "يستخدم مزوّد الموقع في نظامك دون خدمات خارجية",
                    icon = Icons.Filled.MyLocation,
                    tint = Emerald,
                ) { if (!locating) viewModel.detectLocation() }
            }
        }

        // ------------------------------------------------ الصلاة
        item { SectionTitle("الصلاة") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "طريقة الحساب",
                    value = settings.calculationMethod.arabic.substringBefore(" —"),
                    icon = Icons.Filled.Schedule,
                    tint = Emerald,
                ) { showMethodPicker = true }

                SettingRow(title = "مذهب العصر", value = settings.asrMethod.arabic.substringBefore(" (")) {
                    showAsrPicker = true
                }

                SettingRow(title = "خطوط العرض العالية", value = settings.highLatitudeRule.arabic) {
                    showHighLatPicker = true
                }

                SettingRow(
                    title = "تعديل الأوقات يدويًا",
                    subtitle = "أضِف أو اطرح دقائق لكل صلاة لمطابقة مسجدك",
                    value = if (settings.prayerOffsets.values.any { it != 0 }) "مضبوط" else "افتراضي",
                ) { showOffsets = true }

                SettingRow(
                    title = "تنبيه قبل الأذان",
                    value = if (settings.preAdhanMinutes == 0) "معطّل" else "${settings.preAdhanMinutes} دقيقة",
                    icon = Icons.Filled.Notifications,
                    tint = Amber,
                ) {
                    val options = listOf(0, 5, 10, 15, 20, 30)
                    val next = options[(options.indexOf(settings.preAdhanMinutes)
                        .takeIf { it >= 0 }?.plus(1) ?: 0) % options.size]
                    viewModel.setPreAdhanMinutes(next)
                }

                SettingRow(
                    title = "تعديل التاريخ الهجري",
                    value = when {
                        settings.hijriOffset > 0 -> "+${settings.hijriOffset} يوم"
                        settings.hijriOffset < 0 -> "${settings.hijriOffset} يوم"
                        else -> "بدون تعديل"
                    },
                ) {
                    val next = if (settings.hijriOffset >= 2) -2 else settings.hijriOffset + 1
                    viewModel.setHijriOffset(next)
                }
            }
        }

        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                Text(
                    "تنبيهات الصلوات",
                    style = MaterialTheme.typography.labelLarge,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Prayer.entries.filter { it.isObligatory }.forEach { prayer ->
                    SwitchRow(
                        title = prayer.arabic,
                        checked = prayer.key in settings.prayerNotifications,
                        onCheckedChange = { viewModel.togglePrayerNotification(prayer, it) },
                    )
                }
            }
        }

        // ------------------------------------------------ المساعد
        item { SectionTitle("المساعد الذكي") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "مفتاح Anthropic",
                    value = if (settings.hasApiKey) "مضبوط ✓" else "غير مضبوط",
                    subtitle = "يُحفظ على جهازك فقط ولا يُشارك مع أي طرف آخر",
                    icon = Icons.Filled.AutoAwesome,
                    tint = Violet,
                ) { showApiKeyDialog = true }

                SettingRow(
                    title = "النموذج",
                    value = ClaudeClient.models.firstOrNull { it.id == settings.aiModel }?.label
                        ?: settings.aiModel,
                    icon = Icons.Filled.Bolt,
                    tint = Cyan,
                ) { showModelPicker = true }

                SettingRow(
                    title = "مستوى التفكير",
                    value = ClaudeClient.effortLevels.firstOrNull { it.first == settings.aiEffort }?.second
                        ?: settings.aiEffort,
                    subtitle = "أعلى = إجابات أعمق وأبطأ وأعلى كلفة",
                ) { showEffortPicker = true }

                SettingRow(
                    title = "تعليمات شخصية",
                    subtitle = "أخبر المساعد كيف تحب أن يخاطبك",
                    value = if (settings.aiPersona.isNotBlank()) "مضبوط" else "لا شيء",
                ) { showPersona = true }

                SwitchRow(
                    title = "إشعار الموجز الصباحي",
                    subtitle = "تذكير يومي الساعة ${settings.briefHour}:00",
                    checked = settings.briefNotification,
                    onCheckedChange = { viewModel.setBriefNotification(it) },
                )

                if (settings.briefNotification) {
                    SettingRow(title = "وقت الموجز", value = "${settings.briefHour}:00") {
                        viewModel.setBriefHour(if (settings.briefHour >= 11) 5 else settings.briefHour + 1)
                    }
                }
            }
        }

        // ------------------------------------------------ التحكّم بالهاتف
        item { SectionTitle("التحكّم بالهاتف") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "صلاحيات التحكّم",
                    subtitle = "ما يستطيع Alcode Ai فعله بهاتفك — وتفعيله بزر التشغيل",
                    value = if (settings.controlEnabled) "مفعّل" else "معطّل",
                    icon = Icons.Filled.PhonelinkSetup,
                    tint = Emerald,
                ) { onOpenControl() }
            }
        }

        // ------------------------------------------------ الأخبار
        item { SectionTitle("الأخبار") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "المصادر والمواضيع",
                    subtitle = "اختر ما يصلك، وأضِف مواضيع بكلماتك",
                    icon = Icons.Filled.Tune,
                    tint = Amber,
                ) { onOpenSources() }

                SettingRow(
                    title = "فترة التحديث",
                    value = "${settings.newsRefreshMinutes} دقيقة",
                ) {
                    val options = listOf(15, 30, 60, 120)
                    val next = options[(options.indexOf(settings.newsRefreshMinutes)
                        .takeIf { it >= 0 }?.plus(1) ?: 0) % options.size]
                    viewModel.setNewsRefreshMinutes(next)
                }
            }
        }

        // ------------------------------------------------ المظهر
        item { SectionTitle("المظهر والعرض") }
        item {
            GlassCard(padding = PaddingValues(6.dp)) {
                SettingRow(
                    title = "السِمة",
                    value = when (settings.themeMode) {
                        ThemeMode.SYSTEM -> "حسب النظام"
                        ThemeMode.LIGHT -> "فاتح"
                        ThemeMode.DARK -> "داكن"
                    },
                    icon = Icons.Filled.Brightness4,
                    tint = Violet,
                ) { showThemePicker = true }

                SwitchRow(
                    title = "ألوان من خلفية جهازك",
                    subtitle = "يتطلب أندرويد ١٢ أو أحدث",
                    checked = settings.dynamicColor,
                    onCheckedChange = { viewModel.setDynamicColor(it) },
                )

                SwitchRow(
                    title = "نظام ٢٤ ساعة",
                    checked = settings.use24hClock,
                    onCheckedChange = { viewModel.setUse24h(it) },
                )

                SettingRow(
                    title = "اسمك",
                    value = settings.userName.ifBlank { "غير محدّد" },
                    subtitle = "يستخدمه المساعد في مخاطبتك",
                ) { showNameDialog = true }
            }
        }

        item {
            GlassCard {
                Text("Alcode Ai", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text(
                    "الإصدار ١٫٠٫٠ · يعمل بلا حسابات ولا تتبّع. " +
                        "بياناتك (المهام، الملاحظات، المحادثات، المفتاح) تُخزَّن على جهازك فقط.\n\n" +
                        "المصادر: أوقات الصلاة تُحسب فلكيًا داخل التطبيق، الطقس من Open-Meteo، " +
                        "الأخبار من موجزات RSS التي تختارها، والمساعد عبر Anthropic بمفتاحك الخاص.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }

    // ---------------------------------------------------------- الحوارات

    if (showPlacePicker) {
        PlacePickerDialog(
            viewModel = viewModel,
            onDismiss = { showPlacePicker = false },
            onSelect = { viewModel.selectPlace(it); showPlacePicker = false },
        )
    }

    if (showMethodPicker) {
        PickerDialog(
            title = "طريقة حساب أوقات الصلاة",
            options = CalculationMethod.entries.toList(),
            selected = settings.calculationMethod,
            label = { it.arabic },
            description = {
                if (it.ishaMinutes > 0) "الفجر ${it.fajrAngle}° · العشاء بعد المغرب بـ${it.ishaMinutes} دقيقة"
                else "الفجر ${it.fajrAngle}° · العشاء ${it.ishaAngle}°"
            },
            onDismiss = { showMethodPicker = false },
            onSelect = { viewModel.setCalculationMethod(it) },
        )
    }

    if (showAsrPicker) {
        PickerDialog(
            title = "مذهب حساب العصر",
            options = AsrMethod.entries.toList(),
            selected = settings.asrMethod,
            label = { it.arabic },
            onDismiss = { showAsrPicker = false },
            onSelect = { viewModel.setAsrMethod(it) },
        )
    }

    if (showHighLatPicker) {
        PickerDialog(
            title = "قاعدة خطوط العرض العالية",
            options = HighLatitudeRule.entries.toList(),
            selected = settings.highLatitudeRule,
            label = { it.arabic },
            onDismiss = { showHighLatPicker = false },
            onSelect = { viewModel.setHighLatitudeRule(it) },
        )
    }

    if (showModelPicker) {
        PickerDialog(
            title = "نموذج المساعد",
            options = ClaudeClient.models,
            selected = ClaudeClient.models.firstOrNull { it.id == settings.aiModel }
                ?: ClaudeClient.models.first(),
            label = { it.label },
            description = { it.description },
            onDismiss = { showModelPicker = false },
            onSelect = { viewModel.setAiModel(it.id) },
        )
    }

    if (showEffortPicker) {
        PickerDialog(
            title = "مستوى التفكير",
            options = ClaudeClient.effortLevels,
            selected = ClaudeClient.effortLevels.firstOrNull { it.first == settings.aiEffort }
                ?: ClaudeClient.effortLevels[1],
            label = { it.second },
            onDismiss = { showEffortPicker = false },
            onSelect = { viewModel.setAiEffort(it.first) },
        )
    }

    if (showThemePicker) {
        PickerDialog(
            title = "السِمة",
            options = ThemeMode.entries.toList(),
            selected = settings.themeMode,
            label = {
                when (it) {
                    ThemeMode.SYSTEM -> "حسب النظام"
                    ThemeMode.LIGHT -> "فاتح"
                    ThemeMode.DARK -> "داكن"
                }
            },
            onDismiss = { showThemePicker = false },
            onSelect = { viewModel.setThemeMode(it) },
        )
    }

    if (showApiKeyDialog) {
        ApiKeyDialog(viewModel = viewModel, onDismiss = { showApiKeyDialog = false })
    }

    if (showOffsets) {
        OffsetsDialog(viewModel = viewModel, onDismiss = { showOffsets = false })
    }

    if (showPersona) {
        var persona by remember { mutableStateOf(settings.aiPersona) }
        AlertDialog(
            onDismissRequest = { showPersona = false },
            title = { Text("تعليمات شخصية", fontWeight = FontWeight.Bold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "اكتب كيف تريد أن يتعامل معك المساعد. مثال: «اختصر دائمًا»، " +
                            "«خاطبني باللهجة الخليجية»، «أنا مهندس برمجيات فراعِ ذلك في أمثلتك».",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    RafeeqTextField(persona, { persona = it }, "التعليمات", singleLine = false, minLines = 4)
                }
            },
            confirmButton = {
                TextButton(onClick = { viewModel.setAiPersona(persona); showPersona = false }) {
                    Text("حفظ")
                }
            },
            dismissButton = { TextButton(onClick = { showPersona = false }) { Text("إلغاء") } },
        )
    }

    if (showNameDialog) {
        var name by remember { mutableStateOf(settings.userName) }
        AlertDialog(
            onDismissRequest = { showNameDialog = false },
            title = { Text("اسمك", fontWeight = FontWeight.Bold) },
            text = { RafeeqTextField(name, { name = it }, "الاسم") },
            confirmButton = {
                TextButton(onClick = { viewModel.setUserName(name.trim()); showNameDialog = false }) {
                    Text("حفظ")
                }
            },
            dismissButton = { TextButton(onClick = { showNameDialog = false }) { Text("إلغاء") } },
        )
    }
}

private fun Double.format(): String = String.format(java.util.Locale.ENGLISH, "%.4f", this)

@Composable
fun PlacePickerDialog(
    viewModel: AppViewModel,
    onDismiss: () -> Unit,
    onSelect: (Place) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<Place>>(emptyList()) }
    var searching by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val locating by viewModel.locating.collectAsState()

    LaunchedEffect(query) {
        if (query.length < 2) { results = emptyList(); return@LaunchedEffect }
        searching = true
        kotlinx.coroutines.delay(350) // نمنع إرسال طلب مع كل حرف
        results = viewModel.searchPlaces(query)
        searching = false
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("اختر موقعك", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                RafeeqTextField(
                    query, { query = it }, "ابحث عن مدينة",
                    placeholder = "الرياض، القاهرة، لندن…",
                    trailing = {
                        if (searching) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        else Icon(Icons.Filled.Search, contentDescription = null)
                    },
                )

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(enabled = !locating) {
                            scope.launch {
                                viewModel.detectLocation { success -> if (success) onDismiss() }
                            }
                        }
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(
                        Modifier.size(30.dp).clip(CircleShape)
                            .background(Emerald.copy(alpha = 0.16f)),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (locating) CircularProgressIndicator(Modifier.size(15.dp), strokeWidth = 2.dp)
                        else Icon(
                            Icons.Filled.MyLocation, contentDescription = null,
                            tint = Emerald, modifier = Modifier.size(16.dp),
                        )
                    }
                    Spacer(Modifier.width(10.dp))
                    Text(
                        if (locating) "جارٍ التحديد…" else "استخدم موقعي الحالي",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }

                results.forEach { place ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .clickable { onSelect(place) }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.LocationOn, contentDescription = null,
                            tint = Cyan, modifier = Modifier.size(17.dp),
                        )
                        Spacer(Modifier.width(10.dp))
                        Column {
                            Text(place.name, style = MaterialTheme.typography.bodyMedium)
                            Text(
                                listOf(place.admin, place.country).filter { it.isNotBlank() }
                                    .joinToString("، "),
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                }

                if (query.length >= 2 && results.isEmpty() && !searching) {
                    Text(
                        "لا نتائج. جرّب الاسم بالإنجليزية.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("إغلاق") } },
    )
}

@Composable
private fun ApiKeyDialog(viewModel: AppViewModel, onDismiss: () -> Unit) {
    val settings by viewModel.settings.collectAsState()
    var key by remember { mutableStateOf(settings.apiKey) }
    var checking by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var valid by remember { mutableStateOf<Boolean?>(null) }
    val scope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("مفتاح Anthropic", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    "أنشئ مفتاحًا من console.anthropic.com ثم الصقه هنا. " +
                        "المفتاح يُخزَّن في ذاكرة التطبيق على جهازك، ويُرسل إلى خوادم Anthropic فقط " +
                        "عند استخدام المساعد.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                RafeeqTextField(
                    key, { key = it; valid = null; status = null },
                    "المفتاح",
                    placeholder = "sk-ant-…",
                    isPassword = true,
                    keyboardType = KeyboardType.Password,
                )
                status?.let {
                    Text(
                        it,
                        style = MaterialTheme.typography.bodySmall,
                        color = if (valid == true) Emerald else MaterialTheme.colorScheme.error,
                    )
                }
                if (settings.hasApiKey) {
                    Row(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .clickable {
                                viewModel.setApiKey("")
                                key = ""
                                status = "حُذف المفتاح."
                                valid = null
                            }
                            .padding(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            Icons.Filled.Delete, contentDescription = null,
                            tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp),
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            "حذف المفتاح من الجهاز",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.error,
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = !checking,
                onClick = {
                    viewModel.setApiKey(key)
                    if (key.isBlank()) { onDismiss(); return@TextButton }
                    checking = true
                    status = "جارٍ التحقّق…"
                    scope.launch {
                        // ننتظر لحظة حتى يُحفظ المفتاح قبل التحقّق منه.
                        kotlinx.coroutines.delay(250)
                        val result = viewModel.validateApiKey()
                        checking = false
                        result.onSuccess {
                            valid = true
                            status = "المفتاح يعمل ✓"
                        }.onFailure {
                            valid = false
                            status = it.message ?: "فشل التحقّق."
                        }
                    }
                },
            ) {
                if (checking) CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text("حفظ وتحقّق")
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("إغلاق") } },
    )
}

@Composable
private fun OffsetsDialog(viewModel: AppViewModel, onDismiss: () -> Unit) {
    val settings by viewModel.settings.collectAsState()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تعديل الأوقات", fontWeight = FontWeight.Bold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    "اضبط فرق الدقائق لكل صلاة ليطابق التوقيت المعتمد في مسجدك.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(4.dp))
                Prayer.entries.forEach { prayer ->
                    val current = settings.prayerOffsets[prayer.key] ?: 0
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(prayer.arabic, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                        IconButton(
                            onClick = { viewModel.setPrayerOffset(prayer, current - 1) },
                            modifier = Modifier.size(32.dp),
                        ) { Text("−", style = MaterialTheme.typography.titleMedium) }
                        Text(
                            text = if (current > 0) "+$current" else "$current",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.width(38.dp),
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                        )
                        IconButton(
                            onClick = { viewModel.setPrayerOffset(prayer, current + 1) },
                            modifier = Modifier.size(32.dp),
                        ) { Text("+", style = MaterialTheme.typography.titleMedium) }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("تم") } },
    )
}

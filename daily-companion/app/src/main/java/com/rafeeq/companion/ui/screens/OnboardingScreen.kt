package com.rafeeq.companion.ui.screens

import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.rafeeq.companion.ui.AppViewModel
import com.rafeeq.companion.ui.components.GlassCard
import com.rafeeq.companion.ui.components.PrimaryButton
import com.rafeeq.companion.ui.components.RafeeqTextField
import com.rafeeq.companion.ui.components.SecondaryButton
import com.rafeeq.companion.ui.theme.Gradients

/** ترحيب أول تشغيل: الاسم، الموقع، الأذونات، ثم شرح موجز. */
@Composable
fun OnboardingScreen(viewModel: AppViewModel, onDone: () -> Unit) {
    val settings by viewModel.settings.collectAsState()
    var step by remember { mutableStateOf(0) }
    var name by remember { mutableStateOf("") }
    var showPlacePicker by remember { mutableStateOf(false) }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { granted ->
        if (granted.values.any { it }) viewModel.detectLocation()
        step = 2
    }

    val notificationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { step = 3 }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(Gradients.Dusk)),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Spacer(Modifier.height(28.dp))

            Box(
                Modifier
                    .size(92.dp)
                    .clip(CircleShape)
                    .background(Color.White.copy(alpha = 0.16f)),
                contentAlignment = Alignment.Center,
            ) {
                Text("🌙", style = MaterialTheme.typography.displayMedium)
            }

            Spacer(Modifier.height(18.dp))
            Text(
                "Alcode Ai",
                style = MaterialTheme.typography.displaySmall,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            Text(
                "كل ما يهمّك في يومك، في مكان واحد",
                style = MaterialTheme.typography.bodyLarge,
                color = Color.White.copy(alpha = 0.9f),
                textAlign = TextAlign.Center,
            )

            Spacer(Modifier.height(28.dp))

            AnimatedContent(
                targetState = step,
                transitionSpec = { fadeIn() togetherWith fadeOut() },
                label = "onboarding",
            ) { current ->
                when (current) {
                    0 -> StepCard(
                        title = "مرحبًا 👋",
                        body = "Alcode Ai يجمع لك أخبارك المختارة، الطقس، أوقات الصلاة والقبلة، " +
                            "مهامك وعاداتك، ومساعدًا ذكيًا يعرف سياق يومك.\n\n" +
                            "لا حسابات، ولا تتبّع — كل شيء يبقى على جهازك.",
                    ) {
                        RafeeqTextField(name, { name = it }, "ما اسمك؟ (اختياري)")
                        Spacer(Modifier.height(14.dp))
                        PrimaryButton("لنبدأ") {
                            if (name.isNotBlank()) viewModel.setUserName(name.trim())
                            step = 1
                        }
                    }

                    1 -> StepCard(
                        title = "أين أنت؟",
                        body = "نحتاج موقعك لحساب أوقات الصلاة واتجاه القبلة بدقّة، ولجلب طقس مدينتك. " +
                            "يمكنك السماح بالوصول للموقع، أو اختيار مدينتك يدويًا.",
                    ) {
                        PrimaryButton("اسمح بالوصول للموقع") {
                            locationLauncher.launch(
                                arrayOf(
                                    Manifest.permission.ACCESS_COARSE_LOCATION,
                                    Manifest.permission.ACCESS_FINE_LOCATION,
                                ),
                            )
                        }
                        Spacer(Modifier.height(8.dp))
                        SecondaryButton("أختار مدينتي يدويًا") { showPlacePicker = true }
                    }

                    2 -> StepCard(
                        title = "تنبيهات الصلاة",
                        body = "لنذكّرك بمواعيد الصلاة وموجزك الصباحي، نحتاج إذن الإشعارات. " +
                            "يمكنك تعطيل أي تنبيه لاحقًا من الإعدادات.",
                    ) {
                        PrimaryButton("فعّل الإشعارات") {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            } else step = 3
                        }
                        Spacer(Modifier.height(8.dp))
                        SecondaryButton("لاحقًا") { step = 3 }
                    }

                    else -> StepCard(
                        title = "كل شيء جاهز ✨",
                        body = buildString {
                            append("موقعك: ${settings.place?.label ?: "غير محدّد — يمكنك ضبطه لاحقًا"}\n\n")
                            append("خطوة أخيرة اختيارية: أضِف مفتاح Anthropic من الإعدادات ")
                            append("لتفعيل المساعد الذكي، الموجز اليومي، وتلخيص الأخبار.\n\n")
                            append("بقية التطبيق يعمل كاملًا بدون أي مفتاح.")
                        },
                    ) {
                        PrimaryButton("ادخل إلى Alcode Ai") {
                            viewModel.setOnboarded(true)
                            viewModel.rescheduleAlarms()
                            onDone()
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                repeat(4) { index ->
                    Box(
                        Modifier
                            .size(if (index == step) 22.dp else 7.dp, 7.dp)
                            .clip(CircleShape)
                            .background(
                                if (index == step) Color.White
                                else Color.White.copy(alpha = 0.35f),
                            )
                            .clickable { step = index },
                    )
                }
            }
            Spacer(Modifier.height(28.dp))
        }
    }

    if (showPlacePicker) {
        PlacePickerDialog(
            viewModel = viewModel,
            onDismiss = { showPlacePicker = false },
            onSelect = {
                viewModel.selectPlace(it)
                showPlacePicker = false
                step = 2
            },
        )
    }
}

@Composable
private fun StepCard(
    title: String,
    body: String,
    content: @Composable () -> Unit,
) {
    GlassCard(
        modifier = Modifier.fillMaxWidth(),
        padding = androidx.compose.foundation.layout.PaddingValues(22.dp),
    ) {
        Text(
            title,
            style = MaterialTheme.typography.titleLarge,
            fontWeight = FontWeight.Bold,
            color = Color.White,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            body,
            style = MaterialTheme.typography.bodyMedium,
            color = Color.White.copy(alpha = 0.9f),
        )
        Spacer(Modifier.height(18.dp))
        content()
    }
}

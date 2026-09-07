package com.rafeeq.companion

import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerConfig
import com.rafeeq.companion.data.prayer.PrayerTimes
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.abs

/**
 * اختبار مقارنة شامل: يقارن مخرجات محرّك الحساب لدينا بجدول مرجعي
 * مأخوذ من خدمة AlAdhan (تطبيق مرجعي واسع الانتشار للخوارزميات القياسية)
 * لست مدن على خطوط عرض متباينة وفي الشتاء والصيف.
 *
 * الجدول ثابت داخل الاختبار عمدًا، فلا يحتاج الاختبار إلى شبكة ولا يتعطّل
 * إن تغيّرت الخدمة. الهدف كشف أي انحراف في الحساب عند تعديل الكود لاحقًا.
 */
class PrayerReferenceTest {

    private data class Reference(
        val city: String,
        val latitude: Double,
        val longitude: Double,
        val zone: String,
        val method: CalculationMethod,
        val date: LocalDate,
        val fajr: String,
        val sunrise: String,
        val dhuhr: String,
        val asr: String,
        val maghrib: String,
        val isha: String,
        /**
         * سماحية الفارق بالدقائق. الافتراضي دقيقتان.
         * تُوسَّع فقط للطرق التي تضيف تعديلات خاصة بها فوق الحساب الفلكي القياسي.
         */
        val toleranceMinutes: Int = 2,
    )

    private val references = listOf(
        Reference(
            "الرياض", 24.7136, 46.6753, "Asia/Riyadh", CalculationMethod.UMM_AL_QURA,
            LocalDate.of(2026, 1, 15), "05:17", "06:40", "12:03", "15:05", "17:26", "18:56",
        ),
        Reference(
            "الرياض", 24.7136, 46.6753, "Asia/Riyadh", CalculationMethod.UMM_AL_QURA,
            LocalDate.of(2026, 6, 15), "03:32", "05:04", "11:54", "15:15", "18:44", "20:14",
        ),
        Reference(
            "القاهرة", 30.0444, 31.2357, "Africa/Cairo", CalculationMethod.EGYPT,
            LocalDate.of(2026, 1, 15), "05:21", "06:52", "12:04", "14:57", "17:17", "18:39",
        ),
        Reference(
            "القاهرة", 30.0444, 31.2357, "Africa/Cairo", CalculationMethod.EGYPT,
            LocalDate.of(2026, 6, 15), "04:08", "05:53", "12:56", "16:31", "19:58", "21:31",
        ),
        // رئاسة الشؤون الدينية التركية تنشر جداول تتضمّن تعديلات خاصة بها
        // فوق الحساب الفلكي القياسي (تصل إلى ٨ دقائق)، وهي غير موثّقة رسميًا،
        // لذا لا نحاكيها بل نوسّع السماحية هنا ونترك الضبط الدقيق للمستخدم
        // عبر «تعديل الأوقات» في الإعدادات.
        Reference(
            "إسطنبول", 41.0082, 28.9784, "Europe/Istanbul", CalculationMethod.TURKEY,
            LocalDate.of(2026, 1, 15), "06:50", "08:20", "13:18", "15:44", "18:07", "19:32",
            toleranceMinutes = 10,
        ),
        Reference(
            "جاكرتا", -6.2088, 106.8456, "Asia/Jakarta", CalculationMethod.MWL,
            LocalDate.of(2026, 1, 15), "04:34", "05:49", "12:02", "15:26", "18:15", "19:26",
        ),
        Reference(
            "جاكرتا", -6.2088, 106.8456, "Asia/Jakarta", CalculationMethod.MWL,
            LocalDate.of(2026, 6, 15), "04:45", "06:00", "11:53", "15:15", "17:46", "18:57",
        ),
        Reference(
            "كراتشي", 24.8607, 67.0011, "Asia/Karachi", CalculationMethod.KARACHI,
            LocalDate.of(2026, 1, 15), "05:58", "07:19", "12:41", "15:43", "18:04", "19:24",
        ),
        Reference(
            "كراتشي", 24.8607, 67.0011, "Asia/Karachi", CalculationMethod.KARACHI,
            LocalDate.of(2026, 6, 15), "04:13", "05:42", "12:32", "15:54", "19:23", "20:52",
        ),
        Reference(
            "لندن", 51.5074, -0.1278, "Europe/London", CalculationMethod.MWL,
            LocalDate.of(2026, 1, 15), "05:59", "08:00", "12:10", "13:59", "16:21", "18:15",
        ),
    )

    private fun minutesOf(time: LocalTime) = time.hour * 60 + time.minute

    @Test
    fun `engine matches reference implementation`() {
        val problems = mutableListOf<String>()

        for (ref in references) {
            val day = PrayerTimes.calculate(
                date = ref.date,
                latitude = ref.latitude,
                longitude = ref.longitude,
                zone = ZoneId.of(ref.zone),
                config = PrayerConfig(method = ref.method),
            )
            val expectations = listOf(
                Prayer.FAJR to ref.fajr,
                Prayer.SUNRISE to ref.sunrise,
                Prayer.DHUHR to ref.dhuhr,
                Prayer.ASR to ref.asr,
                Prayer.MAGHRIB to ref.maghrib,
                Prayer.ISHA to ref.isha,
            )
            for ((prayer, expected) in expectations) {
                val actual = day[prayer].toLocalTime()
                val diff = abs(minutesOf(LocalTime.parse(expected)) - minutesOf(actual))
                if (diff > ref.toleranceMinutes) {
                    problems += "${ref.city} ${ref.date} ${prayer.arabic}: " +
                        "المرجع $expected — المحسوب $actual (فارق $diff دقيقة)"
                }
            }
        }

        assertTrue(
            "انحراف عن الجدول المرجعي:\n" + problems.joinToString("\n"),
            problems.isEmpty(),
        )
    }

    @Test
    fun `london in june stays ordered despite persistent twilight`() {
        // في يونيو لا يكتمل الظلام في لندن، فتتدخّل قاعدة خطوط العرض العالية.
        // لا نقارن بالأرقام هنا لأن كل تطبيق يختار قاعدة مختلفة، بل نتحقّق من السلامة.
        val day = PrayerTimes.calculate(
            LocalDate.of(2026, 6, 15), 51.5074, -0.1278,
            ZoneId.of("Europe/London"), PrayerConfig(method = CalculationMethod.MWL),
        )
        val ordered = Prayer.entries.map { day[it] }
        for (i in 0 until ordered.size - 1) {
            assertTrue(
                "الترتيب مختل: ${Prayer.entries[i].arabic} ${ordered[i]} ثم " +
                    "${Prayer.entries[i + 1].arabic} ${ordered[i + 1]}",
                !ordered[i].isAfter(ordered[i + 1]),
            )
        }
        // الشروق والغروب يبقيان دقيقين حتى في هذه الحالة.
        assertTrue(minutesOf(day[Prayer.SUNRISE].toLocalTime()) in (4 * 60 + 38)..(4 * 60 + 48))
        assertTrue(minutesOf(day[Prayer.MAGHRIB].toLocalTime()) in (21 * 60 + 14)..(21 * 60 + 24))
    }
}

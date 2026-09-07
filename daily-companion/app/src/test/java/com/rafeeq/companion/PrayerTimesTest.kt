package com.rafeeq.companion

import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerConfig
import com.rafeeq.companion.data.prayer.PrayerTimes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.math.abs
import org.junit.Test

/**
 * يتحقّق من صحّة الحساب الفلكي لأوقات الصلاة بمقارنته بأوقات منشورة معروفة،
 * ومن سلامة السلوك في الحالات الحدّية (القطب الشمالي، خط الاستواء).
 */
class PrayerTimesTest {

    private val makkah = Triple(21.3891, 39.8579, ZoneId.of("Asia/Riyadh"))
    private val riyadh = Triple(24.7136, 46.6753, ZoneId.of("Asia/Riyadh"))
    private val cairo = Triple(30.0444, 31.2357, ZoneId.of("Africa/Cairo"))

    private fun minutesOf(time: LocalTime) = time.hour * 60 + time.minute

    private fun assertNear(expected: String, actual: LocalTime, toleranceMinutes: Int, label: String) {
        val expectedTime = LocalTime.parse(expected)
        val diff = abs(minutesOf(expectedTime) - minutesOf(actual))
        assertTrue(
            "$label: expected ~$expected but was $actual (off by $diff min)",
            diff <= toleranceMinutes,
        )
    }

    @Test
    fun `Umm al-Qura times for Makkah match published values`() {
        // قيم مرجعية موثّقة من ثلاثة مصادر مستقلة تتفق فيما بينها لمكة في ١ يناير ٢٠٢٦:
        // AlAdhan (طريقة أم القرى)، sunrise-sunset.org، و Open-Meteo.
        // الشروق ٠٦:٥٨ · الزوال ١٢:٢٤ · الغروب ١٧:٤٩–١٧:٥٠.
        val day = PrayerTimes.calculate(
            date = LocalDate.of(2026, 1, 1),
            latitude = makkah.first,
            longitude = makkah.second,
            zone = makkah.third,
            config = PrayerConfig(method = CalculationMethod.UMM_AL_QURA),
        )
        assertNear("05:37", day[Prayer.FAJR].toLocalTime(), 3, "الفجر")
        assertNear("06:58", day[Prayer.SUNRISE].toLocalTime(), 3, "الشروق")
        assertNear("12:24", day[Prayer.DHUHR].toLocalTime(), 3, "الظهر")
        assertNear("15:29", day[Prayer.ASR].toLocalTime(), 3, "العصر")
        assertNear("17:50", day[Prayer.MAGHRIB].toLocalTime(), 3, "المغرب")
        assertNear("19:20", day[Prayer.ISHA].toLocalTime(), 3, "العشاء")
        // أم القرى: العشاء = المغرب + ٩٠ دقيقة بالضبط.
        assertEquals(
            90,
            Duration.between(day[Prayer.MAGHRIB], day[Prayer.ISHA]).toMinutes(),
        )
    }

    @Test
    fun `Cairo times follow the summer time shift`() {
        // مصر تطبّق التوقيت الصيفي (+٣) في يونيو، فتزيد أوقات الساعة الجدارية ساعة كاملة.
        val summer = PrayerTimes.calculate(
            LocalDate.of(2026, 6, 15), cairo.first, cairo.second, cairo.third,
            PrayerConfig(method = CalculationMethod.EGYPT),
        )
        assertNear("05:53", summer[Prayer.SUNRISE].toLocalTime(), 6, "الشروق")
        assertNear("12:58", summer[Prayer.DHUHR].toLocalTime(), 6, "الظهر")
        assertNear("20:00", summer[Prayer.MAGHRIB].toLocalTime(), 8, "المغرب")

        // الشروق والغروب متناظران حول الظهر بدقة عالية.
        val toNoon = Duration.between(summer[Prayer.SUNRISE], summer[Prayer.DHUHR]).toMinutes()
        val fromNoon = Duration.between(summer[Prayer.DHUHR], summer[Prayer.MAGHRIB]).toMinutes()
        assertTrue("عدم تناظر الشروق والغروب حول الظهر: $toNoon مقابل $fromNoon",
            abs(toNoon - fromNoon) <= 2)
    }

    @Test
    fun `daylight saving transition shifts times by exactly one hour`() {
        val london = Triple(51.5074, -0.1278, ZoneId.of("Europe/London"))
        // آخر يوم بالتوقيت الشتوي وأول يوم بالتوقيت الصيفي في ٢٠٢٦.
        val before = PrayerTimes.calculate(
            LocalDate.of(2026, 3, 28), london.first, london.second, london.third,
            PrayerConfig(method = CalculationMethod.MWL),
        )[Prayer.DHUHR].toLocalTime()
        val after = PrayerTimes.calculate(
            LocalDate.of(2026, 3, 30), london.first, london.second, london.third,
            PrayerConfig(method = CalculationMethod.MWL),
        )[Prayer.DHUHR].toLocalTime()
        val shift = minutesOf(after) - minutesOf(before)
        assertTrue("الفارق المتوقع ~٦٠ دقيقة لكنه $shift", shift in 58..62)
    }

    @Test
    fun `prayers are strictly ordered through the day`() {
        val dates = listOf(
            LocalDate.of(2026, 1, 15),
            LocalDate.of(2026, 3, 21),
            LocalDate.of(2026, 6, 21),
            LocalDate.of(2026, 9, 23),
            LocalDate.of(2026, 12, 21),
        )
        for (date in dates) {
            val day = PrayerTimes.calculate(
                date, riyadh.first, riyadh.second, riyadh.third,
                PrayerConfig(method = CalculationMethod.UMM_AL_QURA),
            )
            val ordered = Prayer.entries.map { day[it] }
            for (i in 0 until ordered.size - 1) {
                assertTrue(
                    "$date: ${Prayer.entries[i]} (${ordered[i]}) must precede " +
                        "${Prayer.entries[i + 1]} (${ordered[i + 1]})",
                    ordered[i].isBefore(ordered[i + 1]),
                )
            }
        }
    }

    @Test
    fun `hanafi asr is later than standard asr`() {
        val date = LocalDate.of(2026, 5, 10)
        val standard = PrayerTimes.calculate(
            date, riyadh.first, riyadh.second, riyadh.third,
            PrayerConfig(asrMethod = AsrMethod.STANDARD),
        )[Prayer.ASR]
        val hanafi = PrayerTimes.calculate(
            date, riyadh.first, riyadh.second, riyadh.third,
            PrayerConfig(asrMethod = AsrMethod.HANAFI),
        )[Prayer.ASR]
        assertTrue("العصر الحنفي يجب أن يتأخر عن الجمهور", hanafi.isAfter(standard))
    }

    @Test
    fun `manual offsets shift the computed time exactly`() {
        val date = LocalDate.of(2026, 4, 4)
        val base = PrayerTimes.calculate(
            date, riyadh.first, riyadh.second, riyadh.third, PrayerConfig(),
        )[Prayer.FAJR]
        val shifted = PrayerTimes.calculate(
            date, riyadh.first, riyadh.second, riyadh.third,
            PrayerConfig(offsets = mapOf(Prayer.FAJR.key to -7)),
        )[Prayer.FAJR]
        assertEquals(-7L, Duration.between(base, shifted).toMinutes())
    }

    @Test
    fun `extreme latitude still produces ordered finite times`() {
        // ترومسو في الصيف: الشمس لا تغرب، فيجب أن تتدخّل قاعدة خطوط العرض العالية.
        val day = PrayerTimes.calculate(
            date = LocalDate.of(2026, 6, 21),
            latitude = 69.6492,
            longitude = 18.9553,
            zone = ZoneId.of("Europe/Oslo"),
            config = PrayerConfig(),
        )
        val ordered = Prayer.entries.map { day[it] }
        ordered.forEach { assertTrue("لا يجوز أن يكون الوقت غير صالح", it.year in 2020..2030) }
        for (i in 0 until ordered.size - 1) {
            assertTrue(
                "الترتيب مختل عند خط عرض عالٍ: ${ordered[i]} ثم ${ordered[i + 1]}",
                !ordered[i].isAfter(ordered[i + 1]),
            )
        }
    }

    @Test
    fun `qibla bearing points toward Makkah from known cities`() {
        // من الرياض تكون القبلة غربًا مائلة قليلًا نحو الجنوب (~٢٤٥°).
        assertEquals(245.0, PrayerTimes.qiblaBearing(24.7136, 46.6753), 3.0)
        // من القاهرة تكون شرقًا مائلة نحو الجنوب (~١٣٦°).
        assertEquals(136.0, PrayerTimes.qiblaBearing(30.0444, 31.2357), 3.0)
        // من جاكرتا تكون غربًا مائلة نحو الشمال (~٢٩٥°).
        assertEquals(295.0, PrayerTimes.qiblaBearing(-6.2088, 106.8456), 3.0)
    }

    @Test
    fun `distance to kaaba is sane`() {
        assertEquals(0.0, PrayerTimes.distanceToKaaba(21.4225, 39.8262), 5.0)
        // الرياض إلى مكة بخط مستقيم ~٧٩٠ كم (مسافة الطريق أطول).
        assertEquals(790.0, PrayerTimes.distanceToKaaba(24.7136, 46.6753), 20.0)
    }

    @Test
    fun `ramadan isha adds the extra thirty minutes for umm al qura`() {
        // ١ رمضان ١٤٤٧ يوافق ١٩ فبراير ٢٠٢٦ تقريبًا.
        val ramadanDay = (0..40).map { LocalDate.of(2026, 2, 10).plusDays(it.toLong()) }
            .first { Dates.isRamadan(it) }
        val day = PrayerTimes.calculate(
            ramadanDay, makkah.first, makkah.second, makkah.third,
            PrayerConfig(method = CalculationMethod.UMM_AL_QURA),
        )
        assertEquals(
            120,
            Duration.between(day[Prayer.MAGHRIB], day[Prayer.ISHA]).toMinutes(),
        )
    }

    @Test
    fun `next prayer advances through the day`() {
        val date = LocalDate.of(2026, 3, 10)
        val day = PrayerTimes.calculate(
            date, riyadh.first, riyadh.second, riyadh.third, PrayerConfig(),
        )
        val beforeFajr = date.atTime(3, 0)
        assertEquals(Prayer.FAJR, day.next(beforeFajr)?.first)

        val afterDhuhr = day[Prayer.DHUHR].plusMinutes(1)
        assertEquals(Prayer.ASR, day.next(afterDhuhr)?.first)

        val afterIsha = day[Prayer.ISHA].plusMinutes(1)
        assertEquals(null, day.next(afterIsha))
    }
}

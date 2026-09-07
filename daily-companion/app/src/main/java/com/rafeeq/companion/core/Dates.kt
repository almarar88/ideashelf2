package com.rafeeq.companion.core

import java.time.Duration
import java.time.chrono.HijrahChronology
import java.time.temporal.ChronoField
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

/** أدوات التاريخ والوقت — ميلادي وهجري وصيغ عربية. */
object Dates {

    private val arabicLocale: Locale = Locale.forLanguageTag("ar")

    val weekdaysAr = listOf(
        "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت", "الأحد",
    )

    val gregorianMonthsAr = listOf(
        "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
        "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
    )

    val hijriMonthsAr = listOf(
        "محرّم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة",
        "رجب", "شعبان", "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
    )

    fun weekdayAr(date: LocalDate): String = weekdaysAr[date.dayOfWeek.value - 1]

    /** "الأحد ٧ سبتمبر ٢٠٢٦" */
    fun longGregorianAr(date: LocalDate): String =
        "${weekdayAr(date)} ${date.dayOfMonth} ${gregorianMonthsAr[date.monthValue - 1]} ${date.year}"

    /** "٢٥ ربيع الأول ١٤٤٨ هـ" — بتقويم أم القرى. */
    fun longHijriAr(date: LocalDate, dayOffset: Int = 0): String {
        val h = toHijri(date, dayOffset)
        return "${h.day} ${hijriMonthsAr[h.month]} ${h.year} هـ"
    }

    data class Hijri(val year: Int, val month: Int, val day: Int)

    /**
     * التقويم الهجري بحساب أم القرى.
     * نستخدم [HijrahChronology] المدمج في المنصّة (متاح من أندرويد ٨) لأنه
     * يعتمد تقويم أم القرى الرسمي، ولا يحتاج أي مكتبة خارجية.
     */
    fun toHijri(date: LocalDate, dayOffset: Int = 0): Hijri {
        val adjusted = date.plusDays(dayOffset.toLong())
        return runCatching {
            val hijri = HijrahChronology.INSTANCE.date(adjusted)
            Hijri(
                year = hijri.get(ChronoField.YEAR),
                month = hijri.get(ChronoField.MONTH_OF_YEAR) - 1,
                day = hijri.get(ChronoField.DAY_OF_MONTH),
            )
        }.getOrElse {
            // خارج المدى الذي يغطيه تقويم أم القرى نعود لتقريب حسابي بسيط.
            val approxYear = ((adjusted.year - 622) * 33 / 32) + 1
            Hijri(approxYear, adjusted.monthValue - 1, adjusted.dayOfMonth)
        }
    }

    /** يُرجع true في رمضان — يُستخدم لتعديل حساب العشاء عند أم القرى. */
    fun isRamadan(date: LocalDate, dayOffset: Int = 0): Boolean = toHijri(date, dayOffset).month == 8

    private val time12 = DateTimeFormatter.ofPattern("h:mm", Locale.ENGLISH)
    private val time24 = DateTimeFormatter.ofPattern("HH:mm", Locale.ENGLISH)

    fun formatTime(time: LocalTime, use24h: Boolean): String =
        if (use24h) time.format(time24)
        else "${time.format(time12)} ${if (time.hour < 12) "ص" else "م"}"

    fun formatTime(dateTime: LocalDateTime, use24h: Boolean): String =
        formatTime(dateTime.toLocalTime(), use24h)

    /** "بعد ساعتين و١٥ دقيقة" */
    fun humanDuration(duration: Duration): String {
        val total = duration.seconds.coerceAtLeast(0)
        val hours = total / 3600
        val minutes = (total % 3600) / 60
        return when {
            hours <= 0L && minutes <= 0L -> "الآن"
            hours <= 0L -> "$minutes ${pluralMinutes(minutes)}"
            minutes == 0L -> "$hours ${pluralHours(hours)}"
            else -> "$hours ${pluralHours(hours)} و$minutes ${pluralMinutes(minutes)}"
        }
    }

    /** عدّاد رقمي دقيق: 01:23:45 */
    fun clockDuration(duration: Duration): String {
        val total = duration.seconds.coerceAtLeast(0)
        return String.format(
            Locale.ENGLISH, "%02d:%02d:%02d",
            total / 3600, (total % 3600) / 60, total % 60,
        )
    }

    private fun pluralHours(n: Long) = when (n) {
        1L -> "ساعة"; 2L -> "ساعتين"; in 3..10 -> "ساعات"; else -> "ساعة"
    }

    private fun pluralMinutes(n: Long) = when (n) {
        1L -> "دقيقة"; 2L -> "دقيقتين"; in 3..10 -> "دقائق"; else -> "دقيقة"
    }

    /** "قبل ٣ ساعات" — للأخبار. */
    fun relativePast(instantMillis: Long, nowMillis: Long = System.currentTimeMillis()): String {
        val diff = ((nowMillis - instantMillis) / 1000).coerceAtLeast(0)
        return when {
            diff < 60 -> "الآن"
            diff < 3600 -> "قبل ${diff / 60} ${pluralMinutes(diff / 60)}"
            diff < 86_400 -> "قبل ${diff / 3600} ${pluralHours(diff / 3600)}"
            diff < 2_592_000 -> {
                val d = diff / 86_400
                "قبل $d ${if (d == 1L) "يوم" else if (d == 2L) "يومين" else if (d <= 10) "أيام" else "يومًا"}"
            }
            else -> {
                val date = java.time.Instant.ofEpochMilli(instantMillis)
                    .atZone(ZoneId.systemDefault()).toLocalDate()
                "${date.dayOfMonth} ${gregorianMonthsAr[date.monthValue - 1]}"
            }
        }
    }

    /** تحية حسب الساعة. */
    fun greeting(hour: Int): String = when (hour) {
        in 0..4 -> "ليلة هادئة"
        in 5..11 -> "صباح الخير"
        in 12..16 -> "طاب يومك"
        in 17..20 -> "مساء الخير"
        else -> "مساء الخير"
    }

    fun now(zone: ZoneId = ZoneId.systemDefault()): ZonedDateTime = ZonedDateTime.now(zone)
}

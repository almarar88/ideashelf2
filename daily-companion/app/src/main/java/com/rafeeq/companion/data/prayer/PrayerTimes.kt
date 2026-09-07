package com.rafeeq.companion.data.prayer

import com.rafeeq.companion.core.Dates
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.asin
import kotlin.math.atan
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/** الصلوات الخمس + الشروق. */
enum class Prayer(val arabic: String, val key: String) {
    FAJR("الفجر", "fajr"),
    SUNRISE("الشروق", "sunrise"),
    DHUHR("الظهر", "dhuhr"),
    ASR("العصر", "asr"),
    MAGHRIB("المغرب", "maghrib"),
    ISHA("العشاء", "isha");

    val isObligatory: Boolean get() = this != SUNRISE
}

/** مذهب حساب العصر. */
enum class AsrMethod(val arabic: String, val shadowFactor: Int) {
    STANDARD("الجمهور (شافعي/مالكي/حنبلي)", 1),
    HANAFI("الحنفي", 2),
}

/** طريقة حساب أوقات الصلاة. */
enum class CalculationMethod(
    val arabic: String,
    val fajrAngle: Double,
    val ishaAngle: Double,
    /** إن كان أكبر من صفر فالعشاء = المغرب + هذه الدقائق (يتجاهل الزاوية). */
    val ishaMinutes: Int = 0,
    val maghribAngle: Double = 0.0,
    /**
     * دقيقة احتياطية تُضاف إلى الزوال الفلكي للتأكّد من زوال الشمس عن كبد السماء.
     * هذا ما تعتمده المراجع القياسية لكل الطرق. وإن كان مسجدك يعتمد فارقًا آخر
     * فاضبطه يدويًا من إعدادات «تعديل الأوقات».
     */
    val dhuhrOffsetMinutes: Int = 1,
) {
    UMM_AL_QURA("أم القرى — مكة المكرمة", 18.5, 0.0, ishaMinutes = 90),
    MWL("رابطة العالم الإسلامي", 18.0, 17.0),
    EGYPT("الهيئة المصرية العامة للمساحة", 19.5, 17.5),
    KARACHI("جامعة العلوم الإسلامية — كراتشي", 18.0, 18.0),
    ISNA("الجمعية الإسلامية لأمريكا الشمالية", 15.0, 15.0),
    DUBAI("دائرة الشؤون الإسلامية — دبي", 18.2, 18.2),
    QATAR("قطر", 18.0, 0.0, ishaMinutes = 90),
    KUWAIT("الكويت", 18.0, 17.5),
    SINGAPORE("سنغافورة", 20.0, 18.0),
    // ملاحظة: الجداول الرسمية التركية تضيف تعديلات خاصة غير موثّقة فوق الحساب
    // الفلكي، وقد تختلف عن هذه الزوايا بنحو ٨ دقائق. استخدم «تعديل الأوقات» للمطابقة.
    TURKEY("رئاسة الشؤون الدينية — تركيا", 18.0, 17.0),
    TEHRAN("جامعة طهران", 17.7, 14.0, maghribAngle = 4.5),
    JAFARI("الجعفري", 16.0, 14.0, maghribAngle = 4.0),
    FRANCE("الاتحاد الإسلامي — فرنسا", 12.0, 12.0),
    RUSSIA("الإدارة الروحية — روسيا", 16.0, 15.0),
}

/** طريقة معالجة خطوط العرض العالية التي لا تظهر فيها العلامة. */
enum class HighLatitudeRule(val arabic: String) {
    MIDDLE_OF_NIGHT("منتصف الليل"),
    SEVENTH_OF_NIGHT("سُبع الليل"),
    ANGLE_BASED("حسب الزاوية"),
}

data class PrayerConfig(
    val method: CalculationMethod = CalculationMethod.UMM_AL_QURA,
    val asrMethod: AsrMethod = AsrMethod.STANDARD,
    val highLatitudeRule: HighLatitudeRule = HighLatitudeRule.ANGLE_BASED,
    val elevationMeters: Double = 0.0,
    /** تعديل يدوي بالدقائق لكل صلاة. */
    val offsets: Map<String, Int> = emptyMap(),
)

data class DayPrayers(
    val date: LocalDate,
    val zone: ZoneId,
    val times: Map<Prayer, LocalDateTime>,
) {
    operator fun get(prayer: Prayer): LocalDateTime = times.getValue(prayer)

    val ordered: List<Pair<Prayer, LocalDateTime>>
        get() = Prayer.entries.map { it to times.getValue(it) }

    /** الصلاة القادمة بعد [from]، أو null إذا انتهى اليوم. */
    fun next(from: LocalDateTime): Pair<Prayer, LocalDateTime>? =
        ordered.filter { it.first.isObligatory }.firstOrNull { it.second.isAfter(from) }

    /** الصلاة الحالية (آخر صلاة دخل وقتها). */
    fun current(from: LocalDateTime): Pair<Prayer, LocalDateTime>? =
        ordered.filter { it.first.isObligatory }.lastOrNull { !it.second.isAfter(from) }
}

/**
 * حساب أوقات الصلاة فلكيًا (بدون إنترنت) اعتمادًا على معادلات الموقع الشمسي
 * المعتمدة في المراجع الفلكية القياسية (Meeus / PrayTimes).
 */
object PrayerTimes {

    private const val KAABA_LAT = 21.4224779
    private const val KAABA_LNG = 39.8251832

    fun calculate(
        date: LocalDate,
        latitude: Double,
        longitude: Double,
        zone: ZoneId,
        config: PrayerConfig,
        hijriOffset: Int = 0,
    ): DayPrayers {
        val zoneOffsetHours =
            zone.rules.getOffset(date.atTime(12, 0)).totalSeconds / 3600.0

        val jd = julianDate(date) - longitude / (15.0 * 24.0)
        val sun = sunPosition(jd)

        // الزوال الفلكي بالتوقيت المحلي (ساعات عشرية).
        val solarNoon = 12.0 + zoneOffsetHours - longitude / 15.0 - sun.equationOfTime
        val dhuhr = solarNoon + config.method.dhuhrOffsetMinutes / 60.0

        val sunriseAngle = 0.833 + 0.0347 * sqrt(config.elevationMeters.coerceAtLeast(0.0))

        fun hourAngle(angle: Double): Double? {
            val cosH = (-sin(rad(angle)) - sin(rad(sun.declination)) * sin(rad(latitude))) /
                (cos(rad(sun.declination)) * cos(rad(latitude)))
            if (cosH.isNaN() || cosH > 1.0 || cosH < -1.0) return null
            return deg(acos(cosH)) / 15.0
        }

        fun asrHourAngle(factor: Int): Double? {
            val angle = -deg(atan(1.0 / (factor + tan(rad(abs(latitude - sun.declination))))))
            return hourAngle(angle)
        }

        val sunriseSpan = hourAngle(sunriseAngle)
        val sunrise = sunriseSpan?.let { solarNoon - it }
        val sunset = sunriseSpan?.let { solarNoon + it }

        val maghrib = if (config.method.maghribAngle > 0.0) {
            hourAngle(config.method.maghribAngle)?.let { solarNoon + it }
        } else sunset

        var fajr = hourAngle(config.method.fajrAngle)?.let { solarNoon - it }
        var isha = if (config.method.ishaMinutes > 0) {
            val ramadanBonus = if (Dates.isRamadan(date, hijriOffset)) 30 else 0
            maghrib?.plus((config.method.ishaMinutes + ramadanBonus) / 60.0)
        } else {
            hourAngle(config.method.ishaAngle)?.let { solarNoon + it }
        }

        val asr = asrHourAngle(config.asrMethod.shadowFactor)?.let { solarNoon + it }

        // معالجة خطوط العرض العالية عندما تتعذّر العلامة الفلكية.
        if (sunrise != null && sunset != null) {
            val night = 24.0 - (sunset - sunrise)

            // القاعدة تقارن طول الفترة بين العلامة والشروق/الغروب — لا المسافة من الظهر.
            val fajrLimit = nightPortion(config, config.method.fajrAngle, night)
            if (fajr == null || sunrise - fajr > fajrLimit) {
                fajr = sunrise - fajrLimit
            }

            // العشاء المحسوب بالدقائق (أم القرى وقطر) لا يخضع لهذا التعديل.
            if (config.method.ishaMinutes <= 0) {
                val ishaLimit = nightPortion(
                    config,
                    config.method.ishaAngle.takeIf { it > 0 } ?: 18.0,
                    night,
                )
                if (isha == null || isha - sunset > ishaLimit) {
                    isha = sunset + ishaLimit
                }
            }
        }

        val raw = mapOf(
            Prayer.FAJR to (fajr ?: (solarNoon - 6.0)),
            Prayer.SUNRISE to (sunrise ?: (solarNoon - 5.5)),
            Prayer.DHUHR to dhuhr,
            Prayer.ASR to (asr ?: (solarNoon + 3.5)),
            Prayer.MAGHRIB to (maghrib ?: (solarNoon + 5.5)),
            Prayer.ISHA to (isha ?: (solarNoon + 7.0)),
        )

        val times = raw.mapValues { (prayer, hours) ->
            val offsetMinutes = config.offsets[prayer.key] ?: 0
            hoursToDateTime(date, hours) .plusMinutes(offsetMinutes.toLong())
        }
        return DayPrayers(date, zone, times)
    }

    private fun nightPortion(config: PrayerConfig, angle: Double, night: Double): Double =
        when (config.highLatitudeRule) {
            HighLatitudeRule.MIDDLE_OF_NIGHT -> night / 2.0
            HighLatitudeRule.SEVENTH_OF_NIGHT -> night / 7.0
            HighLatitudeRule.ANGLE_BASED -> night * (angle / 60.0)
        }

    private fun hoursToDateTime(date: LocalDate, hours: Double): LocalDateTime {
        // نضبط الساعات ضمن اليوم مع نقل الفائض إلى اليوم التالي/السابق.
        var h = hours
        var dayShift = 0L
        while (h < 0) { h += 24.0; dayShift -= 1 }
        while (h >= 24.0) { h -= 24.0; dayShift += 1 }
        val totalSeconds = (h * 3600.0).toLong().coerceIn(0, 86_399)
        return LocalDateTime.of(
            date.plusDays(dayShift),
            LocalTime.ofSecondOfDay(totalSeconds),
        ).withSecond(0).withNano(0)
    }

    private data class Sun(val declination: Double, val equationOfTime: Double)

    /** موضع الشمس التقريبي — دقة كافية لأوقات الصلاة (±دقيقة). */
    private fun sunPosition(jd: Double): Sun {
        val d = jd - 2451545.0
        val g = fixAngle(357.529 + 0.98560028 * d)
        val q = fixAngle(280.459 + 0.98564736 * d)
        val l = fixAngle(q + 1.915 * sin(rad(g)) + 0.020 * sin(rad(2 * g)))
        val e = 23.439 - 0.00000036 * d
        val ra = fixHour(deg(atan2(cos(rad(e)) * sin(rad(l)), cos(rad(l)))) / 15.0)
        val declination = deg(asin(sin(rad(e)) * sin(rad(l))))
        val equationOfTime = q / 15.0 - ra
        return Sun(declination, equationOfTime)
    }

    private fun julianDate(date: LocalDate): Double {
        var year = date.year
        var month = date.monthValue
        val day = date.dayOfMonth
        if (month <= 2) { year -= 1; month += 12 }
        val a = floor(year / 100.0)
        val b = 2 - a + floor(a / 4.0)
        return floor(365.25 * (year + 4716)) +
            floor(30.6001 * (month + 1)) + day + b - 1524.5
    }

    /** اتجاه القبلة بالدرجات من الشمال الجغرافي. */
    fun qiblaBearing(latitude: Double, longitude: Double): Double {
        val dLng = rad(KAABA_LNG - longitude)
        val lat = rad(latitude)
        val y = sin(dLng)
        val x = cos(lat) * tan(rad(KAABA_LAT)) - sin(lat) * cos(dLng)
        return fixAngle(deg(atan2(y, x)))
    }

    /** المسافة بالكيلومترات إلى الكعبة. */
    fun distanceToKaaba(latitude: Double, longitude: Double): Double {
        val r = 6371.0
        val dLat = rad(KAABA_LAT - latitude)
        val dLng = rad(KAABA_LNG - longitude)
        val a = sin(dLat / 2) * sin(dLat / 2) +
            cos(rad(latitude)) * cos(rad(KAABA_LAT)) * sin(dLng / 2) * sin(dLng / 2)
        return r * 2 * atan2(sqrt(a), sqrt(1 - a))
    }

    /**
     * منتصف الليل الشرعي (بين المغرب وفجر اليوم التالي) — مفيد لقيام الليل.
     * يُرجع أيضًا بداية الثلث الأخير.
     */
    fun nightThirds(
        today: DayPrayers,
        tomorrowFajr: LocalDateTime,
    ): Pair<LocalDateTime, LocalDateTime> {
        val maghrib = today[Prayer.MAGHRIB]
        val nightSeconds = java.time.Duration.between(maghrib, tomorrowFajr).seconds
        val midnight = maghrib.plusSeconds(nightSeconds / 2)
        val lastThird = maghrib.plusSeconds(nightSeconds * 2 / 3)
        return midnight to lastThird
    }

    private fun rad(d: Double) = d * Math.PI / 180.0
    private fun deg(r: Double) = r * 180.0 / Math.PI
    private fun fixAngle(a: Double) = ((a % 360.0) + 360.0) % 360.0
    private fun fixHour(h: Double) = ((h % 24.0) + 24.0) % 24.0

    fun zonedNow(zone: ZoneId): ZonedDateTime = ZonedDateTime.now(zone)
}

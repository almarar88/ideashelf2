package com.rafeeq.companion.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.rafeeq.companion.core.Net
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.HighLatitudeRule
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerConfig
import com.rafeeq.companion.ui.theme.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.builtins.MapSerializer
import kotlinx.serialization.builtins.serializer

private val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "rafeeq_settings")

/** كل تفضيلات المستخدم في مكان واحد. */
data class AppSettings(
    val onboarded: Boolean = false,
    val userName: String = "",
    val themeMode: ThemeMode = ThemeMode.SYSTEM,
    val dynamicColor: Boolean = false,
    val use24hClock: Boolean = false,

    val place: Place? = null,
    val autoLocate: Boolean = true,

    val calculationMethod: CalculationMethod = CalculationMethod.UMM_AL_QURA,
    val asrMethod: AsrMethod = AsrMethod.STANDARD,
    val highLatitudeRule: HighLatitudeRule = HighLatitudeRule.ANGLE_BASED,
    val hijriOffset: Int = 0,
    val prayerOffsets: Map<String, Int> = emptyMap(),
    val prayerNotifications: Set<String> = Prayer.entries.filter { it.isObligatory }.map { it.key }.toSet(),
    val preAdhanMinutes: Int = 10,
    val adhanSound: Boolean = true,

    val apiKey: String = "",
    val aiModel: String = "claude-opus-5",
    val aiEffort: String = "medium",
    val aiPersona: String = "",
    val briefNotification: Boolean = true,
    val briefHour: Int = 7,

    val newsRefreshMinutes: Int = 30,

    val controlEnabled: Boolean = true,
    /** إيقافه هو الافتراضي بطلب المستخدم: الأمر يُنفَّذ فور صدوره بلا حوار. */
    val confirmSensitive: Boolean = false,
    val responseSpeed: ClaudeClient.ResponseSpeed = ClaudeClient.ResponseSpeed.FAST,
    val voiceReplies: Boolean = true,
    val voiceLanguage: String = "ar-SA",
) {
    val prayerConfig: PrayerConfig
        get() = PrayerConfig(
            method = calculationMethod,
            asrMethod = asrMethod,
            highLatitudeRule = highLatitudeRule,
            elevationMeters = place?.elevation ?: 0.0,
            offsets = prayerOffsets,
        )

    val hasApiKey: Boolean get() = apiKey.isNotBlank()

    /** النموذج وعمق التفكير المستخدمان فعليًا — يشتقّان من مستوى السرعة. */
    val effectiveModel: String get() = responseSpeed.model
    val effectiveEffort: String get() = responseSpeed.effort
}

class SettingsRepository(private val context: Context) {

    private object Keys {
        val onboarded = booleanPreferencesKey("onboarded")
        val userName = stringPreferencesKey("user_name")
        val themeMode = stringPreferencesKey("theme_mode")
        val dynamicColor = booleanPreferencesKey("dynamic_color")
        val use24h = booleanPreferencesKey("use_24h")

        val placeName = stringPreferencesKey("place_name")
        val placeCountry = stringPreferencesKey("place_country")
        val placeAdmin = stringPreferencesKey("place_admin")
        val placeLat = doublePreferencesKey("place_lat")
        val placeLng = doublePreferencesKey("place_lng")
        val placeTz = stringPreferencesKey("place_tz")
        val placeElev = doublePreferencesKey("place_elev")
        val autoLocate = booleanPreferencesKey("auto_locate")

        val calcMethod = stringPreferencesKey("calc_method")
        val asrMethod = stringPreferencesKey("asr_method")
        val highLat = stringPreferencesKey("high_lat")
        val hijriOffset = intPreferencesKey("hijri_offset")
        val prayerOffsets = stringPreferencesKey("prayer_offsets")
        val prayerNotifications = stringPreferencesKey("prayer_notifications")
        val preAdhan = intPreferencesKey("pre_adhan")
        val adhanSound = booleanPreferencesKey("adhan_sound")

        val apiKey = stringPreferencesKey("api_key")
        val aiModel = stringPreferencesKey("ai_model")
        val aiEffort = stringPreferencesKey("ai_effort")
        val aiPersona = stringPreferencesKey("ai_persona")
        val briefNotification = booleanPreferencesKey("brief_notification")
        val briefHour = intPreferencesKey("brief_hour")

        val newsRefresh = intPreferencesKey("news_refresh")

        val controlEnabled = booleanPreferencesKey("control_enabled")
        val confirmSensitive = booleanPreferencesKey("confirm_sensitive")
        val responseSpeed = stringPreferencesKey("response_speed")
        val voiceReplies = booleanPreferencesKey("voice_replies")
        val voiceLanguage = stringPreferencesKey("voice_language")
    }

    val settings: Flow<AppSettings> = context.dataStore.data.map { p ->
        val lat = p[Keys.placeLat]
        val lng = p[Keys.placeLng]
        AppSettings(
            onboarded = p[Keys.onboarded] ?: false,
            userName = p[Keys.userName].orEmpty(),
            themeMode = p[Keys.themeMode]?.let { runCatching { ThemeMode.valueOf(it) }.getOrNull() } ?: ThemeMode.SYSTEM,
            dynamicColor = p[Keys.dynamicColor] ?: false,
            use24hClock = p[Keys.use24h] ?: false,
            place = if (lat != null && lng != null) Place(
                name = p[Keys.placeName].orEmpty().ifBlank { "موقعي" },
                country = p[Keys.placeCountry].orEmpty(),
                admin = p[Keys.placeAdmin].orEmpty(),
                latitude = lat,
                longitude = lng,
                timezone = p[Keys.placeTz].orEmpty(),
                elevation = p[Keys.placeElev] ?: 0.0,
            ) else null,
            autoLocate = p[Keys.autoLocate] ?: true,
            calculationMethod = p[Keys.calcMethod]?.let { runCatching { CalculationMethod.valueOf(it) }.getOrNull() }
                ?: CalculationMethod.UMM_AL_QURA,
            asrMethod = p[Keys.asrMethod]?.let { runCatching { AsrMethod.valueOf(it) }.getOrNull() } ?: AsrMethod.STANDARD,
            highLatitudeRule = p[Keys.highLat]?.let { runCatching { HighLatitudeRule.valueOf(it) }.getOrNull() }
                ?: HighLatitudeRule.ANGLE_BASED,
            hijriOffset = p[Keys.hijriOffset] ?: 0,
            prayerOffsets = p[Keys.prayerOffsets]?.let {
                runCatching {
                    Net.json.decodeFromString(MapSerializer(String.serializer(), Int.serializer()), it)
                }.getOrNull()
            } ?: emptyMap(),
            prayerNotifications = p[Keys.prayerNotifications]
                ?.split(",")?.filter { it.isNotBlank() }?.toSet()
                ?: Prayer.entries.filter { it.isObligatory }.map { it.key }.toSet(),
            preAdhanMinutes = p[Keys.preAdhan] ?: 10,
            adhanSound = p[Keys.adhanSound] ?: true,
            apiKey = p[Keys.apiKey].orEmpty(),
            aiModel = p[Keys.aiModel] ?: "claude-opus-5",
            aiEffort = p[Keys.aiEffort] ?: "medium",
            aiPersona = p[Keys.aiPersona].orEmpty(),
            briefNotification = p[Keys.briefNotification] ?: true,
            briefHour = p[Keys.briefHour] ?: 7,
            newsRefreshMinutes = p[Keys.newsRefresh] ?: 30,
            controlEnabled = p[Keys.controlEnabled] ?: true,
            confirmSensitive = p[Keys.confirmSensitive] ?: false,
            responseSpeed = ClaudeClient.ResponseSpeed.from(p[Keys.responseSpeed]),
            voiceReplies = p[Keys.voiceReplies] ?: true,
            voiceLanguage = p[Keys.voiceLanguage] ?: "ar-SA",
        )
    }

    suspend fun setOnboarded(value: Boolean) = edit { it[Keys.onboarded] = value }
    suspend fun setUserName(value: String) = edit { it[Keys.userName] = value }
    suspend fun setThemeMode(value: ThemeMode) = edit { it[Keys.themeMode] = value.name }
    suspend fun setDynamicColor(value: Boolean) = edit { it[Keys.dynamicColor] = value }
    suspend fun setUse24h(value: Boolean) = edit { it[Keys.use24h] = value }

    suspend fun setPlace(place: Place) = edit {
        it[Keys.placeName] = place.name
        it[Keys.placeCountry] = place.country
        it[Keys.placeAdmin] = place.admin
        it[Keys.placeLat] = place.latitude
        it[Keys.placeLng] = place.longitude
        it[Keys.placeTz] = place.timezone
        it[Keys.placeElev] = place.elevation
    }

    suspend fun setAutoLocate(value: Boolean) = edit { it[Keys.autoLocate] = value }
    suspend fun setCalculationMethod(value: CalculationMethod) = edit { it[Keys.calcMethod] = value.name }
    suspend fun setAsrMethod(value: AsrMethod) = edit { it[Keys.asrMethod] = value.name }
    suspend fun setHighLatitudeRule(value: HighLatitudeRule) = edit { it[Keys.highLat] = value.name }
    suspend fun setHijriOffset(value: Int) = edit { it[Keys.hijriOffset] = value.coerceIn(-3, 3) }

    suspend fun setPrayerOffset(prayer: Prayer, minutes: Int) = edit { prefs ->
        val current = prefs[Keys.prayerOffsets]?.let {
            runCatching {
                Net.json.decodeFromString(MapSerializer(String.serializer(), Int.serializer()), it)
            }.getOrNull()
        }.orEmpty().toMutableMap()
        current[prayer.key] = minutes.coerceIn(-30, 30)
        prefs[Keys.prayerOffsets] =
            Net.json.encodeToString(MapSerializer(String.serializer(), Int.serializer()), current)
    }

    suspend fun togglePrayerNotification(prayer: Prayer, enabled: Boolean) = edit { prefs ->
        val current = prefs[Keys.prayerNotifications]?.split(",")?.filter { it.isNotBlank() }?.toMutableSet()
            ?: Prayer.entries.filter { it.isObligatory }.map { it.key }.toMutableSet()
        if (enabled) current += prayer.key else current -= prayer.key
        prefs[Keys.prayerNotifications] = current.joinToString(",")
    }

    suspend fun setPreAdhanMinutes(value: Int) = edit { it[Keys.preAdhan] = value.coerceIn(0, 60) }
    suspend fun setAdhanSound(value: Boolean) = edit { it[Keys.adhanSound] = value }

    suspend fun setApiKey(value: String) = edit { it[Keys.apiKey] = value.trim() }
    suspend fun setAiModel(value: String) = edit { it[Keys.aiModel] = value }
    suspend fun setAiEffort(value: String) = edit { it[Keys.aiEffort] = value }
    suspend fun setAiPersona(value: String) = edit { it[Keys.aiPersona] = value }
    suspend fun setBriefNotification(value: Boolean) = edit { it[Keys.briefNotification] = value }
    suspend fun setBriefHour(value: Int) = edit { it[Keys.briefHour] = value.coerceIn(0, 23) }
    suspend fun setNewsRefreshMinutes(value: Int) = edit { it[Keys.newsRefresh] = value }
    suspend fun setControlEnabled(value: Boolean) = edit { it[Keys.controlEnabled] = value }
    suspend fun setConfirmSensitive(value: Boolean) = edit { it[Keys.confirmSensitive] = value }
    suspend fun setResponseSpeed(value: ClaudeClient.ResponseSpeed) =
        edit { it[Keys.responseSpeed] = value.name }
    suspend fun setVoiceReplies(value: Boolean) = edit { it[Keys.voiceReplies] = value }
    suspend fun setVoiceLanguage(value: String) = edit { it[Keys.voiceLanguage] = value }

    private suspend fun edit(block: (androidx.datastore.preferences.core.MutablePreferences) -> Unit) {
        context.dataStore.edit(block)
    }
}

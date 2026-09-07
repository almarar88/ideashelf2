package com.rafeeq.companion.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.rafeeq.companion.RafeeqApp
import com.rafeeq.companion.Repos
import com.rafeeq.companion.core.Dates
import com.rafeeq.companion.core.friendlyMessage
import com.rafeeq.companion.data.AppSettings
import com.rafeeq.companion.data.Article
import com.rafeeq.companion.data.ChatMessage
import com.rafeeq.companion.data.Conversation
import com.rafeeq.companion.data.DailyBrief
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.NewsSource
import com.rafeeq.companion.data.Note
import com.rafeeq.companion.data.Place
import com.rafeeq.companion.data.SavedArticle
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.Topic
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.news.NewsCategories
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.DayPrayers
import com.rafeeq.companion.data.prayer.HighLatitudeRule
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerTimes
import com.rafeeq.companion.notify.PrayerScheduler
import com.rafeeq.companion.ui.theme.ThemeMode
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZonedDateTime

data class NewsState(
    val articles: List<Article> = emptyList(),
    val loading: Boolean = false,
    val error: String? = null,
    val failedSources: List<String> = emptyList(),
    val lastUpdated: Long = 0L,
    val selectedCategory: String = NewsCategories.TOP,
)

data class WeatherState(
    val bundle: WeatherBundle? = null,
    val loading: Boolean = false,
    val error: String? = null,
)

data class AiState(
    val streaming: Boolean = false,
    val error: String? = null,
    val briefLoading: Boolean = false,
)

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val repos: Repos = (app as RafeeqApp).repos

    val settings: StateFlow<AppSettings> = repos.settings.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    val tasks: StateFlow<List<Task>> = repos.tasks.items
    val habits: StateFlow<List<Habit>> = repos.habits.items
    val notes: StateFlow<List<Note>> = repos.notes.items
    val savedArticles: StateFlow<List<SavedArticle>> = repos.saved.items
    val sources: StateFlow<List<NewsSource>> = repos.sources.items
    val topics: StateFlow<List<Topic>> = repos.topics.items
    val conversations: StateFlow<List<Conversation>> = repos.conversations.items
    val brief: StateFlow<DailyBrief?> = repos.brief.value

    private val _news = MutableStateFlow(NewsState())
    val news: StateFlow<NewsState> = _news.asStateFlow()

    private val _weather = MutableStateFlow(WeatherState())
    val weather: StateFlow<WeatherState> = _weather.asStateFlow()

    private val _ai = MutableStateFlow(AiState())
    val ai: StateFlow<AiState> = _ai.asStateFlow()

    /** يتحدّث كل ثانية لتحريك العدّادات والساعة. */
    private val _tick = MutableStateFlow(ZonedDateTime.now())
    val tick: StateFlow<ZonedDateTime> = _tick.asStateFlow()

    private val _activeConversationId = MutableStateFlow<String?>(null)
    val activeConversationId: StateFlow<String?> = _activeConversationId.asStateFlow()

    private val _locating = MutableStateFlow(false)
    val locating: StateFlow<Boolean> = _locating.asStateFlow()

    private val _snackbar = MutableStateFlow<String?>(null)
    val snackbar: StateFlow<String?> = _snackbar.asStateFlow()

    private var streamJob: Job? = null

    init {
        viewModelScope.launch {
            repos.tasks.load(); repos.habits.load(); repos.notes.load()
            repos.saved.load(); repos.sources.load(); repos.topics.load()
            repos.conversations.load(); repos.brief.load()
            repos.weatherCache.load()?.let { cached ->
                if (System.currentTimeMillis() - cached.fetchedAt < 3 * 60 * 60_000L) {
                    _weather.value = WeatherState(bundle = cached)
                }
            }
        }
        viewModelScope.launch {
            while (true) {
                _tick.value = ZonedDateTime.now(zoneId())
                delay(1000)
            }
        }
        viewModelScope.launch {
            // أول تشغيل: نجلب البيانات بمجرد توفّر الموقع.
            val s = settings.first { true }
            if (s.place != null) {
                refreshWeather()
                refreshNews()
            }
            rescheduleAlarms()
        }
    }

    // ------------------------------------------------------------ الوقت والموقع

    fun zoneId(): ZoneId {
        val tz = settings.value.place?.timezone
        return runCatching { if (tz.isNullOrBlank()) ZoneId.systemDefault() else ZoneId.of(tz) }
            .getOrElse { ZoneId.systemDefault() }
    }

    /** أوقات صلاة اليوم المطلوب. */
    fun prayersFor(date: LocalDate): DayPrayers? {
        val place = settings.value.place ?: return null
        return PrayerTimes.calculate(
            date = date,
            latitude = place.latitude,
            longitude = place.longitude,
            zone = zoneId(),
            config = settings.value.prayerConfig,
            hijriOffset = settings.value.hijriOffset,
        )
    }

    fun todayPrayers(): DayPrayers? = prayersFor(LocalDate.now(zoneId()))

    /** الصلاة القادمة — تنتقل إلى فجر الغد بعد العشاء. */
    fun nextPrayer(now: LocalDateTime = LocalDateTime.now(zoneId())): Pair<Prayer, LocalDateTime>? {
        val today = todayPrayers() ?: return null
        today.next(now)?.let { return it }
        val tomorrow = prayersFor(LocalDate.now(zoneId()).plusDays(1)) ?: return null
        return Prayer.FAJR to tomorrow[Prayer.FAJR]
    }

    fun detectLocation(onResult: (Boolean) -> Unit = {}) {
        viewModelScope.launch {
            _locating.value = true
            val place = runCatching { repos.location.currentPlace() }.getOrNull()
            _locating.value = false
            if (place != null) {
                selectPlace(place)
                onResult(true)
            } else {
                _snackbar.value = "تعذّر تحديد الموقع. تأكد من تفعيل خدمة الموقع أو اختر مدينتك يدويًا."
                onResult(false)
            }
        }
    }

    fun selectPlace(place: Place) {
        viewModelScope.launch {
            repos.settings.setPlace(place)
            refreshWeather(force = true)
            refreshNews(force = true)
            rescheduleAlarms()
        }
    }

    suspend fun searchPlaces(query: String): List<Place> = repos.location.search(query)

    // ------------------------------------------------------------ الطقس

    fun refreshWeather(force: Boolean = false) {
        val place = settings.value.place ?: return
        val current = _weather.value
        val fresh = current.bundle != null &&
            System.currentTimeMillis() - current.bundle.fetchedAt < 15 * 60_000L
        if (!force && fresh) return
        if (current.loading) return

        viewModelScope.launch {
            _weather.value = current.copy(loading = true, error = null)
            runCatching { repos.weather.fetch(place) }
                .onSuccess { bundle ->
                    _weather.value = WeatherState(bundle = bundle)
                    repos.weatherCache.set(bundle)
                }
                .onFailure { error ->
                    _weather.value = current.copy(loading = false, error = error.friendlyMessage())
                }
        }
    }

    // ------------------------------------------------------------ الأخبار

    fun refreshNews(force: Boolean = false) {
        val state = _news.value
        val interval = settings.value.newsRefreshMinutes.coerceAtLeast(5) * 60_000L
        if (!force && state.articles.isNotEmpty() &&
            System.currentTimeMillis() - state.lastUpdated < interval
        ) return
        if (state.loading) return

        viewModelScope.launch {
            _news.value = state.copy(loading = true, error = null)
            runCatching { repos.news.fetchAll(repos.sources.load(), repos.topics.load()) }
                .onSuccess { result ->
                    _news.value = _news.value.copy(
                        articles = result.articles,
                        loading = false,
                        error = if (result.articles.isEmpty()) "لم نتمكّن من جلب أي أخبار الآن." else null,
                        failedSources = result.failedSources,
                        lastUpdated = System.currentTimeMillis(),
                    )
                }
                .onFailure { error ->
                    _news.value = _news.value.copy(loading = false, error = error.friendlyMessage())
                }
        }
    }

    fun selectCategory(category: String) {
        _news.value = _news.value.copy(selectedCategory = category)
    }

    fun articlesFor(category: String): List<Article> {
        val all = _news.value.articles
        return if (category == NewsCategories.TOP) all else all.filter { it.category == category }
    }

    /** التصنيفات التي تحتوي فعلًا على أخبار الآن. */
    fun availableCategories(): List<String> {
        val present = _news.value.articles.map { it.category }.toSet()
        return NewsCategories.ordered.filter { it == NewsCategories.TOP || it in present }
    }

    fun toggleSaved(article: Article) {
        viewModelScope.launch {
            val exists = repos.saved.items.value.any { it.article.link == article.link }
            repos.saved.update { list ->
                if (exists) list.filterNot { it.article.link == article.link }
                else listOf(SavedArticle(article)) + list
            }
            _snackbar.value = if (exists) "أُزيل من المحفوظات" else "حُفظ للقراءة لاحقًا"
        }
    }

    fun isSaved(article: Article): Boolean =
        savedArticles.value.any { it.article.link == article.link }

    fun setSourceEnabled(source: NewsSource, enabled: Boolean) {
        viewModelScope.launch {
            repos.sources.update { list ->
                list.map { if (it.id == source.id) it.copy(enabled = enabled) else it }
            }
            refreshNews(force = true)
        }
    }

    fun addSource(name: String, url: String, category: String) {
        viewModelScope.launch {
            repos.sources.update { it + NewsSource(name = name, url = url, category = category, custom = true) }
            refreshNews(force = true)
        }
    }

    fun removeSource(source: NewsSource) {
        viewModelScope.launch {
            repos.sources.update { list -> list.filterNot { it.id == source.id } }
            refreshNews(force = true)
        }
    }

    suspend fun validateFeed(url: String): Result<Pair<String, Int>> = repos.news.validateFeed(url)

    fun addTopic(query: String) {
        if (query.isBlank()) return
        viewModelScope.launch {
            repos.topics.update { it + Topic(query = query.trim()) }
            refreshNews(force = true)
        }
    }

    fun removeTopic(topic: Topic) {
        viewModelScope.launch {
            repos.topics.update { list -> list.filterNot { it.id == topic.id } }
            refreshNews(force = true)
        }
    }

    // ------------------------------------------------------------ يومي

    fun addTask(task: Task) = viewModelScope.launch { repos.tasks.update { listOf(task) + it } }

    fun updateTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { list -> list.map { if (it.id == task.id) task else it } }
    }

    fun toggleTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { list ->
            list.map {
                if (it.id == task.id) it.copy(
                    done = !it.done,
                    completedAt = if (!it.done) System.currentTimeMillis() else null,
                ) else it
            }
        }
    }

    fun deleteTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { list -> list.filterNot { it.id == task.id } }
    }

    fun clearCompletedTasks() = viewModelScope.launch {
        repos.tasks.update { list -> list.filterNot { it.done } }
    }

    fun addHabit(habit: Habit) = viewModelScope.launch { repos.habits.update { it + habit } }

    fun incrementHabit(habit: Habit, date: LocalDate = LocalDate.now(zoneId())) =
        viewModelScope.launch {
            val key = date.toString()
            repos.habits.update { list ->
                list.map {
                    if (it.id == habit.id) {
                        val current = it.log[key] ?: 0
                        val next = if (current >= it.targetPerDay) 0 else current + 1
                        it.copy(log = it.log + (key to next))
                    } else it
                }
            }
        }

    fun deleteHabit(habit: Habit) = viewModelScope.launch {
        repos.habits.update { list -> list.filterNot { it.id == habit.id } }
    }

    fun saveNote(note: Note) = viewModelScope.launch {
        repos.notes.update { list ->
            if (list.any { it.id == note.id }) list.map { if (it.id == note.id) note else it }
            else listOf(note) + list
        }
    }

    fun deleteNote(note: Note) = viewModelScope.launch {
        repos.notes.update { list -> list.filterNot { it.id == note.id } }
    }

    // ------------------------------------------------------------ المساعد

    fun newConversation(): Conversation {
        val conversation = Conversation()
        viewModelScope.launch { repos.conversations.update { listOf(conversation) + it } }
        _activeConversationId.value = conversation.id
        return conversation
    }

    fun selectConversation(id: String?) { _activeConversationId.value = id }

    fun deleteConversation(id: String) = viewModelScope.launch {
        repos.conversations.update { list -> list.filterNot { it.id == id } }
        if (_activeConversationId.value == id) _activeConversationId.value = null
    }

    fun activeConversation(): Conversation? =
        conversations.value.firstOrNull { it.id == _activeConversationId.value }

    /** يبني السياق الكامل الذي يعرفه المساعد عن يومك. */
    private fun assistantContext(): Assistant.Context {
        val s = settings.value
        val now = LocalDateTime.now(zoneId())
        return Assistant.Context(
            userName = s.userName,
            now = now,
            placeLabel = s.place?.label.orEmpty(),
            hijriDate = Dates.longHijriAr(now.toLocalDate(), s.hijriOffset),
            gregorianDate = Dates.longGregorianAr(now.toLocalDate()),
            weather = _weather.value.bundle,
            prayers = todayPrayers(),
            tasks = tasks.value,
            habits = habits.value,
            headlines = _news.value.articles.take(10),
            persona = s.aiPersona,
            use24h = s.use24hClock,
        )
    }

    fun sendMessage(text: String) {
        val s = settings.value
        if (!s.hasApiKey) {
            _ai.value = _ai.value.copy(error = "أضِف مفتاح Anthropic من الإعدادات لتفعيل المساعد.")
            return
        }
        if (text.isBlank() || _ai.value.streaming) return

        val conversation = activeConversation() ?: newConversation()
        val userMessage = ChatMessage(role = "user", content = text.trim())
        val placeholder = ChatMessage(role = "assistant", content = "")

        streamJob?.cancel()
        streamJob = viewModelScope.launch {
            _ai.value = _ai.value.copy(streaming = true, error = null)
            appendMessages(conversation.id, listOf(userMessage, placeholder))

            val history = (activeConversation()?.messages.orEmpty())
                .filter { it.content.isNotBlank() && !it.error }
                .takeLast(30)
                .map { ClaudeClient.Msg(it.role, it.content) }

            val builder = StringBuilder()
            var failure: String? = null

            runCatching {
                repos.claude.stream(
                    model = s.aiModel,
                    system = Assistant.systemPrompt(assistantContext()),
                    messages = history,
                    effort = s.aiEffort,
                ).collect { event ->
                    when (event) {
                        is ClaudeClient.StreamEvent.Delta -> {
                            builder.append(event.text)
                            replaceLastAssistant(conversation.id, placeholder.id, builder.toString())
                        }
                        is ClaudeClient.StreamEvent.Refused -> failure = event.explanation
                        is ClaudeClient.StreamEvent.Failure -> failure = event.error.friendlyMessage()
                        is ClaudeClient.StreamEvent.Done -> Unit
                    }
                }
            }.onFailure { failure = it.friendlyMessage() }

            if (builder.isBlank()) {
                replaceLastAssistant(
                    conversation.id, placeholder.id,
                    failure ?: "لم يصل رد. حاول مرة أخرى.",
                    isError = true,
                )
            } else if (failure != null) {
                replaceLastAssistant(
                    conversation.id, placeholder.id,
                    builder.toString() + "\n\n⚠️ توقّف الرد: $failure",
                )
            }

            _ai.value = _ai.value.copy(streaming = false, error = failure)
            maybeTitleConversation(conversation.id)
        }
    }

    fun stopStreaming() {
        streamJob?.cancel()
        _ai.value = _ai.value.copy(streaming = false)
    }

    private suspend fun appendMessages(conversationId: String, messages: List<ChatMessage>) {
        repos.conversations.update { list ->
            list.map {
                if (it.id == conversationId) {
                    it.copy(messages = it.messages + messages, updatedAt = System.currentTimeMillis())
                } else it
            }
        }
    }

    private suspend fun replaceLastAssistant(
        conversationId: String,
        messageId: String,
        content: String,
        isError: Boolean = false,
    ) {
        repos.conversations.update { list ->
            list.map { conversation ->
                if (conversation.id != conversationId) conversation
                else conversation.copy(
                    messages = conversation.messages.map { message ->
                        if (message.id == messageId) message.copy(content = content, error = isError)
                        else message
                    },
                    updatedAt = System.currentTimeMillis(),
                )
            }
        }
    }

    private suspend fun maybeTitleConversation(conversationId: String) {
        val conversation = conversations.value.firstOrNull { it.id == conversationId } ?: return
        if (conversation.title != "محادثة جديدة") return
        val firstUser = conversation.messages.firstOrNull { it.role == "user" }?.content ?: return
        val title = firstUser.take(38).let { if (firstUser.length > 38) "$it…" else it }
        repos.conversations.update { list ->
            list.map { if (it.id == conversationId) it.copy(title = title) else it }
        }
    }

    /** يولّد موجز اليوم ويحفظه. */
    fun generateBrief(force: Boolean = false) {
        val s = settings.value
        if (!s.hasApiKey) return
        val today = LocalDate.now(zoneId()).toString()
        if (!force && brief.value?.date == today) return
        if (_ai.value.briefLoading) return

        viewModelScope.launch {
            _ai.value = _ai.value.copy(briefLoading = true)
            runCatching {
                repos.claude.complete(
                    model = s.aiModel,
                    system = Assistant.systemPrompt(assistantContext()),
                    messages = listOf(ClaudeClient.Msg("user", Assistant.dailyBriefPrompt())),
                    maxTokens = 1200,
                    effort = "low",
                )
            }.onSuccess { text ->
                if (text.isNotBlank()) repos.brief.set(DailyBrief(date = today, body = text))
            }.onFailure {
                _snackbar.value = "تعذّر إنشاء الموجز: ${it.friendlyMessage()}"
            }
            _ai.value = _ai.value.copy(briefLoading = false)
        }
    }

    /** يلخّص خبرًا ويخزّن الملخّص مع المقال المحفوظ. */
    fun summarizeArticle(article: Article, onResult: (Result<String>) -> Unit) {
        val s = settings.value
        if (!s.hasApiKey) {
            onResult(Result.failure(IllegalStateException("أضِف مفتاح Anthropic من الإعدادات أولًا.")))
            return
        }
        viewModelScope.launch {
            val result = runCatching {
                repos.claude.complete(
                    model = s.aiModel,
                    system = Assistant.systemPrompt(assistantContext()),
                    messages = listOf(ClaudeClient.Msg("user", Assistant.summarizeArticlePrompt(article))),
                    maxTokens = 900,
                    effort = "low",
                )
            }
            result.onSuccess { summary ->
                repos.saved.update { list ->
                    list.map {
                        if (it.article.link == article.link) it.copy(aiSummary = summary) else it
                    }
                }
            }
            onResult(result)
        }
    }

    /** يحوّل نصًا حرًّا إلى مهام. */
    fun extractTasks(text: String, onResult: (Result<Int>) -> Unit) {
        val s = settings.value
        if (!s.hasApiKey) {
            onResult(Result.failure(IllegalStateException("أضِف مفتاح Anthropic من الإعدادات أولًا.")))
            return
        }
        viewModelScope.launch {
            val result = runCatching {
                val output = repos.claude.complete(
                    model = s.aiModel,
                    system = "أنت محلّل نصوص دقيق. اتبع صيغة الإخراج المطلوبة حرفيًا دون أي إضافات.",
                    messages = listOf(
                        ClaudeClient.Msg(
                            "user",
                            Assistant.extractTasksPrompt(text, LocalDate.now(zoneId())),
                        ),
                    ),
                    maxTokens = 700,
                    effort = "low",
                )
                val parsed = Assistant.parseExtractedTasks(output)
                if (parsed.isEmpty()) error("لم أتمكّن من استخراج مهام واضحة من النص.")
                repos.tasks.update { parsed + it }
                parsed.size
            }
            onResult(result)
        }
    }

    suspend fun validateApiKey(): Result<Unit> =
        repos.claude.validateKey(settings.value.aiModel)

    // ------------------------------------------------------------ الإعدادات

    fun setOnboarded(value: Boolean) = viewModelScope.launch { repos.settings.setOnboarded(value) }
    fun setUserName(value: String) = viewModelScope.launch { repos.settings.setUserName(value) }
    fun setThemeMode(value: ThemeMode) = viewModelScope.launch { repos.settings.setThemeMode(value) }
    fun setDynamicColor(value: Boolean) = viewModelScope.launch { repos.settings.setDynamicColor(value) }
    fun setUse24h(value: Boolean) = viewModelScope.launch { repos.settings.setUse24h(value) }
    fun setAutoLocate(value: Boolean) = viewModelScope.launch { repos.settings.setAutoLocate(value) }

    fun setCalculationMethod(value: CalculationMethod) = viewModelScope.launch {
        repos.settings.setCalculationMethod(value); rescheduleAlarms()
    }

    fun setAsrMethod(value: AsrMethod) = viewModelScope.launch {
        repos.settings.setAsrMethod(value); rescheduleAlarms()
    }

    fun setHighLatitudeRule(value: HighLatitudeRule) = viewModelScope.launch {
        repos.settings.setHighLatitudeRule(value); rescheduleAlarms()
    }

    fun setHijriOffset(value: Int) = viewModelScope.launch { repos.settings.setHijriOffset(value) }

    fun setPrayerOffset(prayer: Prayer, minutes: Int) = viewModelScope.launch {
        repos.settings.setPrayerOffset(prayer, minutes); rescheduleAlarms()
    }

    fun togglePrayerNotification(prayer: Prayer, enabled: Boolean) = viewModelScope.launch {
        repos.settings.togglePrayerNotification(prayer, enabled); rescheduleAlarms()
    }

    fun setPreAdhanMinutes(value: Int) = viewModelScope.launch {
        repos.settings.setPreAdhanMinutes(value); rescheduleAlarms()
    }

    fun setApiKey(value: String) = viewModelScope.launch { repos.settings.setApiKey(value) }
    fun setAiModel(value: String) = viewModelScope.launch { repos.settings.setAiModel(value) }
    fun setAiEffort(value: String) = viewModelScope.launch { repos.settings.setAiEffort(value) }
    fun setAiPersona(value: String) = viewModelScope.launch { repos.settings.setAiPersona(value) }

    fun setBriefNotification(value: Boolean) = viewModelScope.launch {
        repos.settings.setBriefNotification(value); rescheduleAlarms()
    }

    fun setBriefHour(value: Int) = viewModelScope.launch {
        repos.settings.setBriefHour(value); rescheduleAlarms()
    }

    fun setNewsRefreshMinutes(value: Int) = viewModelScope.launch {
        repos.settings.setNewsRefreshMinutes(value)
    }

    fun rescheduleAlarms() {
        runCatching { PrayerScheduler.rescheduleAll(getApplication()) }
    }

    fun showMessage(message: String) { _snackbar.value = message }
    fun consumeSnackbar() { _snackbar.value = null }
}

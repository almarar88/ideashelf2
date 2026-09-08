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
import com.rafeeq.companion.data.Recurrence
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.Topic
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.ToolRun
import com.rafeeq.companion.data.ai.AgentRunner
import com.rafeeq.companion.data.ai.Assistant
import com.rafeeq.companion.data.ai.ImageInput
import com.rafeeq.companion.data.ai.ServerTools
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.ai.ControlPrompt
import com.rafeeq.companion.data.control.ActionResult
import com.rafeeq.companion.data.control.Capability
import com.rafeeq.companion.data.Shortcut
import com.rafeeq.companion.data.UsageStats
import com.rafeeq.companion.data.control.AppActions
import com.rafeeq.companion.data.control.PhoneController
import com.rafeeq.companion.data.control.ToolCatalog
import com.rafeeq.companion.data.control.ToolSpec
import com.rafeeq.companion.data.voice.VoiceEngine
import com.rafeeq.companion.data.news.NewsCategories
import com.rafeeq.companion.data.prayer.AsrMethod
import com.rafeeq.companion.data.prayer.CalculationMethod
import com.rafeeq.companion.data.prayer.DayPrayers
import com.rafeeq.companion.data.prayer.HighLatitudeRule
import com.rafeeq.companion.data.prayer.Prayer
import com.rafeeq.companion.data.prayer.PrayerTimes
import com.rafeeq.companion.notify.PrayerScheduler
import com.rafeeq.companion.notify.HabitScheduler
import com.rafeeq.companion.notify.TaskScheduler
import com.rafeeq.companion.ui.theme.ThemeMode
import kotlinx.coroutines.CompletableDeferred
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.add
import kotlinx.serialization.json.putJsonObject
import kotlinx.serialization.json.putJsonArray

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
    /** الأمر الجاري تنفيذه على الهاتف الآن، إن وُجد. */
    val runningTool: String? = null,
    /** عبارة البحث الجارية في الإنترنت الآن، إن وُجدت. */
    val searching: String? = null,
)

/** طلب تأكيد لأمر حسّاس قبل تنفيذه. */
data class PendingConfirmation(
    val toolName: String,
    val title: String,
    val details: String,
)

class AppViewModel(app: Application) : AndroidViewModel(app) {

    private val repos: Repos = (app as RafeeqApp).repos

    val settings: StateFlow<AppSettings> = repos.settings.settings
        .stateIn(viewModelScope, SharingStarted.Eagerly, AppSettings())

    private val _settingsLoaded = MutableStateFlow(false)

    /**
     * هل وصلت الإعدادات المحفوظة فعلًا من القرص؟
     *
     * القيمة الابتدائية لتدفّق الإعدادات هي كائن فارغ (بلا مفتاح ولا موقع)،
     * لأن Compose يحتاج قيمة فورية بينما القراءة من القرص غير متزامنة.
     * أي قرار يُتخذ قبل وصول القيمة الحقيقية سيقرأ «لا يوجد مفتاح» خطأً.
     */
    val settingsLoaded: StateFlow<Boolean> = _settingsLoaded.asStateFlow()

    /** ينتظر أول قراءة حقيقية ثم يعيدها — يُستخدم قبل أي قرار يعتمد على المفتاح. */
    suspend fun awaitSettings(): AppSettings = repos.settings.settings.first()

    val tasks: StateFlow<List<Task>> = repos.tasks.items
    val habits: StateFlow<List<Habit>> = repos.habits.items
    val notes: StateFlow<List<Note>> = repos.notes.items
    val savedArticles: StateFlow<List<SavedArticle>> = repos.saved.items
    val sources: StateFlow<List<NewsSource>> = repos.sources.items
    val topics: StateFlow<List<Topic>> = repos.topics.items
    val conversations: StateFlow<List<Conversation>> = repos.conversations.items
    val brief: StateFlow<DailyBrief?> = repos.brief.value
    val shortcuts: StateFlow<List<Shortcut>> = repos.shortcuts.items
    val usage: StateFlow<UsageStats?> = repos.usage.value

    /**
     * الأوامر التي تمسّ بيانات التطبيق (مهام، ملاحظات، عادات، أخبار).
     * فصلها عن أوامر النظام يجعل المساعد قادرًا على إدارة يومك لا على تشغيل
     * التطبيقات فحسب.
     */
    private val appActions = AppActions(
        tasks = repos.tasks,
        notes = repos.notes,
        habits = repos.habits,
        articleTitles = { _news.value.articles.map { Triple(it.title, it.link, it.sourceName) } },
        zone = { zoneId() },
        onTasksChanged = { rescheduleTaskReminders() },
    )

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

    val phone: PhoneController get() = repos.phone
    val voice: VoiceEngine get() = repos.voice

    private val _capabilities = MutableStateFlow<Set<Capability>>(emptySet())
    val capabilities: StateFlow<Set<Capability>> = _capabilities.asStateFlow()

    private val _pendingConfirmation = MutableStateFlow<PendingConfirmation?>(null)
    val pendingConfirmation: StateFlow<PendingConfirmation?> = _pendingConfirmation.asStateFlow()
    private var confirmationGate: CompletableDeferred<Boolean>? = null

    /** يُعاد فحص القدرات كلما عاد المستخدم من إعدادات النظام. */
    fun refreshCapabilities() {
        _capabilities.value = runCatching { repos.phone.availableCapabilities() }.getOrDefault(emptySet())
    }

    fun resolveConfirmation(approved: Boolean) {
        _pendingConfirmation.value = null
        confirmationGate?.complete(approved)
        confirmationGate = null
    }

    private fun missingCapabilityNames(): List<String> =
        Capability.entries
            .filter { it != Capability.NONE && it !in _capabilities.value }
            .map { it.arabic }

    init {
        viewModelScope.launch {
            awaitSettings()
            _settingsLoaded.value = true
        }
        viewModelScope.launch {
            repos.tasks.load(); repos.habits.load(); repos.notes.load()
            repos.saved.load(); repos.sources.load(); repos.topics.load()
            repos.conversations.load(); repos.brief.load()
            repos.shortcuts.load(); repos.usage.load()
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
            rescheduleTaskReminders()
            rescheduleHabitReminders()
        }
        refreshCapabilities()
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

    fun addTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { listOf(task) + it }
        rescheduleTaskReminders()
    }

    /** تنبيهات المهام تُعاد جدولتها بعد كل تغيير حتى لا يفوت موعد. */
    fun rescheduleTaskReminders() {
        runCatching { TaskScheduler.reschedule(getApplication(), tasks.value, zoneId()) }
    }

    /** تذكير العادات اليومية — يُعاد بناؤه بعد أي تغيير في القائمة. */
    fun rescheduleHabitReminders() {
        runCatching { HabitScheduler.reschedule(getApplication(), habits.value, zoneId()) }
    }

    fun updateTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { list -> list.map { if (it.id == task.id) task else it } }
        rescheduleTaskReminders()
    }

    fun toggleTask(task: Task) = viewModelScope.launch {
        // إنجاز مهمة متكرّرة يولّد نسختها التالية حتى لا تختفي من الروتين.
        val next = if (!task.done) Recurrence.next(task, zoneId()) else null
        repos.tasks.update { list ->
            val updated = list.map {
                if (it.id == task.id) it.copy(
                    done = !it.done,
                    completedAt = if (!it.done) System.currentTimeMillis() else null,
                ) else it
            }
            if (next != null) listOf(next) + updated else updated
        }
        rescheduleTaskReminders()
        if (next != null) showMessage("تكرار: النسخة التالية بتاريخ ${next.dueDate}")
    }

    fun deleteTask(task: Task) = viewModelScope.launch {
        repos.tasks.update { list -> list.filterNot { it.id == task.id } }
        rescheduleTaskReminders()
    }

    fun clearCompletedTasks() = viewModelScope.launch {
        repos.tasks.update { list -> list.filterNot { it.done } }
    }

    fun addHabit(habit: Habit) = viewModelScope.launch {
        repos.habits.update { it + habit }
        rescheduleHabitReminders()
    }

    fun updateHabit(habit: Habit) = viewModelScope.launch {
        repos.habits.update { list -> list.map { if (it.id == habit.id) habit else it } }
        rescheduleHabitReminders()
    }

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
        rescheduleHabitReminders()
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

    /**
     * أدوات هذا الطلب: أدوات الهاتف حسب الصلاحيات الممنوحة، مع أداة البحث
     * التي تعمل على خادم Anthropic لا على الجهاز.
     */
    private fun buildTools(useTools: Boolean, s: AppSettings): JsonArray {
        val phone = if (useTools) ToolCatalog.toJson(_capabilities.value) else JsonArray(emptyList())
        if (!s.webSearch) return phone
        return JsonArray(phone + ServerTools.webSearch(s.effectiveModel))
    }

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

    /**
     * يرسل رسالة إلى المساعد. حين يكون التحكّم مفعّلًا يعمل النموذج بحلقة أدوات:
     * يردّ، ينفّذ أوامر على الهاتف، يقرأ نتيجتها، ثم يكمل — حتى ينهي المهمة.
     *
     * [spoken] يعني أن الطلب جاء بالصوت، فيُقرأ الرد بصوت عالٍ ويُطلب من النموذج
     * أن يجعله قصيرًا صالحًا للنطق.
     */
    fun sendMessage(text: String, spoken: Boolean = false, image: android.net.Uri? = null) {
        if ((text.isBlank() && image == null) || _ai.value.streaming) return

        val conversation = activeConversation() ?: newConversation()
        val userMessage = ChatMessage(role = "user", content = text.trim())
        val placeholder = ChatMessage(role = "assistant", content = "")

        streamJob?.cancel()
        streamJob = viewModelScope.launch {
            // ننتظر الإعدادات المحفوظة قبل فحص المفتاح: القيمة الابتدائية فارغة،
            // وقراءتها مباشرةً عند الإقلاع تُظهر «لا يوجد مفتاح» رغم وجوده.
            val s = awaitSettings()
            if (!s.hasApiKey) {
                _ai.value = _ai.value.copy(
                    error = "أضِف مفتاح Anthropic من الإعدادات لتفعيل المساعد.",
                )
                return@launch
            }

            _ai.value = _ai.value.copy(streaming = true, error = null, runningTool = null)
            val withImage = if (image == null) userMessage else userMessage.copy(
                imagePath = ImageInput.store(getApplication(), image),
            )
            appendMessages(conversation.id, listOf(withImage, placeholder))
            refreshCapabilities()

            val useTools = s.controlEnabled
            // البادئة ثابتة ليعمل التخزين المؤقت؛ حالة اليوم المتغيّرة تُرفق بآخر رسالة.
            val system = Assistant.stableSystem(
                persona = s.aiPersona,
                control = if (useTools) ControlPrompt.instructions(spoken, missingCapabilityNames()) else "",
                dialect = s.dialect,
                webSearch = s.webSearch,
            )
            val history = buildApiHistory(conversation.id, Assistant.contextBlock(assistantContext()))

            val builder = StringBuilder()
            val runs = mutableListOf<ToolRun>()
            var failure: String? = null

            // النطق أثناء الكتابة: يبدأ الصوت بعد أول جملة بدل انتظار الرد كاملًا.
            val streamSpeech = spoken && s.voiceReplies && s.speakWhileTyping
            if (streamSpeech) repos.voice.beginStreamSpeech(s.voiceLanguage)

            runCatching {
                repos.agent.run(
                    model = s.effectiveModel,
                    system = system,
                    history = history,
                    tools = buildTools(useTools, s),
                    effort = s.effectiveEffort,
                    specOf = { name -> ToolCatalog.byName(name) },
                    confirm = { call, spec -> requestConfirmation(call, spec, s.confirmSensitive) },
                    execute = { call ->
                        if (appActions.handles(call.name)) appActions.execute(call.name, call.input)
                        else repos.phone.execute(call.name, call.input)
                    },
                ) { event ->
                    when (event) {
                        is AgentRunner.Event.Text -> {
                            builder.append(event.delta)
                            if (streamSpeech) repos.voice.pushStreamSpeech(event.delta)
                            updateAssistant(conversation.id, placeholder.id, builder.toString(), runs)
                        }

                        is AgentRunner.Event.ToolStarted -> {
                            _ai.value = _ai.value.copy(runningTool = event.call.name)
                        }

                        is AgentRunner.Event.ToolFinished -> {
                            runs += ToolRun(
                                name = event.call.name,
                                label = event.result.display,
                                ok = event.result.ok,
                            )
                            _ai.value = _ai.value.copy(runningTool = null)
                            updateAssistant(conversation.id, placeholder.id, builder.toString(), runs)
                        }

                        is AgentRunner.Event.ToolDenied -> {
                            runs += ToolRun(
                                name = event.call.name,
                                label = "أُلغي بطلبك",
                                ok = false,
                                denied = true,
                            )
                            _ai.value = _ai.value.copy(runningTool = null)
                            updateAssistant(conversation.id, placeholder.id, builder.toString(), runs)
                        }

                        is AgentRunner.Event.Searching -> {
                            _ai.value = _ai.value.copy(searching = event.query)
                            runs += ToolRun(
                                name = "web_search",
                                label = "🔎 بحث: ${event.query}",
                                ok = true,
                            )
                            updateAssistant(conversation.id, placeholder.id, builder.toString(), runs)
                        }

                        is AgentRunner.Event.Usage -> recordUsage(event)

                        is AgentRunner.Event.Failed -> failure = event.message
                        AgentRunner.Event.Completed -> Unit
                    }
                }
            }.onFailure { failure = it.friendlyMessage() }

            val finalText = builder.toString().trim()
            if (finalText.isBlank() && runs.isEmpty()) {
                updateAssistant(
                    conversation.id, placeholder.id,
                    failure ?: "لم يصل رد. حاول مرة أخرى.", runs, isError = true,
                )
            } else if (failure != null) {
                updateAssistant(
                    conversation.id, placeholder.id,
                    (finalText + "\n\n⚠️ " + failure).trim(), runs,
                )
            }

            _ai.value = _ai.value.copy(streaming = false, error = failure, runningTool = null, searching = null)
            maybeTitleConversation(conversation.id)

            if (spoken && s.voiceReplies && finalText.isNotBlank()) {
                if (streamSpeech) {
                    repos.voice.endStreamSpeech { onSpokenReplyDone?.invoke() }
                } else {
                    repos.voice.speak(finalText, s.voiceLanguage) { onSpokenReplyDone?.invoke() }
                }
            } else if (streamSpeech) {
                repos.voice.stopSpeaking()
            }
        }
    }

    /** يراكم تقدير الاستهلاك ليعرضه المستخدم — مفيد لأن المفتاح مفتاحه. */
    private suspend fun recordUsage(event: AgentRunner.Event.Usage) {
        val current = repos.usage.value.value ?: UsageStats()
        repos.usage.set(
            current.copy(
                inputTokens = current.inputTokens + event.input,
                outputTokens = current.outputTokens + event.output,
                cachedTokens = current.cachedTokens + event.cached,
                requests = current.requests + 1,
            ),
        )
    }

    fun resetUsage() = viewModelScope.launch { repos.usage.set(UsageStats()) }

    // ------------------------------------------------------------ الاختصارات

    fun addShortcut(label: String, emoji: String, prompt: String) = viewModelScope.launch {
        if (label.isBlank() || prompt.isBlank()) return@launch
        repos.shortcuts.update {
            it + Shortcut(label = label.trim(), emoji = emoji.ifBlank { "⚡" }, prompt = prompt.trim())
        }
    }

    fun deleteShortcut(id: String) = viewModelScope.launch {
        repos.shortcuts.update { list -> list.filterNot { it.id == id } }
    }

    // ------------------------------------------------------------ إعادة التوليد

    /**
     * يعيد آخر سؤال على المساعد بعد حذف رده.
     * مفيد حين يأتي الرد ناقصًا أو ينقطع الاتصال في منتصفه.
     */
    fun regenerateLast() {
        if (_ai.value.streaming) return
        val conversation = activeConversation() ?: return
        val index = conversation.messages.indexOfLast { it.role == "user" }
        if (index < 0) return
        val question = conversation.messages[index].content
        viewModelScope.launch {
            repos.conversations.update { list ->
                list.map { c ->
                    if (c.id != conversation.id) c
                    else c.copy(messages = c.messages.take(index))
                }
            }
            sendMessage(question)
        }
    }

    /** يقرأ نصًا بصوت عالٍ (أو يوقف القراءة الجارية). */
    fun speak(text: String) {
        if (voice.state.value == VoiceEngine.State.SPEAKING) voice.stopSpeaking()
        else voice.speak(text, settings.value.voiceLanguage)
    }

    /**
     * تُستدعى بعد أن ينتهي المساعد من نطق رده.
     * الشاشة الصوتية تستخدمها لتعاود الاستماع فورًا فتصير المحادثة متصلة.
     */
    var onSpokenReplyDone: (() -> Unit)? = null

    /** يعرض حوار التأكيد وينتظر قرار المستخدم. */
    private suspend fun requestConfirmation(
        call: AgentRunner.ToolCall,
        spec: ToolSpec,
        confirmEnabled: Boolean,
    ): Boolean {
        if (!confirmEnabled) return true
        val gate = CompletableDeferred<Boolean>()
        confirmationGate = gate
        _pendingConfirmation.value = PendingConfirmation(
            toolName = call.name,
            title = when (call.name) {
                "call" -> "إجراء مكالمة"
                "send_sms" -> "إرسال رسالة نصية"
                "send_whatsapp" -> "فتح واتساب برسالة"
                "compose_email" -> "كتابة بريد"
                "clear_notifications" -> "مسح الإشعارات"
                else -> "تنفيذ أمر"
            },
            details = call.input.entries.joinToString("\n") { (key, value) ->
                "$key: ${value.toString().trim('"')}"
            }.ifBlank { spec.description },
        )
        return gate.await()
    }

    /**
     * يبني سجلّ المحادثة بالصيغة التي تفهمها الواجهة البرمجية.
     * [contextBlock] يُرفق بآخر رسالة للمستخدم فقط — لا بتعليمات النظام —
     * حتى تبقى البادئة الثابتة صالحة للتخزين المؤقت.
     */
    private suspend fun buildApiHistory(
        conversationId: String,
        contextBlock: String = "",
    ): MutableList<JsonObject> {
        val messages = conversations.value.firstOrNull { it.id == conversationId }?.messages.orEmpty()
            .filter { (it.content.isNotBlank() || it.imagePath != null) && !it.error }
            .takeLast(16)

        val lastUserIndex = messages.indexOfLast { it.role == "user" }
        // الصور القديمة تُسقَط من السجلّ: إعادة إرسالها في كل دور يضاعف الكلفة
        // بلا فائدة، والمهم منها انتقل إلى النص أصلًا.
        val keepImageAt = messages.indexOfLast { it.imagePath != null }
            .takeIf { it >= 0 && it >= messages.size - 2 }

        return messages.mapIndexed { index, message ->
            val text = if (index == lastUserIndex && contextBlock.isNotBlank()) {
                contextBlock + "\n\n" + message.content
            } else {
                message.content
            }
            val image = if (index == keepImageAt) {
                message.imagePath?.let { ImageInput.encode(it) }
            } else null

            buildJsonObject {
                put("role", message.role)
                if (image == null) {
                    put("content", text)
                } else {
                    putJsonArray("content") {
                        add(
                            buildJsonObject {
                                put("type", "image")
                                putJsonObject("source") {
                                    put("type", "base64")
                                    put("media_type", "image/jpeg")
                                    put("data", image)
                                }
                            },
                        )
                        add(
                            buildJsonObject {
                                put("type", "text")
                                put("text", text.ifBlank { "شنو في هذي الصورة؟" })
                            },
                        )
                    }
                }
            }
        }.toMutableList()
    }

    private suspend fun updateAssistant(
        conversationId: String,
        messageId: String,
        content: String,
        runs: List<ToolRun>,
        isError: Boolean = false,
    ) {
        repos.conversations.update { list ->
            list.map { conversation ->
                if (conversation.id != conversationId) conversation
                else conversation.copy(
                    messages = conversation.messages.map { message ->
                        if (message.id == messageId) {
                            message.copy(content = content, error = isError, toolRuns = runs.toList())
                        } else message
                    },
                    updatedAt = System.currentTimeMillis(),
                )
            }
        }
    }

    fun stopStreaming() {
        streamJob?.cancel()
        resolveConfirmation(false)
        repos.voice.stopSpeaking()
        _ai.value = _ai.value.copy(streaming = false, runningTool = null, searching = null)
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
                    model = s.effectiveModel,
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
                    model = s.effectiveModel,
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
                    model = s.effectiveModel,
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
        repos.claude.validateKey(settings.value.effectiveModel)

    // ------------------------------------------------------------ الإعدادات

    fun setOnboarded(value: Boolean) = viewModelScope.launch { repos.settings.setOnboarded(value) }
    fun setUserName(value: String) = viewModelScope.launch { repos.settings.setUserName(value) }
    fun setDialect(value: com.rafeeq.companion.data.ai.Dialect) = viewModelScope.launch {
        repos.settings.setDialect(value)
        // الصوت يُهيّأ باللغة الجديدة فورًا، وإلا بقي على اللهجة السابقة حتى إعادة التشغيل.
        runCatching { repos.voice.prepareTts(value.bcp47) }
    }

    fun setWebSearch(value: Boolean) = viewModelScope.launch { repos.settings.setWebSearch(value) }
    fun setContinuousVoice(value: Boolean) = viewModelScope.launch {
        repos.settings.setContinuousVoice(value)
    }
    fun setSpeakWhileTyping(value: Boolean) = viewModelScope.launch {
        repos.settings.setSpeakWhileTyping(value)
    }
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

    fun setControlEnabled(value: Boolean) = viewModelScope.launch {
        repos.settings.setControlEnabled(value)
    }

    fun setConfirmSensitive(value: Boolean) = viewModelScope.launch {
        repos.settings.setConfirmSensitive(value)
    }

    fun setResponseSpeed(value: ClaudeClient.ResponseSpeed) = viewModelScope.launch {
        repos.settings.setResponseSpeed(value)
    }

    fun setVoiceReplies(value: Boolean) = viewModelScope.launch {
        repos.settings.setVoiceReplies(value)
    }

    fun setVoiceLanguage(value: String) = viewModelScope.launch {
        repos.settings.setVoiceLanguage(value)
    }

    fun setFontScale(value: Float) = viewModelScope.launch { repos.settings.setFontScale(value) }
    fun setHaptics(value: Boolean) = viewModelScope.launch { repos.settings.setHaptics(value) }

    fun setAdhanSound(uri: String) = viewModelScope.launch {
        repos.settings.setAdhanSoundUri(uri)
    }

    // ------------------------------------------------------------ النسخ الاحتياطي

    fun exportBackup(target: android.net.Uri) = viewModelScope.launch {
        repos.backup.export(target, awaitSettings())
            .onSuccess { showMessage("حُفظت نسخة احتياطية تضم $it عنصرًا") }
            .onFailure { showMessage("تعذّر الحفظ: ${it.message}") }
    }

    fun importBackup(source: android.net.Uri) = viewModelScope.launch {
        repos.backup.import(source, merge = true)
            .onSuccess {
                showMessage("استُعيد $it عنصرًا")
                rescheduleTaskReminders()
                rescheduleHabitReminders()
                rescheduleAlarms()
            }
            .onFailure { showMessage("تعذّر الاستعادة: ${it.message}") }
    }

    fun rescheduleAlarms() {
        runCatching { PrayerScheduler.rescheduleAll(getApplication()) }
    }

    fun showMessage(message: String) { _snackbar.value = message }
    fun consumeSnackbar() { _snackbar.value = null }
}

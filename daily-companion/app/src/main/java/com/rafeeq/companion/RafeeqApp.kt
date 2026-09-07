package com.rafeeq.companion

import android.app.Application
import com.rafeeq.companion.data.Conversation
import com.rafeeq.companion.data.DailyBrief
import com.rafeeq.companion.data.Habit
import com.rafeeq.companion.data.NewsSource
import com.rafeeq.companion.data.Note
import com.rafeeq.companion.data.SavedArticle
import com.rafeeq.companion.data.SettingsRepository
import com.rafeeq.companion.data.Task
import com.rafeeq.companion.data.Topic
import com.rafeeq.companion.data.JsonListStore
import com.rafeeq.companion.data.JsonValueStore
import com.rafeeq.companion.data.WeatherBundle
import com.rafeeq.companion.data.ai.ClaudeClient
import com.rafeeq.companion.data.location.LocationRepository
import com.rafeeq.companion.data.news.DefaultSources
import com.rafeeq.companion.data.news.NewsRepository
import com.rafeeq.companion.data.weather.WeatherRepository
import com.rafeeq.companion.notify.Channels
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

/** حاوية بسيطة للاعتماديات — تكفي لتطبيق بهذا الحجم بدل إطار حقن كامل. */
class Repos(app: Application) {
    val settings = SettingsRepository(app)
    val location = LocationRepository(app)
    val weather = WeatherRepository()
    val news = NewsRepository()
    val claude = ClaudeClient {
        runCatching { runBlocking { settings.settings.first().apiKey } }.getOrDefault("")
    }

    val tasks = JsonListStore(app, "tasks.json", Task.serializer())
    val habits = JsonListStore(app, "habits.json", Habit.serializer())
    val notes = JsonListStore(app, "notes.json", Note.serializer())
    val saved = JsonListStore(app, "saved_articles.json", SavedArticle.serializer())
    val sources = JsonListStore(app, "news_sources.json", NewsSource.serializer(), DefaultSources.all)
    val topics = JsonListStore(app, "topics.json", Topic.serializer())
    val conversations = JsonListStore(app, "conversations.json", Conversation.serializer())
    val brief = JsonValueStore(app, "daily_brief.json", DailyBrief.serializer())
    val weatherCache = JsonValueStore(app, "weather_cache.json", WeatherBundle.serializer())
}

class RafeeqApp : Application() {

    lateinit var repos: Repos
        private set

    override fun onCreate() {
        super.onCreate()
        repos = Repos(this)
        Channels.ensure(this)
    }
}

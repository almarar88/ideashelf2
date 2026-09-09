package com.rafeeq.companion.data

import android.content.Context
import android.net.Uri
import com.rafeeq.companion.Repos
import com.rafeeq.companion.core.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable

/**
 * نسخة احتياطية كاملة لبيانات المستخدم.
 *
 * التطبيق لا يملك خادمًا ولا حسابًا، فالبيانات كلها على الجهاز — ومعنى ذلك
 * أن فقدان الهاتف يعني فقدانها. هذا الملف هو مخرج المستخدم من ذلك.
 *
 * المفتاح **غير مشمول** عمدًا: ملف النسخة قد يُرسل أو يُخزَّن في مكان غير آمن،
 * ووضع مفتاح فوترة بداخله مخاطرة لا تستحق راحة النسخ.
 */
@Serializable
data class BackupBundle(
    val version: Int = 2,
    val createdAt: Long = System.currentTimeMillis(),
    val tasks: List<Task> = emptyList(),
    val habits: List<Habit> = emptyList(),
    val notes: List<Note> = emptyList(),
    val savedArticles: List<SavedArticle> = emptyList(),
    val sources: List<NewsSource> = emptyList(),
    val topics: List<Topic> = emptyList(),
    val conversations: List<Conversation> = emptyList(),
    val shortcuts: List<Shortcut> = emptyList(),
    val memories: List<Memory> = emptyList(),
    val routines: List<Routine> = emptyList(),
    val place: Place? = null,
    val userName: String = "",
    val persona: String = "",
)

class BackupManager(private val context: Context, private val repos: Repos) {

    /** يجمع كل شيء في ملف واحد. */
    suspend fun export(target: Uri, settings: AppSettings): Result<Int> =
        withContext(Dispatchers.IO) {
            runCatching {
                val bundle = BackupBundle(
                    tasks = repos.tasks.load(),
                    habits = repos.habits.load(),
                    notes = repos.notes.load(),
                    savedArticles = repos.saved.load(),
                    sources = repos.sources.load(),
                    topics = repos.topics.load(),
                    conversations = repos.conversations.load(),
                    shortcuts = repos.shortcuts.load(),
                    memories = repos.memories.load(),
                    routines = repos.routines.load(),
                    place = settings.place,
                    userName = settings.userName,
                    persona = settings.aiPersona,
                )
                val json = Net.json.encodeToString(BackupBundle.serializer(), bundle)
                context.contentResolver.openOutputStream(target, "wt")?.use { out ->
                    out.write(json.toByteArray(Charsets.UTF_8))
                } ?: error("تعذّر فتح الملف للكتابة.")

                bundle.tasks.size + bundle.notes.size + bundle.habits.size +
                    bundle.savedArticles.size + bundle.conversations.size
            }
        }

    /**
     * يستعيد نسخة سابقة. [merge] يضيف إلى الموجود بدل استبداله،
     * وهو الافتراضي الأأمن حتى لا تُمحى بيانات بضغطة خاطئة.
     */
    suspend fun import(source: Uri, merge: Boolean = true): Result<Int> =
        withContext(Dispatchers.IO) {
            runCatching {
                val text = context.contentResolver.openInputStream(source)?.use {
                    it.readBytes().toString(Charsets.UTF_8)
                } ?: error("تعذّر قراءة الملف.")

                val bundle = Net.json.decodeFromString(BackupBundle.serializer(), text)
                if (bundle.version > 2) {
                    error("هذا الملف من إصدار أحدث من التطبيق.")
                }

                // الدمج يتجاهل ما يحمل المعرّف نفسه حتى لا تتكرّر العناصر.
                suspend fun <T> merge(
                    store: JsonListStore<T>,
                    incoming: List<T>,
                    id: (T) -> String,
                ) {
                    if (incoming.isEmpty()) return
                    store.update { existing ->
                        if (!merge) incoming
                        else {
                            val have = existing.map(id).toSet()
                            existing + incoming.filterNot { id(it) in have }
                        }
                    }
                }

                merge(repos.tasks, bundle.tasks) { it.id }
                merge(repos.habits, bundle.habits) { it.id }
                merge(repos.notes, bundle.notes) { it.id }
                merge(repos.saved, bundle.savedArticles) { it.article.link }
                merge(repos.sources, bundle.sources) { it.id }
                merge(repos.topics, bundle.topics) { it.id }
                merge(repos.conversations, bundle.conversations) { it.id }
                merge(repos.shortcuts, bundle.shortcuts) { it.id }
                merge(repos.memories, bundle.memories) { it.id }
                merge(repos.routines, bundle.routines) { it.id }

                bundle.place?.let { repos.settings.setPlace(it) }
                if (bundle.userName.isNotBlank()) repos.settings.setUserName(bundle.userName)
                if (bundle.persona.isNotBlank()) repos.settings.setAiPersona(bundle.persona)

                bundle.tasks.size + bundle.notes.size + bundle.habits.size +
                    bundle.savedArticles.size + bundle.conversations.size
            }
        }

    companion object {
        fun suggestedFileName(): String {
            val date = java.time.LocalDate.now()
            return "alcode-ai-backup-$date.json"
        }
    }
}

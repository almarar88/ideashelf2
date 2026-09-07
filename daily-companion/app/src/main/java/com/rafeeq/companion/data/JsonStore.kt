package com.rafeeq.companion.data

import android.content.Context
import com.rafeeq.companion.core.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.KSerializer
import kotlinx.serialization.builtins.ListSerializer
import java.io.File

/**
 * مخزن بسيط ومتين للقوائم على شكل ملف JSON.
 * اخترناه بدل قاعدة بيانات كاملة لأن أحجام البيانات صغيرة،
 * والكتابة تتم بشكل ذرّي (ملف مؤقت ثم إعادة تسمية) لتفادي التلف.
 */
class JsonListStore<T>(
    context: Context,
    fileName: String,
    private val serializer: KSerializer<T>,
    private val defaults: List<T> = emptyList(),
) {
    private val file = File(context.filesDir, fileName)
    private val listSerializer = ListSerializer(serializer)
    private val mutex = Mutex()

    private val _items = MutableStateFlow<List<T>>(emptyList())
    val items: StateFlow<List<T>> = _items.asStateFlow()

    private var loaded = false

    suspend fun load(): List<T> = mutex.withLock {
        if (loaded) return _items.value
        val value = withContext(Dispatchers.IO) {
            runCatching {
                if (file.exists()) Net.json.decodeFromString(listSerializer, file.readText())
                else defaults
            }.getOrDefault(defaults)
        }
        loaded = true
        _items.value = value
        value
    }

    suspend fun update(block: (List<T>) -> List<T>) = mutex.withLock {
        if (!loaded) {
            val value = withContext(Dispatchers.IO) {
                runCatching {
                    if (file.exists()) Net.json.decodeFromString(listSerializer, file.readText())
                    else defaults
                }.getOrDefault(defaults)
            }
            loaded = true
            _items.value = value
        }
        val next = block(_items.value)
        _items.value = next
        withContext(Dispatchers.IO) {
            runCatching {
                val tmp = File(file.parentFile, "${file.name}.tmp")
                tmp.writeText(Net.json.encodeToString(listSerializer, next))
                if (file.exists()) file.delete()
                tmp.renameTo(file)
            }
        }
        Unit
    }

    suspend fun add(item: T) = update { listOf(item) + it }
    suspend fun replaceAll(items: List<T>) = update { items }
}

/** مخزن لقيمة مفردة (مثل الملخص اليومي أو آخر حالة طقس). */
class JsonValueStore<T>(
    context: Context,
    fileName: String,
    private val serializer: KSerializer<T>,
) {
    private val file = File(context.filesDir, fileName)
    private val mutex = Mutex()
    private val _value = MutableStateFlow<T?>(null)
    val value: StateFlow<T?> = _value.asStateFlow()
    private var loaded = false

    suspend fun load(): T? = mutex.withLock {
        if (loaded) return _value.value
        val v = withContext(Dispatchers.IO) {
            runCatching {
                if (file.exists()) Net.json.decodeFromString(serializer, file.readText()) else null
            }.getOrNull()
        }
        loaded = true
        _value.value = v
        v
    }

    suspend fun set(value: T?) = mutex.withLock {
        loaded = true
        _value.value = value
        withContext(Dispatchers.IO) {
            runCatching {
                if (value == null) file.delete()
                else {
                    val tmp = File(file.parentFile, "${file.name}.tmp")
                    tmp.writeText(Net.json.encodeToString(serializer, value))
                    if (file.exists()) file.delete()
                    tmp.renameTo(file)
                }
            }
        }
        Unit
    }
}

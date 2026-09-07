package com.rafeeq.companion.data

import java.time.LocalDate
import java.time.ZoneId
import java.util.UUID

/**
 * توليد النسخة التالية من المهمة المتكرّرة.
 *
 * المنطق مشترك بين الواجهة والمساعد: إنجاز مهمة يومية من الشاشة
 * يجب أن يفعل ما يفعله إنجازها بأمر صوتي، لا أقلّ.
 */
object Recurrence {

    val supported = listOf("daily", "weekly", "monthly")

    /** نسخة جديدة بموعد لاحق، أو null إن كانت المهمة غير متكرّرة. */
    fun next(task: Task, zone: ZoneId = ZoneId.systemDefault()): Task? {
        val repeat = task.repeat?.takeIf { it in supported } ?: return null
        val today = LocalDate.now(zone)
        val base = task.dueDate?.let { runCatching { LocalDate.parse(it) }.getOrNull() } ?: today

        // مهمة فات موعدها بأيام: نتقدّم حتى نتجاوز اليوم بدل توليد موعد ماضٍ.
        var next = advance(base, repeat)
        var guard = 0
        while (next.isBefore(today) && guard++ < 400) next = advance(next, repeat)

        return task.copy(
            id = UUID.randomUUID().toString(),
            dueDate = next.toString(),
            done = false,
            completedAt = null,
            createdAt = System.currentTimeMillis(),
        )
    }

    private fun advance(date: LocalDate, repeat: String): LocalDate = when (repeat) {
        "daily" -> date.plusDays(1)
        "weekly" -> date.plusWeeks(1)
        else -> date.plusMonths(1)
    }

    /** تسمية عربية للتكرار تُعرض في القوائم. */
    fun labelAr(repeat: String?): String = when (repeat) {
        "daily" -> "يومي"
        "weekly" -> "أسبوعي"
        "monthly" -> "شهري"
        else -> ""
    }
}

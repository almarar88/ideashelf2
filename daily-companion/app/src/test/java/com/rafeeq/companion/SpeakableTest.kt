package com.rafeeq.companion

import com.rafeeq.companion.data.voice.ElevenLabs
import com.rafeeq.companion.data.voice.Speakable
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * منطق النطق الخالص.
 *
 * الخطأ هنا يُدفع ثمنه حرفًا حرفًا: ElevenLabs يحاسب بالحرف، فتلاوة كتلة
 * شيفرة أو نطق علامات Markdown خسارةُ مالٍ وجودةٍ معًا. ونفس هذه الحالات
 * مُختبَرة في نسخة ويندوز، فيبقى التطبيقان ينطقان الجملة نفسها بالطريقة نفسها.
 */
class SpeakableTest {

    @Test
    fun `الجُمل تُقتطع عند الترقيم العربي والإنجليزي`() {
        val (ready, rest) = Speakable.takeSentences("فتحت المجلد. وجدت ثلاثة ملفات؟ الباقي")
        assertEquals(listOf("فتحت المجلد.", "وجدت ثلاثة ملفات؟"), ready)
        assertEquals("الباقي", rest)

        val (two, _) = Speakable.takeSentences("تمّ؛ انتهيت!")
        assertEquals("الردّ العربي القصير لا يجوز إسقاطه", 2, two.size)
    }

    @Test
    fun `الجملة غير المكتملة تنتظر اكتمالها`() {
        val (ready, rest) = Speakable.takeSentences("أنا أعمل على")
        assertTrue(ready.isEmpty())
        assertEquals("أنا أعمل على", rest)
    }

    @Test
    fun `البثّ المتدفّق ينطق جملة جملة`() {
        var buffer = ""
        val spoken = mutableListOf<String>()
        for (delta in listOf("رتّبت ", "الملفات. ", "وجدت ", "خمسة عشر ملفًا.")) {
            buffer += delta
            val (ready, rest) = Speakable.takeSentences(buffer)
            spoken += ready
            buffer = rest
        }
        assertEquals(listOf("رتّبت الملفات.", "وجدت خمسة عشر ملفًا."), spoken)
        assertEquals("", buffer)
    }

    @Test
    fun `الترقيم وحده لا يصير نداء شبكة مدفوعًا`() {
        val (ready, _) = Speakable.takeSentences("...!!! ")
        assertTrue(ready.isEmpty())
    }

    @Test
    fun `التنظيف يمنع نطق علامات Markdown`() {
        val clean = Speakable.clean("**تمّ** الأمر `npm install` بنجاح")
        assertFalse("النجوم تُنطق حرفيًا لو بقيت", clean.contains("*"))
        assertFalse(clean.contains("`"))
        assertTrue(clean.contains("npm install"))
    }

    @Test
    fun `كتل الشيفرة تُختصر ولا تُتلى`() {
        val clean = Speakable.clean("جرّب:\n```bash\nrm -rf /tmp/x\nls -la\n```\nوانتهى")
        assertFalse("كتلة الشيفرة تُتلى سطرًا سطرًا لو بقيت", clean.contains("rm -rf"))
        assertTrue(clean.contains("شيفرة"))
        assertTrue(clean.contains("وانتهى"))
    }

    @Test
    fun `الروابط تُقال كلمةً لا تُهجّأ`() {
        val named = Speakable.clean("راجع [التوثيق](https://example.com/very/long/path) الآن")
        assertTrue(named.contains("التوثيق"))
        assertFalse(named.contains("example.com"))
        assertTrue(Speakable.clean("حمّله من https://a.io/b").contains("رابط"))
    }

    @Test
    fun `العناوين والقوائم لا تُنطق رموزها`() {
        val clean = Speakable.clean("## العنوان\n- أول\n- ثاني")
        assertFalse(clean.contains("#"))
        assertFalse(clean.contains("-"))
        assertTrue(clean.contains("أول"))
    }

    @Test
    fun `الرموز وحدها لا تُنطق`() {
        assertEquals("", Speakable.clean("   "))
        assertEquals("", Speakable.clean("***"))
    }

    @Test
    fun `مفتاح الذاكرة يتغيّر بتغيّر الصوت أو النموذج`() {
        val base = ElevenLabs.SpeechSettings(voiceId = "v1", modelId = "m1")
        val sameText = "تمّ ترتيب الملفات"

        assertEquals(
            "النصّ نفسه بالصوت نفسه يجب أن يُقرأ من الذاكرة لا أن يُدفع ثمنه ثانيةً",
            ElevenLabs.cacheName(sameText, base),
            ElevenLabs.cacheName(sameText, base),
        )
        assertNotEquals(
            "تغيير الصوت يجب أن ينتج ملفًا آخر، وإلا سُمع الصوت القديم",
            ElevenLabs.cacheName(sameText, base),
            ElevenLabs.cacheName(sameText, base.copy(voiceId = "v2")),
        )
        assertNotEquals(
            ElevenLabs.cacheName(sameText, base),
            ElevenLabs.cacheName(sameText, base.copy(modelId = "m2")),
        )
        assertTrue(ElevenLabs.cacheName(sameText, base).endsWith(".mp3"))
    }
}

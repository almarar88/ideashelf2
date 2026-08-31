import { useEffect, useMemo, useState } from 'react'
import type { AudioTag } from '../../shared/types'
import { formatDuration } from '../lib/format'
import { useToast } from '../lib/toastContext'

type FormState = Partial<
  Pick<AudioTag, 'title' | 'artist' | 'album' | 'albumArtist' | 'year' | 'genre' | 'track' | 'comment'>
>

const EMPTY_FORM: FormState = {}

export function TagEditor(): JSX.Element {
  const { showToast } = useToast()
  const [folder, setFolder] = useState<string | null>(null)
  const [files, setFiles] = useState<AudioTag[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [namePattern, setNamePattern] = useState('%artist% - %title%')
  const [fillPattern, setFillPattern] = useState('%artist% - %title%')
  const [saving, setSaving] = useState(false)
  const [coverPath, setCoverPath] = useState<string | null>(null)

  async function pickFolder(): Promise<void> {
    const picked = await window.api.dialogs.pickFolder()
    if (!picked) return
    setFolder(picked)
    setSelected(new Set())
    setLoading(true)
    try {
      setFiles(await window.api.tags.readFolder(picked))
    } catch (err) {
      showToast('فشل قراءة المجلد: ' + (err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.path)), [files, selected])

  useEffect(() => {
    if (selectedFiles.length === 1) {
      const f = selectedFiles[0]
      setForm({
        title: f.title,
        artist: f.artist,
        album: f.album,
        albumArtist: f.albumArtist,
        year: f.year,
        genre: f.genre,
        track: f.track,
        comment: f.comment
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setCoverPath(null)
  }, [selectedFiles.map((f) => f.path).join('|')])

  function toggle(path: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function toggleAll(): void {
    setSelected((prev) => (prev.size === files.length ? new Set() : new Set(files.map((f) => f.path))))
  }

  async function pickCover(): Promise<void> {
    const p = await window.api.dialogs.pickImageFile()
    if (p) setCoverPath(p)
  }

  async function save(): Promise<void> {
    if (selectedFiles.length === 0) return
    setSaving(true)
    try {
      const inputs = selectedFiles.map((f) => ({
        path: f.path,
        ...form,
        coverPath: coverPath || undefined
      }))
      const results = await window.api.tags.writeBatch(inputs)
      const failed = results.filter((r) => !r.success)
      showToast(failed.length ? `${failed.length} فشل من ${results.length}` : 'تم الحفظ')
      if (folder) setFiles(await window.api.tags.readFolder(folder))
    } finally {
      setSaving(false)
    }
  }

  async function renameSelectedFromTags(): Promise<void> {
    if (selectedFiles.length === 0) return
    let ok = 0
    for (const f of selectedFiles) {
      const result = await window.api.tags.renameFromPattern(f, namePattern)
      if (result.success) ok += 1
    }
    showToast(`تمت إعادة تسمية ${ok} من ${selectedFiles.length}`)
    if (folder) setFiles(await window.api.tags.readFolder(folder))
  }

  async function fillFromFileNames(): Promise<void> {
    if (!folder) return
    const results = await window.api.tags.fillFromFileName(folder, fillPattern)
    const writes = results.map((r) => ({ path: r.path, ...r.fields }))
    if (writes.length === 0) {
      showToast('لم يتطابق أي ملف مع النمط')
      return
    }
    const written = await window.api.tags.writeBatch(writes)
    showToast(`تم تعبئة وحفظ وسوم ${written.filter((w) => w.success).length} ملف من الاسم`)
    setFiles(await window.api.tags.readFolder(folder))
  }

  return (
    <div className="page">
      <div className="toolbar">
        <button className="btn btn-primary" onClick={pickFolder} disabled={loading}>
          📂 اختر مجلد أغاني
        </button>
        {folder && <span className="muted">{folder}</span>}
        <div className="spacer" />
        {files.length > 0 && (
          <button className="btn btn-sm" onClick={toggleAll}>
            {selected.size === files.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
          </button>
        )}
      </div>

      {files.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🎵</div>
          <div>{loading ? 'جارٍ القراءة…' : 'اختر مجلدًا يحتوي على ملفات صوتية لعرض وتحرير وسومها'}</div>
        </div>
      ) : (
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card" style={{ maxHeight: 560, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>الملف</th>
                  <th>الفنان</th>
                  <th>العنوان</th>
                  <th>المدة</th>
                </tr>
              </thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.path} onClick={() => toggle(f.path)} style={{ cursor: 'pointer' }}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
                    </td>
                    <td>{f.fileName}</td>
                    <td className="muted">{f.artist || '—'}</td>
                    <td className="muted">{f.title || '—'}</td>
                    <td className="muted">{formatDuration(f.durationSec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card card-pad">
            {selectedFiles.length === 0 ? (
              <div className="muted">اختر ملفًا واحدًا أو أكثر من القائمة لتحرير وسومه</div>
            ) : (
              <>
                <h3 style={{ marginTop: 0 }}>
                  {selectedFiles.length === 1 ? selectedFiles[0].fileName : `${selectedFiles.length} ملفات محدَّدة`}
                </h3>
                {selectedFiles.length > 1 && (
                  <p className="muted" style={{ fontSize: 12 }}>
                    الحقول الفارغة لن تُغيَّر — عبّئ فقط ما تريد تطبيقه على كل الملفات المحدَّدة
                  </p>
                )}
                <Field label="العنوان" value={form.title} onChange={(v) => setForm((f) => ({ ...f, title: v }))} />
                <Field label="الفنان" value={form.artist} onChange={(v) => setForm((f) => ({ ...f, artist: v }))} />
                <Field label="الألبوم" value={form.album} onChange={(v) => setForm((f) => ({ ...f, album: v }))} />
                <Field
                  label="فنان الألبوم"
                  value={form.albumArtist}
                  onChange={(v) => setForm((f) => ({ ...f, albumArtist: v }))}
                />
                <div className="grid grid-2" style={{ gap: 10 }}>
                  <Field label="السنة" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} />
                  <Field label="الرقم" value={form.track} onChange={(v) => setForm((f) => ({ ...f, track: v }))} />
                </div>
                <Field label="النوع" value={form.genre} onChange={(v) => setForm((f) => ({ ...f, genre: v }))} />
                <Field
                  label="ملاحظة"
                  value={form.comment}
                  onChange={(v) => setForm((f) => ({ ...f, comment: v }))}
                />

                <div className="toolbar" style={{ marginTop: 10 }}>
                  <button className="btn btn-sm" onClick={pickCover}>
                    🖼️ تغيير الغلاف
                  </button>
                  {coverPath && <span className="muted" style={{ fontSize: 12 }}>سيتم استخدام الصورة المختارة</span>}
                </div>

                <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={save} disabled={saving}>
                  {saving ? 'جارٍ الحفظ…' : '💾 حفظ الوسوم'}
                </button>
                <p className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>
                  الحفظ بالكتابة مدعوم حاليًا لملفات MP3 فقط.
                </p>

                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />

                <h4 style={{ marginBottom: 6 }}>إعادة تسمية من الوسوم</h4>
                <div className="toolbar">
                  <input
                    type="text"
                    value={namePattern}
                    onChange={(e) => setNamePattern(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <button className="btn btn-sm" onClick={renameSelectedFromTags}>
                    تطبيق
                  </button>
                </div>
              </>
            )}

            <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
            <h4 style={{ marginBottom: 6 }}>تعبئة الوسوم من اسم الملف (كل المجلد)</h4>
            <div className="toolbar">
              <input
                type="text"
                value={fillPattern}
                onChange={(e) => setFillPattern(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-sm" onClick={fillFromFileNames}>
                تطبيق على المجلد
              </button>
            </div>
            <p className="muted" style={{ fontSize: 11.5 }}>
              مثال: %artist% - %title% يطابق "Fairuz - Nassam Alayna.mp3"
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange
}: {
  label: string
  value?: string
  onChange: (v: string) => void
}): JSX.Element {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%' }}
      />
    </div>
  )
}

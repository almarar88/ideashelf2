import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  PageHeader,
  Panel,
  Select,
  Textarea,
  Toolbar,
  useUi,
} from "../components/ui";
import { PARTNER_DOC_LABELS } from "@shared/labels";
import { formatDate, todayISO } from "@shared/text";
import type { Partner, PartnerDoc } from "@shared/types";

export default function PartnersPage({ focusId }: { focusId?: number }) {
  const { toast, confirm } = useUi();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [docs, setDocs] = useState<PartnerDoc[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Partner | null>(null);
  const [partnerDraft, setPartnerDraft] = useState<Partial<Partner> | null>(null);
  const [docDraft, setDocDraft] = useState<(Partial<PartnerDoc> & { sourcePath?: string }) | null>(null);

  const load = useCallback(
    async (keepId?: number) => {
      const rows = await api.partners.list(query.trim() || undefined);
      setPartners(rows);
      const target = keepId ?? selected?.id ?? focusId;
      setSelected(rows.find((r) => r.id === target) ?? rows[0] ?? null);
    },
    [query, selected?.id, focusId],
  );

  useEffect(() => {
    void load(focusId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, focusId]);

  useEffect(() => {
    if (!selected) {
      setDocs([]);
      return;
    }
    void api.partnerDocs.list(selected.id).then(setDocs);
  }, [selected]);

  const savePartner = async () => {
    if (!partnerDraft?.name?.trim()) {
      toast("اسم الجهة مطلوب", "danger");
      return;
    }
    const saved = await api.partners.save(partnerDraft);
    setPartnerDraft(null);
    toast("تم حفظ بيانات الجهة", "ok");
    await load(saved.id);
  };

  const saveDoc = async () => {
    if (!docDraft?.title?.trim() || !selected) {
      toast("عنوان الملف مطلوب", "danger");
      return;
    }
    await api.partnerDocs.save({ ...docDraft, partner_id: selected.id });
    setDocDraft(null);
    toast("تم حفظ الملف في سجل الجهة", "ok");
    setDocs(await api.partnerDocs.list(selected.id));
  };

  return (
    <div>
      <PageHeader
        title="سجل الشركاء الخارجيين"
        subtitle="عروض الأسعار والحقائب التدريبية وملفات الشراكة — مقسّمة حسب اسم الجهة"
        actions={
          <Button variant="primary" onClick={() => setPartnerDraft({ name: "", type: "معهد لغات", status: "active" })}>
            + جهة جديدة
          </Button>
        }
      />

      <Toolbar>
        <Input
          placeholder="بحث باسم الجهة أو جهة الاتصال…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 320 }}
        />
        <span className="text-sm" style={{ color: "var(--muted)" }}>
          {partners.length} جهة
        </span>
      </Toolbar>

      <div className="grid gap-4" style={{ gridTemplateColumns: "minmax(300px, 1fr) minmax(400px, 1.5fr)" }}>
        <Panel padded={false}>
          <div className="scroll-y" style={{ maxHeight: "calc(100vh - 260px)" }}>
            {partners.length === 0 ? (
              <EmptyState title="لا توجد جهات مسجّلة" />
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>الجهة</th>
                    <th>النوع</th>
                    <th>الملفات</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p)}
                      style={{
                        cursor: "pointer",
                        background:
                          selected?.id === p.id ? "color-mix(in srgb, var(--accent) 10%, transparent)" : undefined,
                      }}
                    >
                      <td>
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs" style={{ color: "var(--muted)" }}>
                          {p.contact_person ?? "—"}
                        </div>
                      </td>
                      <td className="text-sm">{p.type ?? "—"}</td>
                      <td className="tabular-nums">{p.doc_count ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-4">
          {!selected ? (
            <Panel>
              <EmptyState title="اختر جهة لعرض ملفها" />
            </Panel>
          ) : (
            <>
              <Panel>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <p className="text-sm" style={{ color: "var(--muted)" }}>
                      {selected.type ?? "—"} · {selected.contact_person ?? "بدون جهة اتصال"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setPartnerDraft(selected)}>
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={async () => {
                        if (!(await confirm(`حذف الجهة «${selected.name}»؟`, "ستُحذف كل ملفاتها المسجّلة."))) return;
                        await api.partners.remove(selected.id);
                        setSelected(null);
                        toast("تم حذف الجهة", "ok");
                        await load();
                      }}
                    >
                      حذف
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2 text-sm" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div>
                    <span className="field-label">الهاتف</span>
                    {selected.phone ?? "—"}
                  </div>
                  <div>
                    <span className="field-label">البريد</span>
                    {selected.email ?? "—"}
                  </div>
                  <div className="col-span-2">
                    <span className="field-label">العنوان</span>
                    {selected.address ?? "—"}
                  </div>
                  {selected.notes && (
                    <div className="col-span-2">
                      <span className="field-label">ملاحظات</span>
                      <span className="whitespace-pre-wrap">{selected.notes}</span>
                    </div>
                  )}
                </div>
              </Panel>

              <Panel padded={false}>
                <div className="flex items-center justify-between p-4 pb-2">
                  <h3 className="font-bold text-sm">ملفات الجهة ({docs.length})</h3>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setDocDraft({ kind: "quote", title: "", issued_at: todayISO() })}
                  >
                    + إضافة ملف
                  </Button>
                </div>
                {docs.length === 0 ? (
                  <EmptyState
                    title="لا توجد ملفات"
                    hint="أضف عروض الأسعار والحقائب التدريبية واتفاقيات الشراكة هنا"
                  />
                ) : (
                  <table className="data">
                    <thead>
                      <tr>
                        <th>النوع</th>
                        <th>العنوان</th>
                        <th>المرجع</th>
                        <th>التاريخ</th>
                        <th>المرفق</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <Badge tone="accent">{PARTNER_DOC_LABELS[d.kind]}</Badge>
                          </td>
                          <td>
                            <div className="font-semibold">{d.title}</div>
                            {d.notes && (
                              <div className="text-xs" style={{ color: "var(--muted)" }}>
                                {d.notes}
                              </div>
                            )}
                          </td>
                          <td className="text-sm tabular-nums">{d.ref_no ?? "—"}</td>
                          <td className="text-sm tabular-nums">
                            {formatDate(d.issued_at)}
                            {d.valid_until && (
                              <div className="text-xs" style={{ color: "var(--muted)" }}>
                                حتى {formatDate(d.valid_until)}
                              </div>
                            )}
                          </td>
                          <td>
                            {d.file_path ? (
                              <button className="link text-sm" onClick={() => void api.files.open(d.file_path!)}>
                                فتح
                              </button>
                            ) : (
                              <span className="text-sm" style={{ color: "var(--muted)" }}>
                                —
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => setDocDraft(d)}>
                                تعديل
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={async () => {
                                  if (!(await confirm(`حذف «${d.title}»؟`))) return;
                                  await api.partnerDocs.remove(d.id);
                                  setDocs(await api.partnerDocs.list(selected.id));
                                }}
                              >
                                حذف
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Panel>
            </>
          )}
        </div>
      </div>

      <Modal
        open={!!partnerDraft}
        title={partnerDraft?.id ? "تعديل جهة" : "جهة جديدة"}
        onClose={() => setPartnerDraft(null)}
        footer={
          <>
            <Button onClick={() => setPartnerDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void savePartner()}>
              حفظ
            </Button>
          </>
        }
      >
        {partnerDraft && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="اسم الجهة *">
              <Input
                value={partnerDraft.name ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, name: e.target.value })}
              />
            </Field>
            <Field label="نوع الجهة">
              <Input
                value={partnerDraft.type ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, type: e.target.value })}
                placeholder="معهد لغات، مركز ثقافي، جهة حكومية…"
              />
            </Field>
            <Field label="جهة الاتصال">
              <Input
                value={partnerDraft.contact_person ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, contact_person: e.target.value })}
              />
            </Field>
            <Field label="الهاتف">
              <Input
                value={partnerDraft.phone ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, phone: e.target.value })}
              />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input
                value={partnerDraft.email ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, email: e.target.value })}
              />
            </Field>
            <Field label="الحالة">
              <Select
                value={partnerDraft.status ?? "active"}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, status: e.target.value as Partner["status"] })}
              >
                <option value="active">نشطة</option>
                <option value="inactive">غير نشطة</option>
              </Select>
            </Field>
            <Field label="العنوان" className="col-span-2">
              <Input
                value={partnerDraft.address ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, address: e.target.value })}
              />
            </Field>
            <Field label="ملاحظات" className="col-span-2">
              <Textarea
                value={partnerDraft.notes ?? ""}
                onChange={(e) => setPartnerDraft({ ...partnerDraft, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!docDraft}
        title={docDraft?.id ? "تعديل ملف" : "إضافة ملف للجهة"}
        onClose={() => setDocDraft(null)}
        footer={
          <>
            <Button onClick={() => setDocDraft(null)}>إلغاء</Button>
            <Button variant="primary" onClick={() => void saveDoc()}>
              حفظ
            </Button>
          </>
        }
      >
        {docDraft && (
          <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
            <Field label="نوع الملف">
              <Select
                value={docDraft.kind ?? "quote"}
                onChange={(e) => setDocDraft({ ...docDraft, kind: e.target.value as PartnerDoc["kind"] })}
              >
                {Object.entries(PARTNER_DOC_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="رقم المرجع">
              <Input
                value={docDraft.ref_no ?? ""}
                onChange={(e) => setDocDraft({ ...docDraft, ref_no: e.target.value })}
              />
            </Field>
            <Field label="العنوان *" className="col-span-2">
              <Input
                value={docDraft.title ?? ""}
                onChange={(e) => setDocDraft({ ...docDraft, title: e.target.value })}
              />
            </Field>
            <Field label="تاريخ الإصدار">
              <Input
                type="date"
                value={docDraft.issued_at ?? ""}
                onChange={(e) => setDocDraft({ ...docDraft, issued_at: e.target.value })}
              />
            </Field>
            <Field label="ساري حتى">
              <Input
                type="date"
                value={docDraft.valid_until ?? ""}
                onChange={(e) => setDocDraft({ ...docDraft, valid_until: e.target.value })}
              />
            </Field>
            <div className="col-span-2">
              <span className="field-label">المرفق</span>
              <div className="flex items-center gap-2">
                <Button
                  onClick={async () => {
                    const picked = await api.files.pick();
                    if (picked) setDocDraft({ ...docDraft, sourcePath: picked });
                  }}
                >
                  اختيار ملف…
                </Button>
                <span className="text-sm truncate" style={{ color: "var(--muted)" }}>
                  {docDraft.sourcePath ?? docDraft.file_name ?? "لا يوجد مرفق"}
                </span>
              </div>
            </div>
            <Field label="ملاحظات" className="col-span-2">
              <Textarea
                value={docDraft.notes ?? ""}
                onChange={(e) => setDocDraft({ ...docDraft, notes: e.target.value })}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}

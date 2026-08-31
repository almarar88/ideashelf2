import { useCallback, useEffect, useState } from "react";
import { api, type SystemInfo } from "../lib/api";
import {
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Panel,
  Select,
  useUi,
} from "../components/ui";
import { formatDateTime } from "@shared/text";

export default function SettingsPage({
  onThemeChange,
  onOrgChange,
}: {
  onThemeChange: (t: "dark" | "light") => void;
  onOrgChange: (name: string) => void;
}) {
  const { toast, confirm } = useUi();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [orgName, setOrgName] = useState("");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [backups, setBackups] = useState<{ path: string; size: number; created_at: string }[]>([]);

  const load = useCallback(async () => {
    const [system, settings, list] = await Promise.all([
      api.settings.info(),
      api.settings.all(),
      api.backup.list(),
    ]);
    setInfo(system);
    setOrgName(settings.org_name ?? system.orgName);
    setTheme(settings.theme === "light" ? "light" : "dark");
    setBackups(list);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveOrg = async () => {
    await api.settings.set("org_name", orgName.trim() || "الإدارة الأكاديمية");
    onOrgChange(orgName.trim() || "الإدارة الأكاديمية");
    toast("تم حفظ اسم الجهة — سيظهر في ترويسة التقارير", "ok");
  };

  return (
    <div>
      <PageHeader title="الإعدادات والنسخ الاحتياطي" subtitle="بياناتك محفوظة محليًا على هذا الجهاز فقط" />

      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <Panel>
          <h3 className="font-bold text-sm mb-3">إعدادات عامة</h3>
          <Field label="اسم الجهة (يظهر في ترويسة التقارير)">
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
          </Field>
          <div className="mt-3">
            <Field label="مظهر التطبيق">
              <Select
                value={theme}
                onChange={async (e) => {
                  const next = e.target.value as "dark" | "light";
                  setTheme(next);
                  onThemeChange(next);
                  await api.settings.set("theme", next);
                }}
              >
                <option value="dark">داكن</option>
                <option value="light">فاتح</option>
              </Select>
            </Field>
          </div>
          <div className="mt-4">
            <Button variant="primary" onClick={() => void saveOrg()}>
              حفظ
            </Button>
          </div>
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">معلومات النظام</h3>
          {!info ? (
            <p style={{ color: "var(--muted)" }}>جارٍ التحميل…</p>
          ) : (
            <dl className="text-sm space-y-2">
              <Row label="إصدار البرنامج" value={info.version} />
              <Row label="إصدار Electron" value={info.electron} />
              <Row label="حجم قاعدة البيانات" value={`${Math.round(info.dbSize / 1024)} ك.ب`} />
              <Row label="مسار قاعدة البيانات" value={info.dbPath} mono />
              <Row label="مجلد النسخ الاحتياطية" value={info.backupsDir} mono />
            </dl>
          )}
          {info && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={() => void api.files.reveal(info.dbPath)}>
                فتح مجلد البيانات
              </Button>
            </div>
          )}
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">النسخ الاحتياطي والاستعادة</h3>
          <div className="flex gap-2 flex-wrap mb-3">
            <Button
              variant="primary"
              onClick={async () => {
                const res = await api.backup.create();
                toast(`تم إنشاء نسخة (${Math.round(res.size / 1024)} ك.ب)`, "ok");
                await load();
              }}
            >
              نسخة احتياطية الآن
            </Button>
            <Button
              onClick={async () => {
                const res = await api.backup.exportTo();
                if (res) toast("تم تصدير النسخة", "ok");
              }}
            >
              تصدير إلى ملف…
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await api.backup.restore();
              }}
            >
              استعادة من ملف…
            </Button>
          </div>
          <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
            يُنشئ النظام نسخة تلقائية عند أول تشغيل كل يوم وعند إغلاق البرنامج، ويحتفظ بآخر ٢٠ نسخة.
          </p>
          {backups.length === 0 ? (
            <EmptyState title="لا توجد نسخ محفوظة" />
          ) : (
            <ul className="space-y-1.5 scroll-y" style={{ maxHeight: 220 }}>
              {backups.map((b) => (
                <li key={b.path} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate" title={b.path}>
                    {b.path.split(/[\\/]/).pop()}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums" style={{ color: "var(--muted)" }}>
                      {Math.round(b.size / 1024)} ك.ب · {formatDateTime(b.created_at)}
                    </span>
                    <Button size="sm" onClick={() => void api.backup.restore(b.path)}>
                      استعادة
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h3 className="font-bold text-sm mb-3">البيانات</h3>
          <p className="text-sm mb-3" style={{ color: "var(--ink-2)" }}>
            يمكنك تعبئة النظام ببيانات تجريبية لاستكشاف الوحدات، أو تفريغه بالكامل للبدء ببياناتك الحقيقية.
            في الحالتين تُحفظ نسخة احتياطية أولًا.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={async () => {
                const res = await api.demo.seed();
                toast(res.message, res.ok ? "ok" : "danger");
                await load();
              }}
            >
              إضافة بيانات تجريبية
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!(await confirm("تفريغ قاعدة البيانات بالكامل؟", "ستُحفظ نسخة احتياطية قبل الحذف."))) return;
                const res = await api.demo.reset();
                toast(res.message, res.ok ? "ok" : "danger");
                await load();
              }}
            >
              تفريغ كل البيانات
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt style={{ color: "var(--muted)" }}>{label}</dt>
      <dd
        className="text-end truncate"
        title={value}
        style={{ color: "var(--ink-2)", fontFamily: mono ? "monospace" : undefined, maxWidth: "60%" }}
      >
        {value}
      </dd>
    </div>
  );
}

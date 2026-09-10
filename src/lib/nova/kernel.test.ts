/**
 * فحوص ثوابت النواة.
 *
 * هذه ليست تغطية تجميلية: النظام كله يقوم على ثلاث دعاوى، وكل واحدة منها
 * تُفحَص هنا لأن انكسارها بصمت يهدم ميزة كاملة:
 *   1) النواة دالة نقية → الإرجاع الزمني صحيح.
 *   2) حاجز التحقق يرفض ما لا يطابق المخطط → الذكاء لا يملك أكثر من المستخدم.
 *   3) مواصفات الواجهات المولّدة تُفحَص قبل الرسم → لا يُشغّل كود مولّد.
 *
 * التشغيل: npm test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { execute, executePlan, initialState, replay } from "./kernel";
import { reflexPlan } from "./reflex";
import { fold, foldWithMap, related, stem } from "./text";
import { searchFs, seedFs } from "./fs";
import { appSpecSchema, parseSpec } from "./spec";
import { sanitizePlan, syscallManual, validateCall } from "./syscalls";
import type { NovaState } from "./types";

function live(): NovaState {
  return { ...initialState(), phase: "live" };
}

test("النواة لا تُعدّل الحالة الممرّرة (نقاء مرجعي)", () => {
  const before = live();
  const snapshot = JSON.stringify(before);
  execute(before, { op: "win.open", args: { app: "files" } });
  assert.equal(JSON.stringify(before), snapshot, "الحالة الأصلية تغيّرت — الإرجاع الزمني ينكسر");
});

test("كل نداء ينتج قيدًا في السجل، ناجحًا أو فاشلًا", () => {
  const s1 = execute(live(), { op: "win.open", args: { app: "files" } });
  assert.equal(s1.state.journal.length, 1);
  assert.equal(s1.state.journal[0].ok, true);

  const s2 = execute(s1.state, { op: "win.open", args: { app: "لا-يوجد" } });
  assert.equal(s2.ok, false);
  assert.equal(s2.state.journal.length, 2);
  assert.equal(s2.state.journal[1].ok, false, "النداء الفاشل يجب أن يُسجّل أيضًا");
});

test("إعادة تشغيل السجل تعيد بناء الحالة نفسها", () => {
  const base = live();
  const plan = [
    { op: "win.open", args: { app: "files" } },
    { op: "theme.set", args: { mode: "dawn", accent: "#22c55e" } },
    { op: "win.open", args: { app: "shell" } },
    { op: "fs.write", args: { path: "/بيتي/ملف.md", content: "محتوى" } },
  ];
  const forward = executePlan(base, plan, "user");
  const rebuilt = replay(base, forward.state.journal, forward.state.seq);

  assert.equal(rebuilt.windows.length, forward.state.windows.length);
  assert.equal(rebuilt.theme.mode, "dawn");
  assert.equal(rebuilt.theme.accent, "#22c55e");
  assert.equal(rebuilt.fs.find((f) => f.path === "/بيتي/ملف.md")?.content, "محتوى");
});

test("الإرجاع إلى نقطة وسطى يُسقط ما بعدها فقط", () => {
  const base = live();
  const step1 = execute(base, { op: "win.open", args: { app: "files" } });
  const step2 = execute(step1.state, { op: "theme.set", args: { accent: "#ef4444" } });
  const step3 = execute(step2.state, { op: "win.open", args: { app: "shell" } });

  const back = replay(base, step3.state.journal, step1.state.seq);
  assert.equal(back.windows.length, 1, "نافذة واحدة فقط كانت موجودة عند النقطة 1");
  assert.equal(back.theme.accent, base.theme.accent, "اللون يجب أن يرجع كما كان");
});

test("حاجز التحقق يرفض العمليات المجهولة والوسائط غير الصالحة", () => {
  assert.equal(validateCall({ op: "fs.nuke", args: {} }).ok, false);
  assert.equal(validateCall({ op: "theme.set", args: { accent: "أحمر" } }).ok, false, "اللون يجب أن يكون hex");
  assert.equal(validateCall({ op: "theme.set", args: { accent: "#ef4444" } }).ok, true);
  assert.equal(validateCall({ op: "win.arrange", args: { mode: "diagonal" } }).ok, false);
});

test("تنقية الخطة تُمرّر الصالح وتُسقط الباقي بلا إسقاط الخطة كلها", () => {
  const { calls, rejected } = sanitizePlan([
    { op: "win.open", args: { app: "files" } },
    { op: "rm -rf", args: { path: "/" } },
    { op: "notify", args: { title: "تم" } },
  ]);
  assert.equal(calls.length, 2);
  assert.equal(rejected.length, 1);
});

test("النداءات الداخلية لا تُعرض لطبقة الذكاء", () => {
  const manual = syscallManual();
  assert.ok(manual.includes("win.open"));
  assert.ok(!manual.includes("app.install"), "app.install داخلي ولا يجوز أن يراه المُخطِّط");
  assert.ok(!manual.includes("agent.finish"));
});

test("النداء الفاشل لا يغيّر شيئًا غير السجل", () => {
  const s = live();
  const r = execute(s, { op: "fs.delete", args: { path: "/غير-موجود" } });
  assert.equal(r.ok, false);
  assert.equal(r.state.fs.length, s.fs.length);
});

test("مواصفة الواجهة المولّدة تُرفض إن خرجت عن اللغة المعلنة", () => {
  assert.equal(parseSpec({ name: "س", icon: "✧", root: { t: "script", src: "alert(1)" } }), null);
  assert.equal(parseSpec({ name: "س", icon: "✧", root: { t: "text", value: "مرحبًا" } })?.name, "س");
  const nested = appSpecSchema.safeParse({
    name: "لوحة",
    icon: "◉",
    root: { t: "stack", children: [{ t: "metric", label: "أ", value: "{{x}}" }] },
  });
  assert.equal(nested.success, true);
});

test("الوكيل لا يُنهي نفسه: آخر خطوة تطلب تقريرًا حقيقيًا", () => {
  let s = execute(live(), { op: "agent.spawn", args: { name: "و", goal: "هدف", steps: ["أ"] } }).state;
  const id = s.agents[0].id;
  const stepped = execute(s, { op: "agent.step", args: { id } });
  assert.equal(stepped.state.agents[0].state, "running", "الوكيل يبقى عاملًا حتى يُكتب تقريره");
  assert.ok(stepped.effects.some((e) => e.kind === "agent-report"));

  s = execute(stepped.state, { op: "agent.finish", args: { id, report: "# نتيجة", source: "reflex" } }).state;
  assert.equal(s.agents[0].state, "done");
  assert.ok(s.fs.some((f) => f.content === "# نتيجة"), "تقرير الوكيل يُكتب في المحتوى");
});

test("قاعدة الأتمتة لا تُطلق نفسها عند كتابة ملف (كسر التكرار)", () => {
  const s = live();
  const withRule = execute(s, {
    op: "automation.create",
    args: {
      label: "عند كتابة ملف: اكتب سجلًا",
      when: "file-written",
      then: [{ op: "fs.write", args: { path: "/سجل.md", content: "x" } }],
    },
  }).state;

  const r = execute(withRule, { op: "fs.write", args: { path: "/أول.md", content: "y" } }, "user");
  const writes = r.state.journal.filter((j) => j.call.op === "fs.write");
  assert.ok(writes.length <= 3, "القاعدة يجب ألا تعيد إطلاق نفسها بلا نهاية");
  assert.ok(r.state.fs.some((f) => f.path === "/سجل.md"));
});

test("الانعكاس: النيّة ذات الفعل تفوز على الاسم", () => {
  const s = live();
  // «المزرعة» اسم قوي، لكن «أطلق وكيلًا» فعل صريح — والفعل أولى
  const agent = reflexPlan("أطلق وكيلًا يجهّز ملخص المزرعة", s);
  assert.equal(agent.calls[0]?.op, "agent.spawn", "الفعل يجب أن يفوز على الاسم");

  const compose = reflexPlan("اصنع لي تطبيقًا لمتابعة مصاريف المزرعة", s);
  assert.equal(compose.calls[0]?.op, "app.compose");

  const search = reflexPlan("ابحث عن المزرعة", s);
  assert.equal(search.calls[0]?.op, "fs.search");

  // الاسم وحده يفتح اللوحة
  const pulse = reflexPlan("المزرعة", s);
  assert.equal(pulse.calls[0]?.op, "farm.pulse");
});

test("الانعكاس: التراجع يستهدف آخر نداء غيّر الحالة فعلًا", () => {
  let s = live();
  s = execute(s, { op: "win.open", args: { app: "files" } }).state;
  const openSeq = s.seq;
  s = execute(s, { op: "say", args: { text: "كلام لا يغيّر شيئًا" } }).state;
  s = execute(s, { op: "notify", args: { title: "ولا هذا" } }).state;

  const plan = reflexPlan("تراجع", s);
  const target = (plan.calls[0]?.args as { seq: number }).seq;
  assert.equal(plan.calls[0]?.op, "journal.rewind");
  assert.equal(target, openSeq - 1, "يجب أن يرجع إلى ما قبل win.open لا إلى ما قبل الكلام");
});

test("التطبيع يحفظ مواقع الحروف الأصلية", () => {
  const raw = "أطلق وكيلًا يجهّز ملخص المزرعة";
  const { folded, map } = foldWithMap(raw);
  assert.equal(map.length, folded.length, "لكل حرف مُطبَّع موضع أصلي واحد");
  // موضع «يجهّز» في النص المُطبَّع يجب أن يشير إلى «ي» في النص الأصلي
  const at = folded.indexOf(fold("يجهز"));
  assert.ok(at > 0);
  assert.equal(raw[map[at]], "ي");
});

test("استخراج الموضوع لا ينكسر مع الحركات ولا مع البادئات", () => {
  const s = live();
  // «وكيل» بادئة لـ«وكيلًا»، و«يجهّز» تحمل شدّة — الاسم يجب أن يخرج نظيفًا
  const plan = reflexPlan("أطلق وكيلًا يجهّز ملخص المزرعة", s);
  const args = plan.calls[0]?.args as { name: string; goal: string };
  assert.equal(plan.calls[0]?.op, "agent.spawn");
  assert.ok(!/^[ًٌٍَُِّْ]/.test(args.name), `اسم الوكيل مشوّه: ${args.name}`);
  assert.ok(args.name.startsWith("يجهّز"), `توقّعنا أن يبدأ الاسم بـ«يجهّز» لا بـ«${args.name}»`);
  assert.ok(args.goal.includes("ملخص"));

  const write = reflexPlan("اكتب ملف اسمه خطة الربع", s);
  const wargs = write.calls[0]?.args as { path: string };
  assert.equal(write.calls[0]?.op, "fs.write");
  assert.ok(wargs.path.includes("خطة الربع"), `المسار غير متوقّع: ${wargs.path}`);
});

test("البحث الدلالي يتجاوز البادئات العربية", () => {
  const fs = seedFs();
  // «والنخيل» و«النخيل» و«نخيل» يجب أن تصل كلها إلى الملف نفسه
  for (const q of ["النخيل", "والنخيل", "نخيل", "مشروع النخيل"]) {
    const hits = searchFs(fs, q);
    assert.ok(
      hits.some((f) => f.path.includes("النخيل")),
      `الاستعلام «${q}» لم يجد ملف النخيل`
    );
  }
  // ولا يعيد نتائج لما ليس موجودًا
  assert.equal(searchFs(fs, "زرافة").length, 0);
});

test("تقشير الجذر لا يبتر الكلمات القصيرة", () => {
  assert.equal(stem("والنخيل"), "نخيل");
  assert.equal(stem("المصاريف"), "مصاريف");
  assert.equal(stem("ولد"), "ولد", "كلمة قصيرة لا تُقشَّر إلى حرفين");
  assert.ok(related("مصاريف", "المصاريف"));
  assert.ok(!related("قط", "مصاريف"));
});

test("إعادة التشغيل مُتماثلة القوى: الفروع لا تُحسب مرتين", () => {
  const base = live();

  // fs.write مع open ينشئ نافذة كأثر متفرّع.
  // لو سُجّل الفرع بنفسه لظهرت نافذتان عند إعادة التشغيل — وهو خلل حقيقي وقع.
  const forward = executePlan(base, [{ op: "fs.write", args: { path: "/بيتي/تقرير.md", content: "س", open: true } }], "user");
  assert.equal(forward.state.windows.length, 1, "نافذة واحدة عند التنفيذ الأول");

  const rebuilt = replay(base, forward.state.journal, forward.state.seq);
  assert.equal(rebuilt.windows.length, 1, "إعادة التشغيل يجب أن تُنتج نافذة واحدة لا نافذتين");
  assert.equal(rebuilt.fs.filter((f) => f.path === "/بيتي/تقرير.md").length, 1);
});

test("قواعد الأتمتة المتفرّعة لا تُضاعف أثرها عند الإرجاع", () => {
  const base = live();
  const ruled = execute(base, {
    op: "automation.create",
    args: {
      label: "عند كتابة ملف: نبّه",
      when: "file-written",
      then: [{ op: "win.open", args: { app: "monitor" } }],
    },
  }).state;

  const forward = execute(ruled, { op: "fs.write", args: { path: "/أ.md", content: "ب" } }, "user");
  const openedOnce = forward.state.windows.filter((w) => w.app === "monitor").length;
  const rebuilt = replay(base, forward.state.journal, forward.state.seq);
  const openedAfterReplay = rebuilt.windows.filter((w) => w.app === "monitor").length;
  assert.equal(openedAfterReplay, openedOnce, "أثر القاعدة يجب أن يكون واحدًا قبل الإرجاع وبعده");
});

test("النداء المتفرّع لا يترك قيدًا في السجل", () => {
  const r = execute(live(), { op: "fs.search", args: { query: "نخيل" } }, "user");
  assert.equal(r.state.journal.length, 1, "قيد واحد فقط: النداء الأصلي");
  assert.equal(r.state.journal[0].call.op, "fs.search", "القيد يجب أن يحمل نيّة المستخدم لا الفرع");
  assert.equal(r.state.windows.length, 1);
});

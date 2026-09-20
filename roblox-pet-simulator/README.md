# 🐾 Pet Kingdom Simulator — لعبة روبلوكس على نمط Pet Simulator X

لعبة متكاملة مكتوبة بالكامل بـ Luau، **بدون أي أصول خارجية**: الخريطة والحيوانات والبيض والصناديق والواجهة كلها تُبنى بالكود عند تشغيل السيرفر.

## المميزات

| النظام | التفاصيل |
|---|---|
| 🌍 المناطق | 10 مناطق (البلدة، الغابة، الشاطئ، الصحراء، الجليد، البركان، السماء، الفضاء، قوس قزح، الفراغ) + صالة VIP. كل منطقة جزيرة بزينة خاصة، وبوابة تُفتح بالعملات، وجسر للمنطقة التالية |
| 🥚 البيض | 14 بيضة (بيضة لكل منطقة + Diamond Egg + Mythic Egg + VIP Egg) مع نسب ظهور معروضة للاعب |
| 🐾 الحيوانات | 72 حيواناً بـ 15 شكلاً مختلفاً (قطة، كلب، أرنب، تنين، روبوت، شبح، غولم، يونيكورن...) و7 ندرات: Common → Exclusive |
| ✨ الأنواع | Normal / Golden (x2) / Rainbow (x4) / Dark Matter (x8) بمظهر مختلف وجزيئات |
| 🍀 الحظ | ترقيات + جيم باس Lucky/Super Lucky + جرعات + مكافأة المجموعة، وتظهر النسب الجديدة مباشرة على البيضة |
| 💰 الصناديق | كومة عملات، صندوق عملات، بلورة ألماس، صندوق VIP، **الصندوق العملاق** (يشترك فيه الجميع) وصندوق الغموض |
| ⚙️ الآلات | آلة الذهب (3 متطابقة → ذهبي)، آلة قوس قزح، آلة المادة المظلمة (مؤقت ساعة)، آلة الدمج (3–10 حيوانات) |
| 👑 VIP | جزيرة خاصة ببيضة وصناديق حصرية، لقب فوق الرأس وفي الشات، عملات x1.5 |
| 🛒 المتجر | 9 جيم باس (VIP, Lucky, Super Lucky, Triple Hatch, Auto Hatch, Auto Tap, +3 Equip, +100 Storage, 2x Coins) + 6 منتجات (ألماس/جرعات) + 6 ترقيات بالألماس |
| 🎁 المكافآت | مكافأة يومية بسلسلة 7 أيام، مكافآت وقت اللعب، أكواد، مكافأة الانضمام للمجموعة |
| 📖 الفهرس | فهرس لكل الحيوانات المكتشفة |
| 🏆 اللوحات | لوحتا متصدرين عالميتان (أغنى اللاعبين، أكثر فتحاً للبيض) |
| 💾 الحفظ | DataStore مع إعادة محاولة، حفظ تلقائي كل دقيقتين، وعند الخروج وإغلاق السيرفر |

## طريقة التركيب (بدون أدوات)

1. حمّل الملف `build/PetKingdomSimulator.rbxmx`.
2. افتح Roblox Studio → مكان جديد (Baseplate) → **احذف الـ Baseplate**.
3. اسحب الملف إلى نافذة Studio (أو `Model > Insert from File`). سيظهر مجلد `PetKingdomSimulator` في Workspace.
4. افتح `View > Command Bar` والصق هذا السطر ثم Enter:

```lua
local m = workspace.PetKingdomSimulator m.Shared.Parent = game.ReplicatedStorage m.Server.Parent = game.ServerScriptService m.Client.Parent = game.StarterPlayer.StarterPlayerScripts m:Destroy()
```

5. `Home > Game Settings > Security` → فعّل **Enable Studio Access to API Services** (لحفظ البيانات).
6. اضغط **Play**. الخريطة كاملة تُبنى تلقائياً خلال ثانية.

> إذا لم تنفّذ الخطوة 4، السكربت `AutoInstall` سينقل المجلدات تلقائياً عند الضغط على Play (لكن نفّذها لتكون دائمة).

### التركيب باستخدام Rojo (للمطورين)

```bash
rojo serve default.project.json
```

ولإعادة توليد ملف `.rbxmx` بعد أي تعديل:

```bash
node tools/build-rbxmx.mjs
```

## قبل النشر

كل الإعدادات في `src/ReplicatedStorage/Shared/Config.luau`:

1. **الجيم باس والمنتجات**: أنشئها من صفحة اللعبة على Roblox وضع أرقامها في `Config.Gamepasses` و `Config.DevProducts`.
2. **`Config.StudioFreeGamepasses = true`** يجعل كل الجيم باس مملوكة أثناء التجربة في Studio. اجعلها `false` قبل النشر.
3. **`Config.GroupId`**: رقم مجموعتك لتفعيل مكافأة المجموعة.
4. **الأكواد**: `Config.Codes` (الحالية: WELCOME, PETKINGDOM, LUCKY, RELEASE).
5. **الأصوات**: `Config.Sounds` (ضع Asset IDs، تُترك 0 = بدون صوت).
6. الأرقام (تكلفة المناطق، البيض، قوة الحيوانات، صحة الصناديق) كلها في `Shared/Data/`.

## طريقة اللعب

- اضغط على كومة عملات أو صندوق → حيواناتك تهاجمه وتحصل على العملات (بدون حيوانات تستطيع الضرب باليد).
- اقترب من بيضة → تظهر لوحة النسب: **E** فتح، **R** فتح 3 (جيم باس)، **T** فتح تلقائي (جيم باس).
- اقترب من بوابة المنطقة التالية وستُفتح تلقائياً إذا كان معك المبلغ، أو من نافذة Zones.
- الآلات على يمين البلدة، الصندوق العملاق وصندوق الغموض في نهاية البلدة، بوابة VIP على يسار السبون.
- **X** أو **Esc** لإغلاق أي نافذة.

## هيكل الكود

```
src/
├── ReplicatedStorage/Shared/
│   ├── Config.luau            الإعدادات
│   ├── Remotes.luau           أسماء الـ RemoteEvents/Functions
│   ├── Data/                  Pets, Eggs, Zones, Breakables, Rarities
│   └── Modules/               Format, Luck, PetUtil, PetModelBuilder (نماذج الحيوانات 3D)
├── ServerScriptService/
│   ├── Main.server.luau
│   └── Services/              DataService, PetService, EggService, BreakableService,
│                              ZoneService, ShopService, RewardService, LeaderboardService, MapBuilder
└── StarterPlayer/StarterPlayerScripts/
    ├── ClientMain.client.luau
    └── Controllers/           UIKit, UIController, InventoryUI, ShopUI, MachineUI, EggController,
                               PetController, BreakableController, ZoneController, EffectsController, PetViewport, DataController
```

## الأمان

- كل الحسابات على السيرفر: العملات، الحظ، فتح البيض، الضرر، المسافات، السعات.
- العميل يعرض فقط. الحيوانات تُرسم على كل عميل من Attribute مُوقّع من السيرفر.
- فحص مسافة عند فتح البيض والضرب، وتبريد (cooldown) على الفتح والضرب.

## ملاحظات وحدود

- الرسومات مبنية من Parts بسيطة (بدون Meshes خارجية) عمداً حتى تعمل فوراً؛ يمكن استبدال `PetModelBuilder` لاحقاً بنماذج خاصة بنفس الواجهة `Build(petId, variant)`.
- نظام التبادل (Trading) غير مضمّن في هذه النسخة.
- اختبر التوازن (الأرقام) في Studio وعدّل `Data/` حسب ما يناسبك.

--!strict
-- إعدادات اللعبة العامة. عدّل الأرقام هنا بدون لمس باقي الكود.
local Config = {}

Config.GameName = "Pet Kingdom Simulator"
Config.DataStoreName = "PetKingdom_Profiles_v1"
Config.LeaderboardStore = "PetKingdom_Leaderboard_v1"

-- ضع أرقام الجيم باس بعد إنشائها من صفحة اللعبة (0 = غير مفعل، الزر يظهر لكن الشراء لا يعمل)
Config.Gamepasses = {
	VIP = 0,
	Lucky = 0,
	SuperLucky = 0,
	TripleHatch = 0,
	AutoHatch = 0,
	AutoTap = 0,
	PlusEquip = 0,
	PlusStorage = 0,
	DoubleCoins = 0,
}

Config.GamepassInfo = {
	{ Key = "VIP", Name = "VIP", Icon = "👑", Desc = "منطقة VIP خاصة + بيضة VIP + صندوق VIP + عملات x1.5 + لقب VIP" },
	{ Key = "Lucky", Name = "Lucky", Icon = "🍀", Desc = "حظ x2 على كل البيض (يزيد فرص الحيوانات النادرة)" },
	{ Key = "SuperLucky", Name = "Super Lucky", Icon = "🌟", Desc = "حظ x3 إضافي، يتجمع مع Lucky" },
	{ Key = "TripleHatch", Name = "Triple Hatch", Icon = "🥚", Desc = "افتح 3 بيضات في نفس الوقت" },
	{ Key = "AutoHatch", Name = "Auto Hatch", Icon = "♻️", Desc = "فتح تلقائي للبيض بدون ضغط" },
	{ Key = "AutoTap", Name = "Auto Tap", Icon = "👆", Desc = "الضرب التلقائي على الصناديق والعملات" },
	{ Key = "PlusEquip", Name = "+3 Equip", Icon = "➕", Desc = "جهّز 3 حيوانات إضافية معك" },
	{ Key = "PlusStorage", Name = "+100 Storage", Icon = "📦", Desc = "100 خانة إضافية في المخزن" },
	{ Key = "DoubleCoins", Name = "2x Coins", Icon = "💰", Desc = "ضاعف كل العملات التي تجمعها" },
}

Config.DevProducts = {
	Diamonds_250 = 0,
	Diamonds_1000 = 0,
	Diamonds_5000 = 0,
	Diamonds_25000 = 0,
	LuckyPotion = 0,
	CoinPotion = 0,
}

Config.DevProductInfo = {
	{ Key = "Diamonds_250", Name = "250 ألماسة", Icon = "💎", Diamonds = 250 },
	{ Key = "Diamonds_1000", Name = "1,000 ألماسة", Icon = "💎", Diamonds = 1000 },
	{ Key = "Diamonds_5000", Name = "5,000 ألماسة", Icon = "💎", Diamonds = 5000 },
	{ Key = "Diamonds_25000", Name = "25,000 ألماسة", Icon = "💎", Diamonds = 25000 },
	{ Key = "LuckyPotion", Name = "جرعة حظ (15 دقيقة)", Icon = "🧪", Potion = "Lucky" },
	{ Key = "CoinPotion", Name = "جرعة عملات (15 دقيقة)", Icon = "🧪", Potion = "Coins" },
}

Config.BaseEquip = 3
Config.BaseStorage = 50
Config.GamepassEquipBonus = 3
Config.GamepassStorageBonus = 100

-- الترقيات تشترى بالألماس
Config.Upgrades = {
	{ Key = "Storage", Name = "مخزن أكبر", Icon = "📦", Desc = "+25 خانة لكل مستوى", MaxLevel = 20, BaseCost = 100, CostMult = 1.45, PerLevel = 25 },
	{ Key = "Equip", Name = "خانات تجهيز", Icon = "🐾", Desc = "+1 حيوان مجهز لكل مستوى", MaxLevel = 5, BaseCost = 500, CostMult = 2.5, PerLevel = 1 },
	{ Key = "Coins", Name = "زيادة العملات", Icon = "💰", Desc = "+5% عملات لكل مستوى", MaxLevel = 20, BaseCost = 150, CostMult = 1.4, PerLevel = 0.05 },
	{ Key = "Luck", Name = "زيادة الحظ", Icon = "🍀", Desc = "+10% حظ لكل مستوى", MaxLevel = 10, BaseCost = 300, CostMult = 1.6, PerLevel = 0.10 },
	{ Key = "Damage", Name = "قوة الحيوانات", Icon = "⚔️", Desc = "+5% قوة لكل مستوى", MaxLevel = 20, BaseCost = 200, CostMult = 1.4, PerLevel = 0.05 },
	{ Key = "Speed", Name = "سرعة المشي", Icon = "🏃", Desc = "+2 سرعة لكل مستوى", MaxLevel = 8, BaseCost = 120, CostMult = 1.8, PerLevel = 2 },
}

Config.Potions = {
	Lucky = { Duration = 900, Mult = 2, Name = "جرعة حظ" },
	Coins = { Duration = 900, Mult = 2, Name = "جرعة عملات" },
}

Config.Machines = {
	Golden = { Requires = 3 },
	Rainbow = { Requires = 3 },
	DarkMatter = { CostDiamonds = 2500, Time = 3600 },
	Fuse = { Min = 3, Max = 10, UpgradeChance = 0.15 },
}

Config.VariantMultipliers = { Normal = 1, Golden = 2, Rainbow = 4, DarkMatter = 8 }
Config.VariantNames = { Normal = "", Golden = "Golden ", Rainbow = "Rainbow ", DarkMatter = "Dark Matter " }

Config.Codes = {
	WELCOME = { Diamonds = 250 },
	PETKINGDOM = { Coins = 5000 },
	LUCKY = { Potion = "Lucky" },
	RELEASE = { Diamonds = 500, Coins = 10000 },
}

Config.DailyRewards = {
	{ Diamonds = 50 },
	{ Diamonds = 75 },
	{ Diamonds = 100 },
	{ Diamonds = 150 },
	{ Diamonds = 200 },
	{ Diamonds = 300 },
	{ Diamonds = 750, Potion = "Lucky" },
}

Config.PlaytimeRewards = {
	{ Minutes = 3, Diamonds = 25 },
	{ Minutes = 8, Diamonds = 50 },
	{ Minutes = 15, Diamonds = 100 },
	{ Minutes = 25, Diamonds = 150 },
	{ Minutes = 40, Diamonds = 250 },
	{ Minutes = 60, Diamonds = 500, Potion = "Coins" },
}

Config.GroupId = 0
Config.GroupBonus = { Luck = 0.25, Coins = 0.25 }

Config.TapDamageBase = 1
Config.TapCooldown = 0.15
Config.HatchCooldown = 0.5
Config.AutoSaveInterval = 120
Config.VIPCoinMultiplier = 1.5
Config.DamageTickRate = 1

-- تصميم الخريطة
Config.Map = {
	ZoneSpacing = 420,
	IslandSize = 300,
	BridgeLength = 120,
	VIPOffset = Vector3.new(700, 0, 0),
}

-- أثناء التجربة في Studio: اعتبر كل الجيم باس مملوكة لتجربة الميزات (عطّلها قبل النشر)
Config.StudioFreeGamepasses = true

-- أصوات (ضع أرقام Asset IDs، 0 = بدون صوت)
Config.Sounds = {
	Music = 0,
	Hatch = 0,
	Coin = 0,
	Hit = 0,
	Break = 0,
	Click = 0,
	Unlock = 0,
}

return Config

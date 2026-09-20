--!strict
-- إعدادات اللعبة العامة. عدّل الأرقام هنا بدون لمس باقي الكود.
local Config = {}

Config.GameName = "Pet Kingdom Simulator"
Config.DataStoreName = "PetKingdom_Profiles_v2"
Config.LeaderboardStore = "PetKingdom_Leaderboard_v2"

-- معرفات الأدمن (UserId). الأدمن يرى لوحة تحكم لإعطاء العملات/الحيوانات وبدء الأحداث.
Config.Admins = {} :: { number }

-- ضع أرقام الجيم باس بعد إنشائها من صفحة اللعبة (0 = غير مفعل)
Config.Gamepasses = {
	VIP = 0,
	Lucky = 0,
	SuperLucky = 0,
	TripleHatch = 0,
	OctupleHatch = 0,
	AutoHatch = 0,
	AutoTap = 0,
	PlusEquip = 0,
	PlusStorage = 0,
	DoubleCoins = 0,
	DoubleDiamonds = 0,
	FastHatch = 0,
	SeasonPass = 0,
}

Config.GamepassInfo = {
	{ Key = "VIP", Name = "VIP", Icon = "👑", Desc = "منطقة VIP + بيضة VIP + صندوق VIP + عملات x1.5 + لقب + صندوق ألماس يومي" },
	{ Key = "Lucky", Name = "Lucky", Icon = "🍀", Desc = "حظ x2 على كل البيض" },
	{ Key = "SuperLucky", Name = "Super Lucky", Icon = "🌟", Desc = "حظ x3 إضافي، يتجمع مع Lucky" },
	{ Key = "TripleHatch", Name = "Triple Hatch", Icon = "🥚", Desc = "افتح 3 بيضات في نفس الوقت" },
	{ Key = "OctupleHatch", Name = "Octuple Hatch", Icon = "🧺", Desc = "افتح 8 بيضات في نفس الوقت (يتطلب Triple Hatch)" },
	{ Key = "AutoHatch", Name = "Auto Hatch", Icon = "♻️", Desc = "فتح تلقائي للبيض" },
	{ Key = "FastHatch", Name = "Fast Hatch", Icon = "⚡", Desc = "أنيميشن فتح أسرع بمرتين" },
	{ Key = "AutoTap", Name = "Auto Tap", Icon = "👆", Desc = "الضرب التلقائي على أقرب صندوق" },
	{ Key = "PlusEquip", Name = "+3 Equip", Icon = "➕", Desc = "جهّز 3 حيوانات إضافية" },
	{ Key = "PlusStorage", Name = "+100 Storage", Icon = "📦", Desc = "100 خانة إضافية في المخزن" },
	{ Key = "DoubleCoins", Name = "2x Coins", Icon = "💰", Desc = "ضاعف كل العملات" },
	{ Key = "DoubleDiamonds", Name = "2x Diamonds", Icon = "💎", Desc = "ضاعف كل الألماس من الصناديق" },
	{ Key = "SeasonPass", Name = "Season Pass", Icon = "🎫", Desc = "يفتح مسار المكافآت المميز في باس الموسم (30 مكافأة إضافية)" },
}

Config.DevProducts = {
	Diamonds_250 = 0,
	Diamonds_1000 = 0,
	Diamonds_5000 = 0,
	Diamonds_25000 = 0,
	Diamonds_100000 = 0,
	LuckyPotion = 0,
	CoinPotion = 0,
	Spins_5 = 0,
	Gems_500 = 0,
	Gems_2500 = 0,
}

Config.DevProductInfo = {
	{ Key = "Diamonds_250", Name = "250 ألماسة", Icon = "💎", Diamonds = 250 },
	{ Key = "Diamonds_1000", Name = "1,000 ألماسة", Icon = "💎", Diamonds = 1000 },
	{ Key = "Diamonds_5000", Name = "5,000 ألماسة", Icon = "💎", Diamonds = 5000 },
	{ Key = "Diamonds_25000", Name = "25,000 ألماسة", Icon = "💎", Diamonds = 25000 },
	{ Key = "Diamonds_100000", Name = "100,000 ألماسة", Icon = "💎", Diamonds = 100000 },
	{ Key = "LuckyPotion", Name = "3 جرعات حظ", Icon = "🧪", Potion = "Lucky", Count = 3 },
	{ Key = "CoinPotion", Name = "3 جرعات عملات", Icon = "🧪", Potion = "Coins", Count = 3 },
	{ Key = "Spins_5", Name = "5 لفات عجلة الحظ", Icon = "🎡", Spins = 5 },
	{ Key = "Gems_500", Name = "500 جوهرة (عملة السوق)", Icon = "💠", Gems = 500 },
	{ Key = "Gems_2500", Name = "2,500 جوهرة", Icon = "💠", Gems = 2500 },
}

Config.BaseEquip = 3
Config.BaseStorage = 50
Config.GamepassEquipBonus = 3
Config.GamepassStorageBonus = 100

-- الترقيات تشترى بالألماس
Config.Upgrades = {
	{ Key = "Storage", Name = "مخزن أكبر", Icon = "📦", Desc = "+25 خانة لكل مستوى", MaxLevel = 30, BaseCost = 100, CostMult = 1.4, PerLevel = 25 },
	{ Key = "Equip", Name = "خانات تجهيز", Icon = "🐾", Desc = "+1 حيوان مجهز لكل مستوى", MaxLevel = 6, BaseCost = 500, CostMult = 2.5, PerLevel = 1 },
	{ Key = "Coins", Name = "زيادة العملات", Icon = "💰", Desc = "+5% عملات لكل مستوى", MaxLevel = 25, BaseCost = 150, CostMult = 1.35, PerLevel = 0.05 },
	{ Key = "Luck", Name = "زيادة الحظ", Icon = "🍀", Desc = "+10% حظ لكل مستوى", MaxLevel = 15, BaseCost = 300, CostMult = 1.5, PerLevel = 0.10 },
	{ Key = "Damage", Name = "قوة الحيوانات", Icon = "⚔️", Desc = "+5% قوة لكل مستوى", MaxLevel = 25, BaseCost = 200, CostMult = 1.35, PerLevel = 0.05 },
	{ Key = "Speed", Name = "سرعة المشي", Icon = "🏃", Desc = "+2 سرعة لكل مستوى", MaxLevel = 8, BaseCost = 120, CostMult = 1.8, PerLevel = 2 },
	{ Key = "Diamonds", Name = "زيادة الألماس", Icon = "💎", Desc = "+10% ألماس لكل مستوى", MaxLevel = 10, BaseCost = 400, CostMult = 1.6, PerLevel = 0.10 },
	{ Key = "XP", Name = "خبرة الحيوانات", Icon = "📈", Desc = "+10% خبرة لكل مستوى", MaxLevel = 10, BaseCost = 250, CostMult = 1.5, PerLevel = 0.10 },
}

-- الجرعات: تُخزن في المخزن وتُستخدم يدوياً
Config.Potions = {
	Lucky = { Duration = 900, Mult = 2, Name = "جرعة حظ", Icon = "🍀", Cost = 150 },
	Coins = { Duration = 900, Mult = 2, Name = "جرعة عملات", Icon = "💰", Cost = 150 },
	Damage = { Duration = 900, Mult = 2, Name = "جرعة قوة", Icon = "⚔️", Cost = 200 },
	Diamonds = { Duration = 600, Mult = 2, Name = "جرعة ألماس", Icon = "💎", Cost = 300 },
}
Config.PotionOrder = { "Lucky", "Coins", "Damage", "Diamonds" }

Config.Machines = {
	Golden = { Requires = 3 },
	Rainbow = { Requires = 3 },
	DarkMatter = { CostDiamonds = 2500, Time = 3600 },
	Fuse = { Min = 3, Max = 10, UpgradeChance = 0.15 },
}

Config.VariantMultipliers = { Normal = 1, Golden = 2, Rainbow = 4, DarkMatter = 8 }
Config.VariantNames = { Normal = "", Golden = "Golden ", Rainbow = "Rainbow ", DarkMatter = "Dark Matter " }
Config.EggVariantCost = { Normal = 1, Golden = 5, Rainbow = 25 }

-- مستويات الحيوانات
Config.PetMaxLevel = 50
Config.PetLevelPowerPerLevel = 0.02 -- +2% قوة لكل مستوى
function Config.XPForLevel(level: number): number
	return math.floor(12 * (level ^ 1.6))
end

-- الإنشانتات
Config.Enchants = {
	Coins = { Name = "Coins", Arabic = "عملات", Icon = "💰", PerTier = 0.10, Weight = 25 },
	Damage = { Name = "Damage", Arabic = "قوة", Icon = "⚔️", PerTier = 0.10, Weight = 25 },
	Luck = { Name = "Luck", Arabic = "حظ", Icon = "🍀", PerTier = 0.05, Weight = 15 },
	Diamonds = { Name = "Diamonds", Arabic = "ألماس", Icon = "💎", PerTier = 0.10, Weight = 12 },
	Crit = { Name = "Critical", Arabic = "ضربة قاضية", Icon = "💥", PerTier = 0.05, Weight = 12 },
	Agility = { Name = "Agility", Arabic = "رشاقة", Icon = "🏃", PerTier = 2, Weight = 6 },
	XP = { Name = "XP", Arabic = "خبرة", Icon = "📈", PerTier = 0.15, Weight = 5 },
}
Config.EnchantTierWeights = { 45, 30, 15, 8, 2 } -- Tier 1..5
Config.EnchantSlots = { Normal = 1, Golden = 2, Rainbow = 2, DarkMatter = 3 }
Config.EnchantCostPerTier = 40 -- diamonds × tier الحيوان
Config.CritMultiplier = 3

-- الريبيرث
Config.Rebirth = {
	RequiredZone = 10,
	BaseCost = 50000000000, -- 50B
	CostMult = 2.5,
	CoinsPerRebirth = 0.5,
	LuckPerRebirth = 0.15,
	DamagePerRebirth = 0.25,
	DiamondsPerRebirth = 0.10,
	TokensPerRebirth = 1,
}

-- السوق (Gems = عملة السوق 💠)
Config.Market = {
	ListingTTL = 3 * 86400,
	MaxListings = 6,
	FeePercent = 10,
	MinPrice = 1,
	MaxPrice = 1000000000,
	Booths = 12,
	CacheSeconds = 8,
	-- قيمة بيع الحيوان للتاجر بالجوهرة حسب الندرة (× مضاعف النوع × (1 + المستوى/50))
	NPCValue = { Common = 1, Uncommon = 2, Rare = 5, Epic = 15, Legendary = 60, Mythical = 250, Exclusive = 800, Huge = 5000, Titanic = 50000 },
}

-- الحيوانات التايتانيك: فرصة سقوط من الزعيم
Config.TitanicBossChance = 0.004
Config.TitanicPets = { "titanic_dragon", "titanic_overlord", "titanic_cat", "titanic_phoenix" }

-- باس الموسم
Config.Season = {
	Id = 1,
	Name = "الموسم 1: مملكة الحيوانات",
	Tiers = 30,
	XPPerAction = { Hatch = 6, Break = 1, Boss = 250, Mission = 300, DungeonWave = 120, Fuse = 20, Golden = 40, Trade = 50, MarketSale = 30 },
	Pets = { "season_fox", "season_dragon" },
}
function Config.SeasonXPForTier(tier: number): number
	return math.floor(400 * (tier ^ 1.15))
end
-- مكافأة كل مستوى (مجانية ومميزة) تُولَّد بنمط ثابت
function Config.SeasonReward(tier: number, premium: boolean): any
	if premium then
		if tier == 30 then
			return { Pet = "season_dragon", Variant = "Rainbow", Diamonds = 5000 }
		elseif tier == 15 then
			return { Pet = "season_dragon", Diamonds = 1500 }
		elseif tier % 5 == 0 then
			return { Diamonds = 600 * (tier / 5), Gems = 100 * (tier / 5) }
		elseif tier % 3 == 0 then
			return { Potion = "Lucky", Count = 2, Diamonds = 150 }
		else
			return { Diamonds = 100 + tier * 20, Spins = 1 }
		end
	else
		if tier == 30 then
			return { Pet = "season_fox", Variant = "Golden", Diamonds = 1500 }
		elseif tier == 10 or tier == 20 then
			return { Pet = "season_fox", Diamonds = 300 }
		elseif tier % 5 == 0 then
			return { Diamonds = 200 * (tier / 5), Gems = 25 * (tier / 5) }
		elseif tier % 4 == 0 then
			return { Potion = "Coins" }
		else
			return { Diamonds = 40 + tier * 8 }
		end
	end
end

-- محطة التصنيع
Config.Recipes = {
	{ Id = "forged_dragon", Name = "Forged Dragon", Output = { Pet = "forged_dragon" }, Diamonds = 2000, Gems = 0,
		Inputs = { { Rarity = "Legendary", Variant = "Golden", Count = 3 } } },
	{ Id = "chaos_golem", Name = "Chaos Golem", Output = { Pet = "chaos_golem" }, Diamonds = 5000, Gems = 200,
		Inputs = { { Rarity = "Mythical", Count = 2 }, { Rarity = "Legendary", Variant = "Rainbow", Count = 1 } } },
	{ Id = "prime_overlord", Name = "Prime Overlord", Output = { Pet = "prime_overlord" }, Diamonds = 15000, Gems = 1000,
		Inputs = { { Rarity = "Exclusive", Count = 1 }, { Rarity = "Mythical", Variant = "Golden", Count = 3 } } },
	{ Id = "golden_huge", Name = "Golden HUGE Cat", Output = { Pet = "huge_cat", Variant = "Golden" }, Diamonds = 25000, Gems = 2500,
		Inputs = { { Pet = "huge_cat", Count = 3 } } },
	{ Id = "lucky_potion_pack", Name = "5 جرعات حظ", Output = { Potion = "Lucky", Count = 5 }, Diamonds = 0, Gems = 300,
		Inputs = { { Rarity = "Rare", Count = 10 } } },
	{ Id = "tokens", Name = "توكن ريبيرث", Output = { Tokens = 1 }, Diamonds = 10000, Gems = 500,
		Inputs = { { Rarity = "Epic", Variant = "Golden", Count = 5 } } },
}

-- الإكسسوارات (بيضة تجميلية بالألماس)
Config.CosmeticEggCost = 400
Config.Accessories = {
	{ Id = "party_hat", Name = "قبعة حفلة", Icon = "🎉", Chance = 30, Color = Color3.fromRGB(255, 90, 160) },
	{ Id = "glasses", Name = "نظارة", Icon = "🕶️", Chance = 25, Color = Color3.fromRGB(20, 20, 20) },
	{ Id = "bow", Name = "فيونكة", Icon = "🎀", Chance = 18, Color = Color3.fromRGB(255, 120, 200) },
	{ Id = "tophat", Name = "قبعة فخمة", Icon = "🎩", Chance = 12, Color = Color3.fromRGB(30, 30, 30) },
	{ Id = "wizard", Name = "قبعة ساحر", Icon = "🧙", Chance = 8, Color = Color3.fromRGB(90, 40, 160) },
	{ Id = "halo", Name = "هالة", Icon = "😇", Chance = 4.5, Color = Color3.fromRGB(255, 230, 120) },
	{ Id = "crown", Name = "تاج", Icon = "👑", Chance = 2, Color = Color3.fromRGB(255, 215, 0) },
	{ Id = "dominus", Name = "دومينوس", Icon = "🕋", Chance = 0.5, Color = Color3.fromRGB(0, 0, 0) },
}

-- Shiny: نسخة لامعة بفرصة صغيرة من أي بيضة (+50% قوة)
Config.Shiny = { Chance = 0.01, Mult = 1.5 }

-- نظام الرحمة: بعد N فتحة بدون Legendary+ من نفس البيضة، الفتحة التالية مضمونة
Config.Pity = { Threshold = 200 }

-- متجر الريبيرث (بالتوكنات)
Config.RebirthShop = {
	{ Key = "RLuck", Name = "حظ الريبيرث", Icon = "🍀", Desc = "+15% حظ لكل مستوى", MaxLevel = 10, Cost = 1, CostStep = 1, PerLevel = 0.15 },
	{ Key = "RCoins", Name = "عملات الريبيرث", Icon = "💰", Desc = "+25% عملات لكل مستوى", MaxLevel = 10, Cost = 1, CostStep = 1, PerLevel = 0.25 },
	{ Key = "REquip", Name = "خانة تجهيز دائمة", Icon = "🐾", Desc = "+1 حيوان مجهز", MaxLevel = 3, Cost = 3, CostStep = 2, PerLevel = 1 },
	{ Key = "RStorage", Name = "مخزن الريبيرث", Icon = "📦", Desc = "+50 خانة", MaxLevel = 5, Cost = 2, CostStep = 1, PerLevel = 50 },
	{ Key = "RDamage", Name = "قوة الريبيرث", Icon = "⚔️", Desc = "+20% قوة لكل مستوى", MaxLevel = 10, Cost = 1, CostStep = 1, PerLevel = 0.20 },
}

-- الألقاب
Config.Titles = {
	{ Id = "", Name = "بدون لقب" },
	{ Id = "hatcher", Name = "🥚 فاقس البيض", Achievement = "hatch_1000" },
	{ Id = "legend", Name = "🌟 أسطورة البيض", Achievement = "hatch_10000" },
	{ Id = "breaker", Name = "💥 المدمّر", Achievement = "break_2500" },
	{ Id = "rich", Name = "💰 الملياردير", Achievement = "coins_1b" },
	{ Id = "trillionaire", Name = "💎 التريليونير", Achievement = "coins_1t" },
	{ Id = "alchemist", Name = "🔮 الخيميائي", Achievement = "fuse_10" },
	{ Id = "bossslayer", Name = "👹 قاتل الزعماء", Achievement = "boss_5" },
	{ Id = "merchant", Name = "🏪 تاجر السوق", Achievement = "sales_50" },
	{ Id = "reborn", Name = "🔁 المولود من جديد", Achievement = "rebirth_1" },
	{ Id = "immortal", Name = "♾️ الخالد", Achievement = "rebirth_5" },
	{ Id = "huge", Name = "🎉 صاحب العملاق", Achievement = "huge_1" },
	{ Id = "titanic", Name = "🌟 صاحب التايتانيك", Achievement = "titanic_1" },
	{ Id = "rift", Name = "🌀 غازي الزنزانة", Stat = "DungeonClears", Target = 5 },
}
Config.RebirthRanks = { { 0, "" }, { 1, "⭐" }, { 3, "⭐⭐" }, { 5, "⭐⭐⭐" }, { 10, "💫" }, { 25, "☀️" }, { 50, "🌌" } }

-- الزنزانة (Rift Dungeon)
Config.Dungeon = {
	Waves = 5,
	CratesPerWave = 6,
	CrateSecondsPerPower = 5, -- صحة الصندوق = مجموع قوة المشاركين × هذا الرقم / عدد الصناديق
	BossSeconds = 35,
	TimeLimit = 240,
	Cooldown = 600,
	WaveReward = { Diamonds = 15, Gems = 3 },
	CoinsPerWaveScale = 400, -- × مضاعف أعلى منطقة
	ClearReward = { Diamonds = 150, Gems = 40 },
	PetChance = 0.08,
	Pet = "rift_guardian",
	BossPetChance = 0.01,
}

-- الكنز العشوائي
Config.Treasure = { Interval = 240, Lifetime = 150, Diamonds = 120, Gems = 25, CoinsScale = 2000, PetChance = 0.05, Pet = "treasure_turtle" }

-- الحارس (زعيم مصغر في كل منطقة)
Config.Guardian = { HealthMult = 150, CoinsMult = 90, Diamonds = 6, Respawn = 480 }

-- أرباح وقت الغياب
Config.Offline = { MaxHours = 8, Rate = 0.35 } -- نسبة من معدل الكسب التقريبي

-- مكافأة الأصدقاء
Config.FriendLuckPerFriend = 0.05
Config.FriendLuckMax = 0.25

-- دورة الليل والنهار
Config.DayNight = { Enabled = true, DayLength = 720 }

-- مكافآت إكمال فهرس كل بيضة
function Config.IndexReward(tier: number): any
	return { Diamonds = 100 * tier, Gems = 10 * tier }
end

-- الزعماء
Config.Bosses = {
	{ Id = "slime_king", Name = "Slime King", Arabic = "ملك السلايم", Zone = 1, Color = Color3.fromRGB(50, 205, 50), Pet = "slime_king", HealthPerPower = 45 },
	{ Id = "mecha_titan", Name = "Mecha Titan", Arabic = "التيتان الآلي", Zone = 11, Color = Color3.fromRGB(120, 130, 160), Pet = "mecha_titan_pet", HealthPerPower = 60 },
	{ Id = "void_leviathan", Name = "Void Leviathan", Arabic = "لوياثان الفراغ", Zone = 16, Color = Color3.fromRGB(40, 0, 70), Pet = "void_leviathan_pet", HealthPerPower = 80 },
}

-- متطلبات الريبيرث لكل عالم
Config.WorldRebirths = { [1] = 0, [2] = 1, [3] = 3 }

-- الهوفربورد
Config.Hoverboards = {
	{ Id = "Basic", Name = "Basic Board", Icon = "🛹", Cost = 500, Speed = 8, Color = Color3.fromRGB(120, 120, 130), Neon = false },
	{ Id = "Neon", Name = "Neon Board", Icon = "🛹", Cost = 2500, Speed = 14, Color = Color3.fromRGB(0, 255, 200), Neon = true },
	{ Id = "Flame", Name = "Flame Board", Icon = "🔥", Cost = 8000, Speed = 20, Color = Color3.fromRGB(255, 90, 0), Neon = true },
	{ Id = "Galaxy", Name = "Galaxy Board", Icon = "🌌", Cost = 25000, Speed = 28, Color = Color3.fromRGB(140, 60, 255), Neon = true },
	{ Id = "Rainbow", Name = "Rainbow Board", Icon = "🌈", Cost = 75000, Speed = 36, Color = Color3.fromRGB(255, 120, 220), Neon = true },
}

-- عجلة الحظ
Config.Spin = {
	ExtraSpinCost = 100,
	Segments = {
		{ Label = "💰 عملات", Coins = 1, Weight = 30 }, -- Coins يُضرب في مضاعف أعلى منطقة × 500
		{ Label = "💎 25", Diamonds = 25, Weight = 22 },
		{ Label = "🍀 جرعة", Potion = "Lucky", Weight = 12 },
		{ Label = "💰 كبير", Coins = 4, Weight = 12 },
		{ Label = "💎 100", Diamonds = 100, Weight = 10 },
		{ Label = "⚔️ جرعة", Potion = "Damage", Weight = 7 },
		{ Label = "💎 500", Diamonds = 500, Weight = 5 },
		{ Label = "🐾 حيوان", Pet = "wheel_wizard", Weight = 2 },
	},
}

-- التاجر المتجول: يتغير كل ساعة
Config.Merchant = {
	RotationSeconds = 3600,
	Slots = 4,
	Pool = {
		{ Type = "Potion", Key = "Lucky", Name = "جرعة حظ", Cost = 100, Limit = 3 },
		{ Type = "Potion", Key = "Coins", Name = "جرعة عملات", Cost = 100, Limit = 3 },
		{ Type = "Potion", Key = "Damage", Name = "جرعة قوة", Cost = 140, Limit = 3 },
		{ Type = "Potion", Key = "Diamonds", Name = "جرعة ألماس", Cost = 220, Limit = 2 },
		{ Type = "Pet", Key = "merchant_mole", Name = "Merchant Mole", Cost = 1500, Limit = 1 },
		{ Type = "Pet", Key = "traveler_owl", Name = "Traveler Owl", Cost = 4000, Limit = 1 },
		{ Type = "Pet", Key = "bazaar_dragon", Name = "Bazaar Dragon", Cost = 12000, Limit = 1 },
		{ Type = "Spins", Key = "3", Name = "3 لفات", Cost = 250, Limit = 2 },
		{ Type = "Tokens", Key = "1", Name = "توكن ريبيرث", Cost = 5000, Limit = 1 },
	},
}

-- الأحداث العالمية
Config.Events = {
	Interval = 420, -- كل 7 دقائق حدث
	Duration = 150,
	List = {
		{ Id = "CoinRush", Name = "💰 Coin Rush", Arabic = "اندفاع العملات x2", Coins = 2 },
		{ Id = "LuckyHour", Name = "🍀 Lucky Time", Arabic = "وقت الحظ x2", Luck = 2 },
		{ Id = "DiamondRain", Name = "💎 Diamond Rain", Arabic = "مطر الألماس x3", Diamonds = 3 },
		{ Id = "BossRaid", Name = "👹 Boss Raid", Arabic = "غارة الزعيم! اهزموه معاً", Boss = true },
		{ Id = "XPFever", Name = "📈 XP Fever", Arabic = "خبرة مضاعفة x3", XP = 3 },
	},
	Boss = { Name = "Slime King", HealthPerPower = 45, Coins = 1500, Diamonds = 40, PetChance = 0.06, Pet = "slime_king", Duration = 150 },
}

-- المهام اليومية
Config.Missions = {
	PerDay = 4,
	Pool = {
		{ Type = "Hatch", Name = "افتح {n} بيضة", Targets = { 15, 40, 100 }, Reward = { Diamonds = 60 } },
		{ Type = "Break", Name = "اكسر {n} صندوق/كومة", Targets = { 50, 150, 400 }, Reward = { Diamonds = 50 } },
		{ Type = "Coins", Name = "اجمع {n} عملة", Targets = { 5000, 100000, 5000000 }, Reward = { Diamonds = 70 } },
		{ Type = "Diamonds", Name = "اجمع {n} ألماسة من الصناديق", Targets = { 10, 30, 80 }, Reward = { Diamonds = 90 } },
		{ Type = "Fuse", Name = "ادمج {n} مرات", Targets = { 2, 5, 12 }, Reward = { Diamonds = 80 } },
		{ Type = "Enchant", Name = "أعد لف إنشانت {n} مرات", Targets = { 2, 5, 10 }, Reward = { Diamonds = 75 } },
		{ Type = "Golden", Name = "اصنع {n} حيوان ذهبي", Targets = { 1, 3, 6 }, Reward = { Diamonds = 120 } },
		{ Type = "Boss", Name = "شارك في هزيمة {n} زعيم", Targets = { 1, 2, 3 }, Reward = { Diamonds = 150, Potion = "Lucky" } },
	},
}

-- الإنجازات (تعتمد على الإحصائيات)
Config.Achievements = {
	{ Id = "hatch_1", Name = "أول بيضة", Stat = "Hatches", Target = 1, Reward = { Diamonds = 25 } },
	{ Id = "hatch_100", Name = "هاوي بيض", Stat = "Hatches", Target = 100, Reward = { Diamonds = 150 } },
	{ Id = "hatch_1000", Name = "محترف بيض", Stat = "Hatches", Target = 1000, Reward = { Diamonds = 600, Pet = "gift_bear" } },
	{ Id = "hatch_10000", Name = "أسطورة البيض", Stat = "Hatches", Target = 10000, Reward = { Diamonds = 3000, Pet = "party_dog" } },
	{ Id = "break_100", Name = "كسّار", Stat = "Breaks", Target = 100, Reward = { Diamonds = 60 } },
	{ Id = "break_2500", Name = "مدمّر", Stat = "Breaks", Target = 2500, Reward = { Diamonds = 400 } },
	{ Id = "break_25000", Name = "زلزال", Stat = "Breaks", Target = 25000, Reward = { Diamonds = 2500 } },
	{ Id = "coins_1m", Name = "مليونير", Stat = "CoinsEarned", Target = 1000000, Reward = { Diamonds = 200 } },
	{ Id = "coins_1b", Name = "ملياردير", Stat = "CoinsEarned", Target = 1000000000, Reward = { Diamonds = 1000 } },
	{ Id = "coins_1t", Name = "تريليونير", Stat = "CoinsEarned", Target = 1000000000000, Reward = { Diamonds = 5000 } },
	{ Id = "fuse_10", Name = "خيميائي", Stat = "Fusions", Target = 10, Reward = { Diamonds = 150 } },
	{ Id = "golden_5", Name = "لمسة ذهب", Stat = "Goldens", Target = 5, Reward = { Diamonds = 200 } },
	{ Id = "rainbow_3", Name = "ألوان الطيف", Stat = "Rainbows", Target = 3, Reward = { Diamonds = 500 } },
	{ Id = "dm_1", Name = "مادة مظلمة", Stat = "DarkMatters", Target = 1, Reward = { Diamonds = 800 } },
	{ Id = "rebirth_1", Name = "ولادة جديدة", Stat = "Rebirths", Target = 1, Reward = { Diamonds = 1000 } },
	{ Id = "rebirth_5", Name = "خالد", Stat = "Rebirths", Target = 5, Reward = { Diamonds = 5000 } },
	{ Id = "boss_5", Name = "قاتل الزعماء", Stat = "BossKills", Target = 5, Reward = { Diamonds = 400 } },
	{ Id = "trade_5", Name = "تاجر", Stat = "Trades", Target = 5, Reward = { Diamonds = 200 } },
	{ Id = "enchant_25", Name = "ساحر", Stat = "Enchants", Target = 25, Reward = { Diamonds = 300 } },
	{ Id = "sales_5", Name = "بائع", Stat = "MarketSales", Target = 5, Reward = { Gems = 100 } },
	{ Id = "sales_50", Name = "تاجر السوق", Stat = "MarketSales", Target = 50, Reward = { Gems = 1000, Diamonds = 1000 } },
	{ Id = "gems_1000", Name = "جامع الجواهر", Stat = "GemsEarned", Target = 1000, Reward = { Diamonds = 500 } },
	{ Id = "huge_1", Name = "عملاق!", Stat = "Huges", Target = 1, Reward = { Diamonds = 2500, Gems = 500 } },
	{ Id = "titanic_1", Name = "تايتانيك!!!", Stat = "Titanics", Target = 1, Reward = { Diamonds = 10000, Gems = 5000 } },
	{ Id = "dungeon_1", Name = "أول زنزانة", Stat = "DungeonClears", Target = 1, Reward = { Diamonds = 300 } },
	{ Id = "dungeon_10", Name = "سيد الزنزانة", Stat = "DungeonClears", Target = 10, Reward = { Diamonds = 2000, Gems = 300 } },
	{ Id = "craft_1", Name = "حرفي", Stat = "Crafts", Target = 1, Reward = { Diamonds = 400 } },
	{ Id = "shiny_1", Name = "لامع!", Stat = "Shinies", Target = 1, Reward = { Diamonds = 500 } },
	{ Id = "treasure_3", Name = "صائد الكنوز", Stat = "Treasures", Target = 3, Reward = { Gems = 200 } },
}

-- الدليل التعليمي للمبتدئين (خطوات متسلسلة)
Config.Tutorial = {
	{ Type = "Break", Target = 5, Text = "اضغط على كومة عملات واكسر 5 منها", Reward = { Coins = 150 } },
	{ Type = "Hatch", Target = 1, Text = "اقترب من Starter Egg واضغط E لفتح بيضة", Reward = { Diamonds = 50 } },
	{ Type = "Break", Target = 25, Text = "اكسر 25 صندوق مع حيواناتك", Reward = { Coins = 1000 } },
	{ Type = "Hatch", Target = 10, Text = "افتح 10 بيضات", Reward = { Diamonds = 100 } },
	{ Type = "Zone", Target = 2, Text = "افتح منطقة الغابة (Forest)", Reward = { Diamonds = 150, Potion = "Lucky" } },
	{ Type = "Golden", Target = 1, Text = "اصنع حيواناً ذهبياً من آلة الذهب", Reward = { Diamonds = 250 } },
	{ Type = "Zone", Target = 4, Text = "وصلت للصحراء! افتح منطقة الصحراء", Reward = { Diamonds = 400, Potion = "Coins" } },
}

-- الإتقان (Mastery): مستويات تعتمد على الإحصائيات وتعطي مكافآت دائمة
Config.Mastery = {
	{ Key = "Coins", Name = "إتقان العملات", Icon = "💰", Stat = "CoinsEarned", Base = 1000, Mult = 4, MaxLevel = 25, PerLevel = { Coins = 0.03 } },
	{ Key = "Hatch", Name = "إتقان البيض", Icon = "🥚", Stat = "Hatches", Base = 25, Mult = 2, MaxLevel = 25, PerLevel = { Luck = 0.02 } },
	{ Key = "Damage", Name = "إتقان الضرر", Icon = "⚔️", Stat = "Damage", Base = 2000, Mult = 4, MaxLevel = 25, PerLevel = { Damage = 0.03 } },
	{ Key = "Diamonds", Name = "إتقان الألماس", Icon = "💎", Stat = "DiamondsEarned", Base = 50, Mult = 2.5, MaxLevel = 20, PerLevel = { Diamonds = 0.03 } },
}

Config.Codes = {
	WELCOME = { Diamonds = 250 },
	PETKINGDOM = { Coins = 5000 },
	LUCKY = { Potion = "Lucky" },
	RELEASE = { Diamonds = 500, Coins = 10000 },
	GIANT = { Diamonds = 1000, Potion = "Damage" },
	SPIN = { Spins = 3 },
	TECHWORLD = { Diamonds = 750 },
	MARKET = { Gems = 100 },
	TITANIC = { Diamonds = 2000, Gems = 250 },
	SEASON1 = { Diamonds = 300, SeasonXP = 500 },
	SHINY = { Diamonds = 400 },
}

Config.DailyRewards = {
	{ Diamonds = 50 },
	{ Diamonds = 75 },
	{ Diamonds = 100, Potion = "Coins" },
	{ Diamonds = 150 },
	{ Diamonds = 200, Spins = 1 },
	{ Diamonds = 300 },
	{ Diamonds = 750, Potion = "Lucky", Spins = 2, Gems = 50 },
}
Config.VIPDailyDiamonds = 300

Config.PlaytimeRewards = {
	{ Minutes = 3, Diamonds = 25 },
	{ Minutes = 8, Diamonds = 50 },
	{ Minutes = 15, Diamonds = 100 },
	{ Minutes = 25, Diamonds = 150, Potion = "Coins" },
	{ Minutes = 40, Diamonds = 250 },
	{ Minutes = 60, Diamonds = 500, Potion = "Lucky", Spins = 1 },
	{ Minutes = 90, Diamonds = 800 },
	{ Minutes = 120, Diamonds = 1500, Potion = "Damage" },
}

Config.GroupId = 0
Config.GroupBonus = { Luck = 0.25, Coins = 0.25 }
Config.PremiumBonus = { Luck = 0.10, Coins = 0.10 }

Config.TapDamageBase = 1
Config.TapCooldown = 0.15
Config.HatchCooldown = 0.5
Config.AutoSaveInterval = 120
Config.VIPCoinMultiplier = 1.5
Config.DamageTickRate = 1
Config.XPPerBreakBase = 2
Config.TradeMaxPets = 8
Config.TradeCountdown = 3

-- تصميم الخريطة
Config.Map = {
	ZoneSpacing = 420,
	IslandSize = 300,
	BridgeLength = 120,
	VIPOffset = Vector3.new(-750, 0, 0),
	MarketOffset = Vector3.new(-750, 0, 700),
	World2Offset = Vector3.new(1500, 0, 0),
	World3Offset = Vector3.new(3000, 0, 0),
	DungeonOffset = Vector3.new(-750, 0, 1500),
}

-- أثناء التجربة في Studio: اعتبر كل الجيم باس مملوكة (عطّلها قبل النشر)
Config.StudioFreeGamepasses = true
-- في Studio: اعتبر كل اللاعبين أدمن (عطّلها قبل النشر)
Config.StudioEveryoneAdmin = true

-- أصوات (ضع أرقام Asset IDs، 0 = بدون صوت)
Config.Sounds = {
	Music = 0,
	Hatch = 0,
	Coin = 0,
	Hit = 0,
	Break = 0,
	Click = 0,
	Unlock = 0,
	Spin = 0,
	Boss = 0,
	Sell = 0,
	Firework = 0,
	Wave = 0,
	Craft = 0,
}

return Config

--!strict
-- المناطق: الترتيب مهم، كل منطقة تُفتح بعد التي قبلها.
local Zones = {}

export type ZoneDef = {
	Index: number,
	Id: string,
	Name: string,
	Arabic: string,
	Cost: number,
	Ground: Color3,
	Accent: Color3,
	Sky: Color3,
	Material: Enum.Material,
	Multiplier: number, -- مضاعف صحة/مكافأة الصناديق
	Breakables: { { Type: string, Count: number } },
	Decor: string, -- نوع الزينة
	World: number,
}

Zones.List = {
	{ Index = 1, Id = "Town", Name = "Town", Arabic = "البلدة", Cost = 0, Multiplier = 1,
		Ground = Color3.fromRGB(106, 190, 90), Accent = Color3.fromRGB(230, 230, 230), Sky = Color3.fromRGB(150, 200, 255),
		Material = Enum.Material.Grass, Decor = "trees",
		Breakables = { { Type = "CoinPile", Count = 14 }, { Type = "CoinChest", Count = 4 }, { Type = "DiamondCrystal", Count = 1 } } },
	{ Index = 2, Id = "Forest", Name = "Forest", Arabic = "الغابة", Cost = 2500, Multiplier = 8,
		Ground = Color3.fromRGB(60, 140, 60), Accent = Color3.fromRGB(100, 70, 40), Sky = Color3.fromRGB(130, 190, 200),
		Material = Enum.Material.Grass, Decor = "trees",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 2 } } },
	{ Index = 3, Id = "Beach", Name = "Beach", Arabic = "الشاطئ", Cost = 20000, Multiplier = 60,
		Ground = Color3.fromRGB(240, 220, 150), Accent = Color3.fromRGB(70, 180, 255), Sky = Color3.fromRGB(160, 220, 255),
		Material = Enum.Material.Sand, Decor = "palms",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 2 } } },
	{ Index = 4, Id = "Desert", Name = "Desert", Arabic = "الصحراء", Cost = 150000, Multiplier = 450,
		Ground = Color3.fromRGB(225, 190, 110), Accent = Color3.fromRGB(190, 120, 60), Sky = Color3.fromRGB(255, 220, 170),
		Material = Enum.Material.Sand, Decor = "cactus",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 2 } } },
	{ Index = 5, Id = "Frozen", Name = "Frozen Tundra", Arabic = "الجليد", Cost = 1000000, Multiplier = 3500,
		Ground = Color3.fromRGB(220, 240, 255), Accent = Color3.fromRGB(150, 210, 255), Sky = Color3.fromRGB(200, 230, 255),
		Material = Enum.Material.Snow, Decor = "ice",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 3 } } },
	{ Index = 6, Id = "Volcano", Name = "Volcano", Arabic = "البركان", Cost = 8000000, Multiplier = 28000,
		Ground = Color3.fromRGB(70, 50, 50), Accent = Color3.fromRGB(255, 90, 20), Sky = Color3.fromRGB(255, 150, 100),
		Material = Enum.Material.Basalt, Decor = "lava",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 3 } } },
	{ Index = 7, Id = "Sky", Name = "Sky Islands", Arabic = "السماء", Cost = 60000000, Multiplier = 220000,
		Ground = Color3.fromRGB(245, 245, 255), Accent = Color3.fromRGB(255, 220, 100), Sky = Color3.fromRGB(180, 210, 255),
		Material = Enum.Material.SmoothPlastic, Decor = "clouds",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 3 } } },
	{ Index = 8, Id = "Space", Name = "Space", Arabic = "الفضاء", Cost = 500000000, Multiplier = 1800000,
		Ground = Color3.fromRGB(60, 60, 80), Accent = Color3.fromRGB(150, 60, 255), Sky = Color3.fromRGB(20, 10, 40),
		Material = Enum.Material.Slate, Decor = "crystals",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 3 } } },
	{ Index = 9, Id = "Rainbow", Name = "Rainbow Realm", Arabic = "عالم قوس قزح", Cost = 4000000000, Multiplier = 14000000,
		Ground = Color3.fromRGB(255, 180, 230), Accent = Color3.fromRGB(120, 255, 220), Sky = Color3.fromRGB(255, 200, 240),
		Material = Enum.Material.Neon, Decor = "crystals",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 3 } } },
	{ Index = 10, Id = "Void", Name = "The Void", Arabic = "الفراغ", Cost = 30000000000, Multiplier = 110000000,
		Ground = Color3.fromRGB(20, 15, 30), Accent = Color3.fromRGB(150, 0, 255), Sky = Color3.fromRGB(5, 0, 15),
		Material = Enum.Material.Basalt, Decor = "crystals",
		Breakables = { { Type = "CoinPile", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 4 } } },
	-- ===== العالم الثاني: عالم التقنية (يتطلب ريبيرث واحد على الأقل) =====
	{ Index = 11, Id = "TechHub", Name = "Tech Hub", Arabic = "مركز التقنية", Cost = 300000000000, Multiplier = 900000000, World = 2,
		Ground = Color3.fromRGB(40, 44, 60), Accent = Color3.fromRGB(0, 255, 255), Sky = Color3.fromRGB(10, 10, 30),
		Material = Enum.Material.Metal, Decor = "tech",
		Breakables = { { Type = "TechCrate", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 4 } } },
	{ Index = 12, Id = "CyberForest", Name = "Cyber Forest", Arabic = "الغابة الرقمية", Cost = 2500000000000, Multiplier = 7000000000, World = 2,
		Ground = Color3.fromRGB(10, 40, 20), Accent = Color3.fromRGB(57, 255, 20), Sky = Color3.fromRGB(0, 20, 10),
		Material = Enum.Material.Neon, Decor = "cybertrees",
		Breakables = { { Type = "TechCrate", Count = 12 }, { Type = "CoinChest", Count = 5 }, { Type = "DiamondCrystal", Count = 4 } } },
	{ Index = 13, Id = "NeonCity", Name = "Neon City", Arabic = "مدينة النيون", Cost = 20000000000000, Multiplier = 55000000000, World = 2,
		Ground = Color3.fromRGB(25, 15, 40), Accent = Color3.fromRGB(255, 45, 149), Sky = Color3.fromRGB(20, 0, 40),
		Material = Enum.Material.Concrete, Decor = "city",
		Breakables = { { Type = "TechCrate", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 4 } } },
	{ Index = 14, Id = "DataCore", Name = "Data Core", Arabic = "نواة البيانات", Cost = 150000000000000, Multiplier = 450000000000, World = 2,
		Ground = Color3.fromRGB(10, 10, 40), Accent = Color3.fromRGB(0, 206, 209), Sky = Color3.fromRGB(0, 0, 20),
		Material = Enum.Material.Glass, Decor = "servers",
		Breakables = { { Type = "TechCrate", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 5 } } },
	{ Index = 15, Id = "Quantum", Name = "Quantum Realm", Arabic = "العالم الكمي", Cost = 1000000000000000, Multiplier = 3500000000000, World = 2,
		Ground = Color3.fromRGB(5, 0, 25), Accent = Color3.fromRGB(255, 0, 255), Sky = Color3.fromRGB(0, 0, 0),
		Material = Enum.Material.Neon, Decor = "quantum",
		Breakables = { { Type = "TechCrate", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 5 } } },
	-- ===== العالم الثالث: العالم الأسطوري (يتطلب 3 ريبيرث) =====
	{ Index = 16, Id = "EnchantedForest", Name = "Enchanted Forest", Arabic = "الغابة المسحورة", Cost = 8000000000000000, Multiplier = 28000000000000, World = 3,
		Ground = Color3.fromRGB(70, 40, 110), Accent = Color3.fromRGB(255, 120, 255), Sky = Color3.fromRGB(40, 10, 60),
		Material = Enum.Material.Grass, Decor = "magictrees",
		Breakables = { { Type = "MagicOrb", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 5 } } },
	{ Index = 17, Id = "CrystalCaves", Name = "Crystal Caves", Arabic = "كهوف الكريستال", Cost = 60000000000000000, Multiplier = 220000000000000, World = 3,
		Ground = Color3.fromRGB(40, 30, 60), Accent = Color3.fromRGB(120, 220, 255), Sky = Color3.fromRGB(10, 10, 30),
		Material = Enum.Material.Slate, Decor = "bigcrystals",
		Breakables = { { Type = "MagicOrb", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 6 } } },
	{ Index = 18, Id = "DragonPeaks", Name = "Dragon Peaks", Arabic = "قمم التنانين", Cost = 500000000000000000, Multiplier = 1800000000000000, World = 3,
		Ground = Color3.fromRGB(90, 60, 60), Accent = Color3.fromRGB(255, 90, 40), Sky = Color3.fromRGB(80, 20, 20),
		Material = Enum.Material.Rock, Decor = "peaks",
		Breakables = { { Type = "MagicOrb", Count = 12 }, { Type = "CoinChest", Count = 6 }, { Type = "DiamondCrystal", Count = 6 } } },
	{ Index = 19, Id = "CelestialPalace", Name = "Celestial Palace", Arabic = "القصر السماوي", Cost = 4000000000000000000, Multiplier = 14000000000000000, World = 3,
		Ground = Color3.fromRGB(245, 240, 255), Accent = Color3.fromRGB(255, 220, 120), Sky = Color3.fromRGB(200, 220, 255),
		Material = Enum.Material.Marble, Decor = "pillars",
		Breakables = { { Type = "MagicOrb", Count = 12 }, { Type = "CoinChest", Count = 7 }, { Type = "DiamondCrystal", Count = 6 } } },
	{ Index = 20, Id = "EternalVoid", Name = "Eternal Void", Arabic = "الفراغ الأبدي", Cost = 30000000000000000000, Multiplier = 110000000000000000, World = 3,
		Ground = Color3.fromRGB(5, 0, 10), Accent = Color3.fromRGB(255, 255, 255), Sky = Color3.fromRGB(0, 0, 0),
		Material = Enum.Material.Neon, Decor = "voidorbs",
		Breakables = { { Type = "MagicOrb", Count = 14 }, { Type = "CoinChest", Count = 7 }, { Type = "DiamondCrystal", Count = 7 } } },
}

-- جزيرة السوق (متاحة للجميع، لا تُفتح بعملات)
Zones.Market = { Index = -1, Id = "Market", Name = "Grand Bazaar", Arabic = "السوق الكبير", Cost = 0, Multiplier = 1, World = 1,
	Ground = Color3.fromRGB(200, 170, 120), Accent = Color3.fromRGB(200, 60, 60), Sky = Color3.fromRGB(255, 230, 200),
	Material = Enum.Material.Cobblestone, Decor = "market",
	Breakables = { { Type = "GemOre", Count = 10 }, { Type = "CoinPile", Count = 6 } } }

Zones.Dungeon = { Index = -2, Id = "Dungeon", Name = "Rift Dungeon", Arabic = "زنزانة الشق", Cost = 0, Multiplier = 1, World = 1,
	Ground = Color3.fromRGB(25, 10, 40), Accent = Color3.fromRGB(157, 0, 255), Sky = Color3.fromRGB(0, 0, 0),
	Material = Enum.Material.Basalt, Decor = "voidorbs", Breakables = {} }

Zones.WorldStart = { [1] = 1, [2] = 11, [3] = 16 }

function Zones.IsWorldStart(index: number): boolean
	for _, start in pairs(Zones.WorldStart) do
		if start == index then
			return true
		end
	end
	return false
end

-- عدد الريبيرث المطلوب لدخول عالم المنطقة
function Zones.RebirthRequired(index: number): number
	local z = Zones.List[index]
	if not z then
		return 0
	end
	local req = { [1] = 0, [2] = 1, [3] = 3 }
	return req[z.World] or 0
end

for _, z in ipairs(Zones.List) do
	if z.World == nil then
		z.World = 1
	end
end

-- منطقة VIP (لا تعتمد على الترتيب)
Zones.VIP = { Index = 0, Id = "VIP", Name = "VIP Lounge", Arabic = "صالة VIP", Cost = 0, Multiplier = 300,
	Ground = Color3.fromRGB(255, 215, 0), Accent = Color3.fromRGB(255, 255, 255), Sky = Color3.fromRGB(255, 240, 200),
	Material = Enum.Material.Marble, Decor = "gold", World = 1,
	Breakables = { { Type = "CoinPile", Count = 8 }, { Type = "VIPChest", Count = 3 }, { Type = "DiamondCrystal", Count = 3 } } }

Zones.World2Start = 11

function Zones.Get(index: number): ZoneDef?
	if index == 0 then
		return Zones.VIP
	elseif index == -1 then
		return Zones.Market
	elseif index == -2 then
		return Zones.Dungeon
	end
	return Zones.List[index]
end

return Zones

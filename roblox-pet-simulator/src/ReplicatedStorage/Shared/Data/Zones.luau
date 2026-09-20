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
}

-- منطقة VIP (لا تعتمد على الترتيب)
Zones.VIP = { Index = 0, Id = "VIP", Name = "VIP Lounge", Arabic = "صالة VIP", Cost = 0, Multiplier = 300,
	Ground = Color3.fromRGB(255, 215, 0), Accent = Color3.fromRGB(255, 255, 255), Sky = Color3.fromRGB(255, 240, 200),
	Material = Enum.Material.Marble, Decor = "gold",
	Breakables = { { Type = "CoinPile", Count = 8 }, { Type = "VIPChest", Count = 3 }, { Type = "DiamondCrystal", Count = 3 } } }

function Zones.Get(index: number): ZoneDef?
	if index == 0 then
		return Zones.VIP
	end
	return Zones.List[index]
end

return Zones

--!strict
-- الصناديق والعملات القابلة للكسر. الأرقام الأساسية تُضرب في مضاعف المنطقة.
local Breakables = {}

export type BreakableDef = {
	Name: string,
	Arabic: string,
	Health: number,
	Coins: number,
	Diamonds: number,
	Gems: number?,
	Respawn: number,
	Size: Vector3,
	Color: Color3,
	Shape: string, -- "pile" | "chest" | "crystal" | "giant" | "gift"
	Material: Enum.Material,
}

Breakables.Types = {
	CoinPile = { Name = "Coin Pile", Arabic = "كومة عملات", Health = 25, Coins = 12, Diamonds = 0, Respawn = 4,
		Size = Vector3.new(4, 2.5, 4), Color = Color3.fromRGB(255, 200, 40), Shape = "pile", Material = Enum.Material.Metal },
	CoinChest = { Name = "Coin Chest", Arabic = "صندوق عملات", Health = 150, Coins = 90, Diamonds = 0, Respawn = 12,
		Size = Vector3.new(5, 4, 4), Color = Color3.fromRGB(140, 90, 40), Shape = "chest", Material = Enum.Material.Wood },
	DiamondCrystal = { Name = "Diamond Crystal", Arabic = "بلورة ألماس", Health = 600, Coins = 0, Diamonds = 3, Respawn = 45,
		Size = Vector3.new(3, 6, 3), Color = Color3.fromRGB(120, 230, 255), Shape = "crystal", Material = Enum.Material.Glass },
	VIPChest = { Name = "VIP Chest", Arabic = "صندوق VIP", Health = 400, Coins = 300, Diamonds = 2, Respawn = 20,
		Size = Vector3.new(6, 5, 5), Color = Color3.fromRGB(255, 215, 0), Shape = "chest", Material = Enum.Material.Metal },
	GiantChest = { Name = "Giant Chest", Arabic = "الصندوق العملاق", Health = 250000, Coins = 25000, Diamonds = 150, Respawn = 600,
		Size = Vector3.new(14, 11, 11), Color = Color3.fromRGB(200, 60, 200), Shape = "giant", Material = Enum.Material.Metal },
	TechCrate = { Name = "Tech Crate", Arabic = "صندوق تقني", Health = 30, Coins = 14, Diamonds = 0, Respawn = 4,
		Size = Vector3.new(4, 4, 4), Color = Color3.fromRGB(60, 200, 255), Shape = "gift", Material = Enum.Material.Metal },
	Boss = { Name = "Slime King", Arabic = "ملك السلايم", Health = 1000, Coins = 1500, Diamonds = 40, Respawn = 999999,
		Size = Vector3.new(16, 14, 16), Color = Color3.fromRGB(50, 205, 50), Shape = "boss", Material = Enum.Material.SmoothPlastic },
	GemOre = { Name = "Gem Ore", Arabic = "خام الجواهر", Health = 900, Coins = 0, Diamonds = 0, Gems = 2, Respawn = 60,
		Size = Vector3.new(4, 4, 4), Color = Color3.fromRGB(120, 60, 200), Shape = "crystal", Material = Enum.Material.Glass },
	MagicOrb = { Name = "Magic Orb", Arabic = "كرة سحرية", Health = 32, Coins = 15, Diamonds = 0, Respawn = 4,
		Size = Vector3.new(4, 4, 4), Color = Color3.fromRGB(255, 120, 255), Shape = "orb", Material = Enum.Material.Neon },
	Guardian = { Name = "Zone Guardian", Arabic = "حارس المنطقة", Health = 25 * 150, Coins = 12 * 90, Diamonds = 6, Respawn = 480,
		Size = Vector3.new(9, 9, 9), Color = Color3.fromRGB(80, 80, 120), Shape = "golem", Material = Enum.Material.Slate },
	Treasure = { Name = "Treasure Chest", Arabic = "صندوق الكنز", Health = 3000, Coins = 2000, Diamonds = 120, Gems = 25, Respawn = 999999,
		Size = Vector3.new(7, 6, 6), Color = Color3.fromRGB(255, 215, 0), Shape = "chest", Material = Enum.Material.Metal },
	RiftCrate = { Name = "Rift Crate", Arabic = "صندوق الشق", Health = 100, Coins = 100, Diamonds = 0, Respawn = 999999,
		Size = Vector3.new(4.5, 4.5, 4.5), Color = Color3.fromRGB(120, 0, 200), Shape = "gift", Material = Enum.Material.Neon },
	RiftBoss = { Name = "Rift Warden", Arabic = "حارس الشق", Health = 1000, Coins = 1000, Diamonds = 0, Respawn = 999999,
		Size = Vector3.new(14, 12, 14), Color = Color3.fromRGB(60, 0, 120), Shape = "boss", Material = Enum.Material.Neon },
	MysteryBox = { Name = "Mystery Box", Arabic = "صندوق الغموض", Health = 5000, Coins = 2000, Diamonds = 25, Respawn = 240,
		Size = Vector3.new(6, 6, 6), Color = Color3.fromRGB(80, 60, 200), Shape = "gift", Material = Enum.Material.Neon },
}

function Breakables.Get(t: string): BreakableDef?
	return Breakables.Types[t]
end

return Breakables

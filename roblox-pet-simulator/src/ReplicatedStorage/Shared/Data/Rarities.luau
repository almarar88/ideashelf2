--!strict
local Rarities = {}

Rarities.Order = { "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Exclusive", "Huge", "Titanic" }

Rarities.Info = {
	Common = { Rank = 1, Color = Color3.fromRGB(190, 190, 190), LuckAffected = false, Arabic = "عادي" },
	Uncommon = { Rank = 2, Color = Color3.fromRGB(90, 210, 90), LuckAffected = false, Arabic = "غير شائع" },
	Rare = { Rank = 3, Color = Color3.fromRGB(70, 140, 255), LuckAffected = true, Arabic = "نادر" },
	Epic = { Rank = 4, Color = Color3.fromRGB(170, 70, 255), LuckAffected = true, Arabic = "ملحمي" },
	Legendary = { Rank = 5, Color = Color3.fromRGB(255, 170, 30), LuckAffected = true, Arabic = "أسطوري" },
	Mythical = { Rank = 6, Color = Color3.fromRGB(255, 60, 120), LuckAffected = true, Arabic = "خرافي" },
	Exclusive = { Rank = 7, Color = Color3.fromRGB(0, 255, 230), LuckAffected = true, Arabic = "حصري" },
	Huge = { Rank = 8, Color = Color3.fromRGB(255, 0, 80), LuckAffected = true, Arabic = "عملاق" },
	Titanic = { Rank = 9, Color = Color3.fromRGB(255, 255, 255), LuckAffected = true, Arabic = "تايتانيك" },
}

function Rarities.Rank(name: string): number
	local info = Rarities.Info[name]
	return info and info.Rank or 1
end

function Rarities.Color(name: string): Color3
	local info = Rarities.Info[name]
	return info and info.Color or Color3.new(1, 1, 1)
end

return Rarities

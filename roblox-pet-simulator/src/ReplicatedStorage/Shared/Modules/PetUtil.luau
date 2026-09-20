--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)

local PetUtil = {}

export type Enchant = { Type: string, Tier: number }
export type PetInstance = {
	Uid: string,
	Id: string,
	Variant: string,
	Locked: boolean,
	Equipped: boolean,
	Time: number,
	Level: number,
	XP: number,
	Enchants: { Enchant },
	Shiny: boolean?,
	Accessory: string?,
	Nick: string?,
}

function PetUtil.Level(inst: PetInstance): number
	return math.clamp(inst.Level or 1, 1, Config.PetMaxLevel)
end

function PetUtil.BasePower(inst: PetInstance): number
	local def = Pets.Get(inst.Id)
	if not def then
		return 0
	end
	local mult = Config.VariantMultipliers[inst.Variant] or 1
	local levelMult = 1 + (PetUtil.Level(inst) - 1) * Config.PetLevelPowerPerLevel
	local shiny = inst.Shiny and Config.Shiny.Mult or 1
	return math.floor(def.Power * mult * levelMult * shiny + 0.5)
end

function PetUtil.DisplayName(inst: PetInstance): string
	local def = Pets.Get(inst.Id)
	if inst.Nick and inst.Nick ~= "" then
		return inst.Nick
	end
	local prefix = Config.VariantNames[inst.Variant] or ""
	return (inst.Shiny and "✨ " or "") .. prefix .. (def and def.Name or inst.Id)
end

function PetUtil.RarityColor(inst: PetInstance): Color3
	local def = Pets.Get(inst.Id)
	return def and Rarities.Color(def.Rarity) or Color3.new(1, 1, 1)
end

function PetUtil.SortByPower(list: { PetInstance })
	table.sort(list, function(a, b)
		local pa, pb = PetUtil.BasePower(a), PetUtil.BasePower(b)
		if pa ~= pb then
			return pa > pb
		end
		return a.Uid < b.Uid
	end)
end

function PetUtil.NextVariant(v: string): string?
	if v == "Normal" then
		return "Golden"
	elseif v == "Golden" then
		return "Rainbow"
	elseif v == "Rainbow" then
		return "DarkMatter"
	end
	return nil
end

-- القدرة الخاصة للحيوان وقيمتها الحالية
function PetUtil.Ability(inst: PetInstance): (any?, number)
	local def = Pets.Get(inst.Id)
	if not def then
		return nil, 0
	end
	local ab = Config.Abilities[def.Shape]
	if not ab then
		return nil, 0
	end
	local level = PetUtil.Level(inst)
	local milestone = 1
	for _, m in ipairs(Config.PetLevelMilestones) do
		if level >= m.Level then
			milestone = m.Mult
		end
	end
	local value = ab.Base * (Config.AbilityRarityMult[def.Rarity] or 1) * (1 + (level - 1) / 25) * milestone
	if inst.Shiny then
		value *= 1.25
	end
	return ab, value
end

function PetUtil.AbilityText(inst: PetInstance): string
	local ab, value = PetUtil.Ability(inst)
	if not ab then
		return ""
	end
	local shown = ab.Stat == "Agility" and string.format("%.1f", value) or string.format("%.1f", value * 100)
	return ab.Icon .. " " .. ab.Arabic .. ": " .. (ab.Desc:gsub("{v}", shown))
end

-- مجموع القدرات للحيوانات المجهزة
function PetUtil.AbilityBonuses(pets: { PetInstance }): { [string]: number }
	local out = { Coins = 0, Damage = 0, Luck = 0, Diamonds = 0, Crit = 0, XP = 0, GemChance = 0, Agility = 0 }
	for _, pet in ipairs(pets) do
		if pet.Equipped then
			local ab, value = PetUtil.Ability(pet)
			if ab then
				out[ab.Stat] = (out[ab.Stat] or 0) + value
			end
		end
	end
	for k, cap in pairs(Config.AbilityCaps) do
		out[k] = math.min(out[k] or 0, cap)
	end
	return out
end

function PetUtil.XPToNext(level: number): number
	return Config.XPForLevel(level)
end

function PetUtil.EnchantSlots(inst: PetInstance): number
	return Config.EnchantSlots[inst.Variant] or 1
end

function PetUtil.EnchantLabel(e: Enchant): string
	local cfg = Config.Enchants[e.Type]
	if not cfg then
		return e.Type
	end
	local value = cfg.PerTier * e.Tier
	local text
	if e.Type == "Agility" then
		text = "+" .. value .. " سرعة"
	else
		text = "+" .. math.floor(value * 100 + 0.5) .. "%"
	end
	return cfg.Icon .. " " .. cfg.Arabic .. " " .. string.rep("★", e.Tier) .. " " .. text
end

-- مجموع الإنشانتات للحيوانات المجهزة
function PetUtil.EnchantBonuses(pets: { PetInstance }): { [string]: number }
	local out = { Coins = 0, Damage = 0, Luck = 0, Diamonds = 0, Crit = 0, Agility = 0, XP = 0 }
	for _, pet in ipairs(pets) do
		if pet.Equipped and pet.Enchants then
			for _, e in ipairs(pet.Enchants) do
				local cfg = Config.Enchants[e.Type]
				if cfg then
					out[e.Type] = (out[e.Type] or 0) + cfg.PerTier * e.Tier
				end
			end
		end
	end
	out.Crit = math.min(out.Crit, 0.75)
	out.Agility = math.min(out.Agility, 30)
	return out
end

return PetUtil

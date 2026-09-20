--!strict
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)

local PetUtil = {}

export type PetInstance = {
	Uid: string,
	Id: string,
	Variant: string,
	Locked: boolean,
	Equipped: boolean,
	Time: number,
}

function PetUtil.BasePower(inst: PetInstance): number
	local def = Pets.Get(inst.Id)
	if not def then
		return 0
	end
	local mult = Config.VariantMultipliers[inst.Variant] or 1
	return def.Power * mult
end

function PetUtil.DisplayName(inst: PetInstance): string
	local def = Pets.Get(inst.Id)
	local prefix = Config.VariantNames[inst.Variant] or ""
	return prefix .. (def and def.Name or inst.Id)
end

function PetUtil.RarityColor(inst: PetInstance): Color3
	local def = Pets.Get(inst.Id)
	return def and Rarities.Color(def.Rarity) or Color3.new(1, 1, 1)
end

-- ترتيب حسب القوة ثم الندرة
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

return PetUtil

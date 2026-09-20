--!strict
-- حساب فرص البيض مع الحظ. مستخدم على السيرفر (للسحب) والعميل (للعرض).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local Eggs = require(Shared.Data.Eggs)

local Luck = {}

export type Entry = { Pet: string, Chance: number }

-- يرجع قائمة {Pet, Chance} بعد تطبيق الحظ، المجموع = 100
function Luck.ApplyLuck(eggId: string, luckMult: number): { Entry }
	local egg = Eggs.Get(eggId)
	if not egg then
		return {}
	end
	luckMult = math.max(1, luckMult)
	local weighted = {}
	local total = 0
	for _, entry in ipairs(egg.Pets) do
		local def = Pets.Get(entry.Pet)
		local w = entry.Chance
		if def and Rarities.Info[def.Rarity] and Rarities.Info[def.Rarity].LuckAffected then
			w = w * luckMult
		end
		table.insert(weighted, { Pet = entry.Pet, Chance = w })
		total += w
	end
	for _, e in ipairs(weighted) do
		e.Chance = e.Chance / total * 100
	end
	table.sort(weighted, function(a, b)
		return a.Chance > b.Chance
	end)
	return weighted
end

function Luck.Roll(eggId: string, luckMult: number, rng: Random?): string?
	local entries = Luck.ApplyLuck(eggId, luckMult)
	if #entries == 0 then
		return nil
	end
	local r = (rng and rng:NextNumber() or math.random()) * 100
	local acc = 0
	for _, e in ipairs(entries) do
		acc += e.Chance
		if r <= acc then
			return e.Pet
		end
	end
	return entries[#entries].Pet
end

return Luck

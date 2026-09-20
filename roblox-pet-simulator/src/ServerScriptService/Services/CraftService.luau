--!strict
-- محطة التصنيع: وصفات تحوّل حيوانات + عملات إلى حيوانات حصرية أو عناصر
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local Rewards = require(script.Parent.Rewards)
local Hooks = require(script.Parent.Hooks)
local RateLimit = require(script.Parent.RateLimit)

local CraftService = {}

-- يختار الحيوانات المطابقة لمدخل الوصفة (الأقل قوة أولاً، غير مقفولة)
local function pick(p: DataService.Profile, input: any, used: { [string]: boolean }): { any }?
	local candidates = {}
	for _, pet in ipairs(p.Pets) do
		if not pet.Locked and not used[pet.Uid] then
			local def = Pets.Get(pet.Id)
			local okPet = input.Pet == nil or pet.Id == input.Pet
			local okRarity = input.Rarity == nil or (def and def.Rarity == input.Rarity)
			local okVariant = (input.Variant or "Normal") == pet.Variant
			if okPet and okRarity and okVariant then
				table.insert(candidates, pet)
			end
		end
	end
	if #candidates < input.Count then
		return nil
	end
	table.sort(candidates, function(a, b)
		return (a.Level or 1) < (b.Level or 1)
	end)
	local out = {}
	for i = 1, input.Count do
		table.insert(out, candidates[i])
		used[candidates[i].Uid] = true
	end
	return out
end

function CraftService.Craft(player: Player, recipeId: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local recipe
	for _, r in ipairs(Config.Recipes) do
		if r.Id == recipeId then
			recipe = r
		end
	end
	if not recipe then
		return { ok = false, error = "وصفة غير موجودة" }
	end
	if p.Diamonds < (recipe.Diamonds or 0) then
		return { ok = false, error = "تحتاج 💎 " .. recipe.Diamonds }
	end
	if p.Gems < (recipe.Gems or 0) then
		return { ok = false, error = "تحتاج 💠 " .. recipe.Gems }
	end
	local used = {}
	local toRemove = {}
	for _, input in ipairs(recipe.Inputs) do
		local pets = pick(p, input, used)
		if not pets then
			return { ok = false, error = "ينقصك: " .. input.Count .. " × " .. (input.Pet or input.Rarity or "?") .. " (" .. (input.Variant or "Normal") .. ")" }
		end
		for _, pet in ipairs(pets) do
			table.insert(toRemove, pet.Uid)
		end
	end
	if recipe.Output.Pet and PetService.FreeSlots(player) <= 0 then
		return { ok = false, error = "المخزن ممتلئ" }
	end
	DataService.Spend(player, "Diamonds", recipe.Diamonds or 0)
	DataService.Spend(player, "Gems", recipe.Gems or 0)
	for _, uid in ipairs(toRemove) do
		PetService.Remove(p, uid)
	end
	Rewards.Grant(player, recipe.Output)
	p.Stats.Crafts += 1
	Hooks.Fire(player, "Craft", 1)
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	DataService.Notify(player, "🔨 صنعت: " .. Rewards.Describe(recipe.Output), Color3.fromRGB(255, 180, 80))
	return { ok = true }
end

function CraftService.Init()
	Remotes.Function("Craft").OnServerInvoke = function(player, recipeId)
		if not RateLimit.Check(player, "Craft", 3) then
			return { ok = false, error = "ببطء!" }
		end
		return CraftService.Craft(player, tostring(recipeId))
	end
end

return CraftService

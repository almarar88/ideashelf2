--!strict
-- فتح البيض: عادي/ذهبي/قوس قزح، 1/3/8، الحظ، الحذف التلقائي، إعلانات Huge
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Eggs = require(Shared.Data.Eggs)
local Pets = require(Shared.Data.Pets)
local Zones = require(Shared.Data.Zones)
local Rarities = require(Shared.Data.Rarities)
local Luck = require(Shared.Modules.Luck)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local Hooks = require(script.Parent.Hooks)

local EggService = {}

local lastHatch: { [Player]: number } = {}
local rng = Random.new()
local eggPositions: { [string]: Vector3 } = {}

function EggService.RegisterEggPosition(eggId: string, pos: Vector3)
	eggPositions[eggId] = pos
end

function EggService.Hatch(player: Player, eggId: string, count: number, variant: string?): { ok: boolean, error: string?, pets: any? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local egg = Eggs.Get(eggId)
	if not egg then
		return { ok = false, error = "بيضة غير موجودة" }
	end
	variant = variant or "Normal"
	local variantCost = Config.EggVariantCost[variant]
	if not variantCost then
		return { ok = false, error = "نوع بيضة غير معروف" }
	end
	if variant ~= "Normal" and egg.Currency ~= "Coins" then
		return { ok = false, error = "هذه البيضة لا تملك نسخة " .. variant }
	end
	count = math.floor(tonumber(count) or 1)
	if count ~= 1 and count ~= 3 and count ~= 8 then
		count = 1
	end
	if count >= 3 and not DataService.HasGamepass(player, "TripleHatch") then
		return { ok = false, error = "تحتاج جيم باس Triple Hatch" }
	end
	if count == 8 and not DataService.HasGamepass(player, "OctupleHatch") then
		return { ok = false, error = "تحتاج جيم باس Octuple Hatch" }
	end
	if egg.VIPOnly and not DataService.HasGamepass(player, "VIP") then
		return { ok = false, error = "هذه البيضة لأعضاء VIP فقط" }
	end
	if egg.Zone > 0 and not p.UnlockedZones[tostring(egg.Zone)] then
		return { ok = false, error = "افتح المنطقة أولاً" }
	end
	local required = Zones.RebirthRequired(egg.Zone)
	if required > 0 and p.Rebirths < required then
		return { ok = false, error = "هذا العالم يتطلب " .. required .. " ريبيرث" }
	end

	local pos = eggPositions[eggId]
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if pos and hrp and (hrp.Position - pos).Magnitude > 40 then
		return { ok = false, error = "اقترب من البيضة" }
	end

	local now = os.clock()
	if now - (lastHatch[player] or 0) < Config.HatchCooldown then
		return { ok = false, error = "انتظر قليلاً" }
	end

	local autoDelete = p.Settings.AutoDeleteRank or 0
	if PetService.FreeSlots(player) < count and autoDelete == 0 then
		return { ok = false, error = "المخزن ممتلئ! احذف أو ادمج حيوانات" }
	end

	local total = egg.Cost * count * variantCost
	if not DataService.Spend(player, egg.Currency, total) then
		local name = egg.Currency == "Coins" and "العملات" or (egg.Currency == "Diamonds" and "الألماس" or (egg.Currency == "Gems" and "الجواهر" or "توكنات الريبيرث"))
		return { ok = false, error = "لا تملك ما يكفي من " .. name }
	end
	lastHatch[player] = now

	local luck = DataService.LuckMultiplier(player)
	local results = {}
	for _ = 1, count do
		local petId = Luck.Roll(eggId, luck, rng) or egg.Pets[1].Pet
		local def = Pets.Get(petId)
		local rank = def and Rarities.Rank(def.Rarity) or 1
		local deleted = autoDelete > 0 and rank <= autoDelete and variant == "Normal"
		if not deleted and PetService.FreeSlots(player) <= 0 then
			deleted = true
		end
		local inst = nil
		if not deleted then
			inst = PetService.Add(player, petId, variant, true)
		else
			p.Index[petId] = true
		end
		table.insert(results, { Uid = inst and inst.Uid or "", Id = petId, Variant = variant, Deleted = deleted })
		if def and rank >= 5 then
			Remotes.Event("HatchBroadcast"):FireAllClients({ Player = player.Name, PetId = petId, Variant = variant, Rarity = def.Rarity })
			if rank >= 9 then
				DataService.NotifyAll("🌟🌟🌟 " .. player.Name .. " حصل على " .. def.Name .. "!!! 🌟🌟🌟", Color3.new(1, 1, 1))
				Remotes.Event("EventEffect"):FireAllClients({ Type = "Titanic", Player = player.Name, PetId = petId })
			elseif rank >= 8 then
				DataService.NotifyAll("🎉 " .. player.Name .. " حصل على " .. def.Name .. "!!! 🎉", Color3.fromRGB(255, 0, 80))
				Remotes.Event("EventEffect"):FireAllClients({ Type = "Huge", Player = player.Name, PetId = petId })
			end
			Remotes.Event("EventEffect"):FireClient(player, { Type = "HatchRare", Rarity = def.Rarity, EggId = eggId })
		end
	end
	p.Stats.Hatches += count
	Hooks.Fire(player, "Hatch", count)
	DataService.MarkDirty(player)
	return { ok = true, pets = results }
end

function EggService.Init()
	Remotes.Function("HatchEgg").OnServerInvoke = function(player, eggId, count, variant)
		return EggService.Hatch(player, tostring(eggId), tonumber(count) or 1, type(variant) == "string" and variant or "Normal")
	end
	Players.PlayerRemoving:Connect(function(player)
		lastHatch[player] = nil
	end)
end

return EggService

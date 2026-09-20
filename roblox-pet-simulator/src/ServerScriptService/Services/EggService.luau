--!strict
-- فتح البيض مع الحظ والتحقق من كل الشروط
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Eggs = require(Shared.Data.Eggs)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local Luck = require(Shared.Modules.Luck)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)

local EggService = {}

local lastHatch: { [Player]: number } = {}
local rng = Random.new()
local eggPositions: { [string]: Vector3 } = {}

function EggService.RegisterEggPosition(eggId: string, pos: Vector3)
	eggPositions[eggId] = pos
end

function EggService.Hatch(player: Player, eggId: string, count: number): { ok: boolean, error: string?, pets: any? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local egg = Eggs.Get(eggId)
	if not egg then
		return { ok = false, error = "بيضة غير موجودة" }
	end
	count = math.clamp(math.floor(tonumber(count) or 1), 1, 3)
	if count == 3 and not DataService.HasGamepass(player, "TripleHatch") then
		return { ok = false, error = "تحتاج جيم باس Triple Hatch" }
	end
	if count == 2 then
		count = 1
	end
	if egg.VIPOnly and not DataService.HasGamepass(player, "VIP") then
		return { ok = false, error = "هذه البيضة لأعضاء VIP فقط" }
	end
	if egg.Zone > 0 and not p.UnlockedZones[tostring(egg.Zone)] then
		return { ok = false, error = "افتح المنطقة أولاً" }
	end

	-- المسافة
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

	if PetService.FreeSlots(player) < count then
		return { ok = false, error = "المخزن ممتلئ! احذف أو ادمج حيوانات" }
	end

	local total = egg.Cost * count
	if not DataService.Spend(player, egg.Currency, total) then
		return { ok = false, error = "لا تملك ما يكفي من " .. (egg.Currency == "Coins" and "العملات" or "الألماس") }
	end
	lastHatch[player] = now

	local luck = DataService.LuckMultiplier(player)
	local results = {}
	for _ = 1, count do
		local petId = Luck.Roll(eggId, luck, rng) or egg.Pets[1].Pet
		local inst = PetService.Add(player, petId, "Normal", true)
		if inst then
			table.insert(results, { Uid = inst.Uid, Id = inst.Id, Variant = inst.Variant })
			local def = Pets.Get(petId)
			if def and Rarities.Rank(def.Rarity) >= 5 then
				Remotes.Event("HatchBroadcast"):FireAllClients({ Player = player.Name, PetId = petId, Variant = "Normal", Rarity = def.Rarity })
			end
		end
	end
	p.Stats.Hatches += count
	DataService.MarkDirty(player)
	return { ok = true, pets = results }
end

function EggService.Init()
	Remotes.Function("HatchEgg").OnServerInvoke = function(player, eggId, count)
		return EggService.Hatch(player, tostring(eggId), tonumber(count) or 1)
	end
	Players.PlayerRemoving:Connect(function(player)
		lastHatch[player] = nil
	end)
end

return EggService

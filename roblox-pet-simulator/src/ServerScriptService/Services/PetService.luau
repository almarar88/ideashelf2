--!strict
-- المخزن، التجهيز، الحذف، القفل، والآلات (Golden / Rainbow / Dark Matter / Fuse)
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Eggs = require(Shared.Data.Eggs)
local PetUtil = require(Shared.Modules.PetUtil)
local Luck = require(Shared.Modules.Luck)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)

local PetService = {}

type PetInstance = PetUtil.PetInstance

local rng = Random.new()

function PetService.StorageCapacity(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	local cap = Config.BaseStorage + (p.Upgrades.Storage or 0) * 25
	if DataService.HasGamepass(player, "PlusStorage") then
		cap += Config.GamepassStorageBonus
	end
	return cap
end

function PetService.EquipCapacity(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	local cap = Config.BaseEquip + (p.Upgrades.Equip or 0)
	if DataService.HasGamepass(player, "PlusEquip") then
		cap += Config.GamepassEquipBonus
	end
	return cap
end

function PetService.FreeSlots(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	return PetService.StorageCapacity(player) - #p.Pets
end

local function find(p: DataService.Profile, uid: string): (PetInstance?, number?)
	for i, pet in ipairs(p.Pets) do
		if pet.Uid == uid then
			return pet, i
		end
	end
	return nil, nil
end

local function equippedCount(p: DataService.Profile): number
	local n = 0
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped then
			n += 1
		end
	end
	return n
end

function PetService.UpdateEquippedAttribute(player: Player)
	local p = DataService.Get(player)
	if not p then
		return
	end
	local list = {}
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped then
			table.insert(list, { Uid = pet.Uid, Id = pet.Id, Variant = pet.Variant })
		end
	end
	player:SetAttribute("EquippedPets", HttpService:JSONEncode(list))
	player:SetAttribute("TotalPower", PetService.GetPower(player))
end

function PetService.GetPower(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	local total = 0
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped then
			total += PetUtil.BasePower(pet)
		end
	end
	local mult = 1 + (p.Upgrades.Damage or 0) * 0.05
	return total * mult
end

function PetService.Add(player: Player, petId: string, variant: string?, ignoreCapacity: boolean?): PetInstance?
	local p = DataService.Get(player)
	local def = Pets.Get(petId)
	if not p or not def then
		return nil
	end
	if not ignoreCapacity and #p.Pets >= PetService.StorageCapacity(player) then
		return nil
	end
	local inst: PetInstance = {
		Uid = HttpService:GenerateGUID(false),
		Id = petId,
		Variant = variant or "Normal",
		Locked = false,
		Equipped = false,
		Time = os.time(),
	}
	table.insert(p.Pets, inst)
	p.Index[petId] = true
	local power = PetUtil.BasePower(inst)
	if power > (p.Stats.BestPet or 0) then
		p.Stats.BestPet = power
	end
	-- تجهيز تلقائي إذا فيه مكان
	if equippedCount(p) < PetService.EquipCapacity(player) then
		inst.Equipped = true
	end
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	return inst
end

local function remove(p: DataService.Profile, uid: string): PetInstance?
	local pet, idx = find(p, uid)
	if pet and idx then
		table.remove(p.Pets, idx)
	end
	return pet
end

-- إجراءات المخزن
function PetService.Action(player: Player, action: string, payload: any): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	payload = type(payload) == "table" and payload or {}

	if action == "Equip" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		if pet.Equipped then
			return { ok = true }
		end
		if equippedCount(p) >= PetService.EquipCapacity(player) then
			return { ok = false, error = "وصلت للحد الأقصى من التجهيز" }
		end
		pet.Equipped = true
	elseif action == "Unequip" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		pet.Equipped = false
	elseif action == "Lock" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		pet.Locked = not pet.Locked
	elseif action == "Delete" then
		local uids = payload.Uids or { payload.Uid }
		local n = 0
		for _, uid in ipairs(uids) do
			local pet = find(p, tostring(uid))
			if pet and not pet.Locked then
				remove(p, pet.Uid)
				n += 1
			end
		end
		if n == 0 then
			return { ok = false, error = "لا يمكن حذف حيوان مقفول" }
		end
	elseif action == "UnequipAll" then
		for _, pet in ipairs(p.Pets) do
			pet.Equipped = false
		end
	elseif action == "EquipBest" then
		local sorted = table.clone(p.Pets)
		PetUtil.SortByPower(sorted)
		local cap = PetService.EquipCapacity(player)
		for _, pet in ipairs(p.Pets) do
			pet.Equipped = false
		end
		for i = 1, math.min(cap, #sorted) do
			sorted[i].Equipped = true
		end
	elseif action == "Setting" then
		local key = tostring(payload.Key)
		if p.Settings[key] == nil then
			return { ok = false, error = "إعداد غير معروف" }
		end
		p.Settings[key] = payload.Value == true
	else
		return { ok = false, error = "إجراء غير معروف" }
	end

	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	return { ok = true }
end

-- الآلات
local function collect(p: DataService.Profile, uids: any): { PetInstance }?
	if type(uids) ~= "table" then
		return nil
	end
	local out = {}
	local seen = {}
	for _, uid in ipairs(uids) do
		uid = tostring(uid)
		if seen[uid] then
			return nil
		end
		seen[uid] = true
		local pet = find(p, uid)
		if not pet or pet.Locked then
			return nil
		end
		table.insert(out, pet)
	end
	return out
end

function PetService.Machine(player: Player, kind: string, payload: any): { ok: boolean, error: string?, result: any? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	payload = type(payload) == "table" and payload or {}

	if kind == "Golden" or kind == "Rainbow" then
		local need = Config.Machines[kind].Requires
		local fromVariant = kind == "Golden" and "Normal" or "Golden"
		local toVariant = kind == "Golden" and "Golden" or "Rainbow"
		local pets = collect(p, payload.Uids)
		if not pets or #pets ~= need then
			return { ok = false, error = "اختر " .. need .. " حيوانات (غير مقفولة)" }
		end
		local id = pets[1].Id
		for _, pet in ipairs(pets) do
			if pet.Id ~= id or pet.Variant ~= fromVariant then
				return { ok = false, error = "يجب أن تكون نفس الحيوان ونفس النوع" }
			end
		end
		for _, pet in ipairs(pets) do
			remove(p, pet.Uid)
		end
		local result = PetService.Add(player, id, toVariant, true)
		DataService.MarkDirty(player)
		return { ok = true, result = result }
	elseif kind == "DarkMatterStart" then
		local pets = collect(p, { payload.Uid })
		if not pets or #pets ~= 1 or pets[1].Variant ~= "Rainbow" then
			return { ok = false, error = "اختر حيوان Rainbow واحد" }
		end
		local cost = Config.Machines.DarkMatter.CostDiamonds
		if not DataService.Spend(player, "Diamonds", cost) then
			return { ok = false, error = "تحتاج " .. cost .. " ألماسة" }
		end
		local pet = remove(p, pets[1].Uid)
		table.insert(p.DarkMatter, { PetId = (pet :: PetInstance).Id, Ready = os.time() + Config.Machines.DarkMatter.Time })
		DataService.MarkDirty(player)
		PetService.UpdateEquippedAttribute(player)
		return { ok = true }
	elseif kind == "DarkMatterClaim" then
		local idx = tonumber(payload.Index)
		local entry = idx and p.DarkMatter[idx]
		if not entry then
			return { ok = false, error = "غير موجود" }
		end
		if os.time() < entry.Ready then
			return { ok = false, error = "لم يجهز بعد" }
		end
		if PetService.FreeSlots(player) <= 0 then
			return { ok = false, error = "المخزن ممتلئ" }
		end
		table.remove(p.DarkMatter, idx :: number)
		local result = PetService.Add(player, entry.PetId, "DarkMatter")
		return { ok = true, result = result }
	elseif kind == "Fuse" then
		local cfg = Config.Machines.Fuse
		local pets = collect(p, payload.Uids)
		if not pets or #pets < cfg.Min or #pets > cfg.Max then
			return { ok = false, error = "اختر من " .. cfg.Min .. " إلى " .. cfg.Max .. " حيوانات" }
		end
		local bestTier = 1
		local variant = pets[1].Variant
		local sameVariant = true
		for _, pet in ipairs(pets) do
			local def = Pets.Get(pet.Id)
			if def and def.Tier > bestTier then
				bestTier = def.Tier
			end
			if pet.Variant ~= variant then
				sameVariant = false
			end
		end
		local upgradeChance = math.min(0.6, cfg.UpgradeChance * (#pets - 2))
		local targetTier = bestTier
		if rng:NextNumber() < upgradeChance then
			targetTier = math.min(10, bestTier + 1)
		end
		local function eggForTier(tier: number)
			for _, e in ipairs(Eggs.List) do
				if e.Zone == tier and e.Currency == "Coins" and not e.VIPOnly then
					return e
				end
			end
			return nil
		end
		local egg = eggForTier(targetTier) or eggForTier(bestTier) or Eggs.Get("StarterEgg")
		for _, pet in ipairs(pets) do
			remove(p, pet.Uid)
		end
		local petId = Luck.Roll((egg :: any).Id, 1.5, rng) or "cat"
		local result = PetService.Add(player, petId, sameVariant and variant or "Normal", true)
		DataService.MarkDirty(player)
		return { ok = true, result = result }
	end
	return { ok = false, error = "آلة غير معروفة" }
end

function PetService.Init()
	Remotes.Function("PetAction").OnServerInvoke = function(player, action, payload)
		return PetService.Action(player, tostring(action), payload)
	end
	Remotes.Function("Machine").OnServerInvoke = function(player, kind, payload)
		return PetService.Machine(player, tostring(kind), payload)
	end
	DataService.Loaded:Connect(function(player)
		PetService.UpdateEquippedAttribute(player)
	end)
	table.insert(DataService.Extenders, function(player, payload)
		payload.StorageCap = PetService.StorageCapacity(player)
		payload.EquipCap = PetService.EquipCapacity(player)
		payload.Power = PetService.GetPower(player)
	end)
end

return PetService

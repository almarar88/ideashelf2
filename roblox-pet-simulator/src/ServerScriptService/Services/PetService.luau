--!strict
-- المخزن، التجهيز، الحذف، القفل، المستويات/الخبرة، الإنشانتات، والآلات
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
local RateLimit = require(script.Parent.RateLimit)
local Hooks = require(script.Parent.Hooks)
local Format = require(Shared.Modules.Format)
local TextService = game:GetService("TextService")

local PetService = {}

type PetInstance = PetUtil.PetInstance

local rng = Random.new()
local fire = Hooks.Fire

function PetService.StorageCapacity(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	local cap = Config.BaseStorage + (p.Upgrades.Storage or 0) * 25 + (p.RebirthUpgrades.RStorage or 0) * 50
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
	local cap = Config.BaseEquip + (p.Upgrades.Equip or 0) + (p.RebirthUpgrades.REquip or 0)
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
PetService.Find = find

local function equippedCount(p: DataService.Profile): number
	local n = 0
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped then
			n += 1
		end
	end
	return n
end

function PetService.Equipped(player: Player): { PetInstance }
	local p = DataService.Get(player)
	local out = {}
	if p then
		for _, pet in ipairs(p.Pets) do
			if pet.Equipped then
				table.insert(out, pet)
			end
		end
	end
	return out
end

function PetService.UpdateEquippedAttribute(player: Player)
	local p = DataService.Get(player)
	if not p then
		return
	end
	local list = {}
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped then
			table.insert(list, { Uid = pet.Uid, Id = pet.Id, Variant = pet.Variant, Shiny = pet.Shiny == true, Accessory = pet.Accessory or "" })
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
	return total * DataService.DamageMultiplier(player)
end

function PetService.Add(player: Player, petId: string, variant: string?, ignoreCapacity: boolean?, shiny: boolean?): PetInstance?
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
		Level = 1,
		XP = 0,
		Enchants = {},
		Shiny = shiny == true or nil,
	}
	if shiny then
		p.Stats.Shinies += 1
	end
	table.insert(p.Pets, inst)
	p.Index[petId] = true
	if def.Rarity == "Huge" then
		p.Stats.Huges += 1
	elseif def.Rarity == "Titanic" then
		p.Stats.Titanics += 1
	end
	local power = PetUtil.BasePower(inst)
	if power > (p.Stats.BestPet or 0) then
		p.Stats.BestPet = power
	end
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
PetService.Remove = remove

-- ===== الخبرة =====
function PetService.GrantXP(player: Player, amount: number)
	local p = DataService.Get(player)
	if not p or amount <= 0 then
		return
	end
	amount = amount * DataService.XPMultiplier(player)
	local changed = false
	for _, pet in ipairs(p.Pets) do
		if pet.Equipped and (pet.Level or 1) < Config.PetMaxLevel then
			pet.XP = (pet.XP or 0) + amount
			local needed = PetUtil.XPToNext(pet.Level or 1)
			while pet.XP >= needed and pet.Level < Config.PetMaxLevel do
				pet.XP -= needed
				pet.Level += 1
				changed = true
				needed = PetUtil.XPToNext(pet.Level)
			end
			if pet.Level >= Config.PetMaxLevel then
				pet.XP = 0
			end
		end
	end
	DataService.MarkDirty(player)
	if changed then
		PetService.UpdateEquippedAttribute(player)
	end
end

-- ===== إجراءات المخزن =====
function PetService.Action(player: Player, action: string, payload: any): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not RateLimit.Check(player, "PetAction", 20) then
		return { ok = false, error = "ببطء!" }
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
	elseif action == "Nick" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		local raw = tostring(payload.Nick or ""):sub(1, 20)
		if raw == "" then
			pet.Nick = nil
		else
			local ok, filtered = pcall(function()
				local result = TextService:FilterStringAsync(raw, player.UserId)
				return result:GetNonChatStringForBroadcastAsync()
			end)
			pet.Nick = ok and filtered or nil
		end
	elseif action == "Accessory" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		local id = tostring(payload.Id or "")
		-- إعادة الإكسسوار الحالي للحقيبة
		if pet.Accessory and pet.Accessory ~= "" then
			p.Accessories[pet.Accessory] = (p.Accessories[pet.Accessory] or 0) + 1
			pet.Accessory = nil
		end
		if id ~= "" then
			if (p.Accessories[id] or 0) <= 0 then
				return { ok = false, error = "لا تملك هذا الإكسسوار" }
			end
			p.Accessories[id] -= 1
			pet.Accessory = id
		end
	elseif action == "ClaimIndex" then
		local eggId = tostring(payload.EggId)
		local egg = Eggs.Get(eggId)
		if not egg then
			return { ok = false, error = "بيضة غير موجودة" }
		end
		if p.IndexClaimed[eggId] then
			return { ok = false, error = "تم الاستلام" }
		end
		for _, entry in ipairs(egg.Pets) do
			if not p.Index[entry.Pet] then
				return { ok = false, error = "أكمل فهرس البيضة أولاً" }
			end
		end
		p.IndexClaimed[eggId] = true
		local tier = math.max(1, egg.Zone)
		local reward = Config.IndexReward(tier)
		DataService.AddDiamonds(player, reward.Diamonds or 0)
		DataService.AddGems(player, reward.Gems or 0, true)
		DataService.Notify(player, "📖 أكملت فهرس " .. egg.Name .. "! 💎 " .. Format.Number(reward.Diamonds or 0) .. "  💠 " .. Format.Number(reward.Gems or 0), Color3.fromRGB(200, 140, 255))
	elseif action == "Setting" then
		local k = tostring(payload.Key)
		if p.Settings[k] == nil then
			return { ok = false, error = "إعداد غير معروف" }
		end
		if k == "AutoDeleteRank" then
			p.Settings[k] = math.clamp(math.floor(tonumber(payload.Value) or 0), 0, 4)
		else
			p.Settings[k] = payload.Value == true
		end
	else
		return { ok = false, error = "إجراء غير معروف" }
	end

	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	return { ok = true }
end

-- ===== الآلات =====
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

local function rollEnchant(): PetUtil.Enchant
	local totalW = 0
	for _, cfg in pairs(Config.Enchants) do
		totalW += cfg.Weight
	end
	local r = rng:NextNumber() * totalW
	local chosen = "Coins"
	for k, cfg in pairs(Config.Enchants) do
		r -= cfg.Weight
		if r <= 0 then
			chosen = k
			break
		end
	end
	local tw = 0
	for _, w in ipairs(Config.EnchantTierWeights) do
		tw += w
	end
	local r2 = rng:NextNumber() * tw
	local tier = 1
	for i, w in ipairs(Config.EnchantTierWeights) do
		r2 -= w
		if r2 <= 0 then
			tier = i
			break
		end
	end
	return { Type = chosen, Tier = tier }
end

function PetService.Machine(player: Player, kind: string, payload: any): { ok: boolean, error: string?, result: any? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not RateLimit.Check(player, "Machine", 10) then
		return { ok = false, error = "ببطء!" }
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
		local bestLevel = 1
		for _, pet in ipairs(pets) do
			if pet.Id ~= id or pet.Variant ~= fromVariant then
				return { ok = false, error = "يجب أن تكون نفس الحيوان ونفس النوع" }
			end
			bestLevel = math.max(bestLevel, pet.Level or 1)
		end
		for _, pet in ipairs(pets) do
			remove(p, pet.Uid)
		end
		local result = PetService.Add(player, id, toVariant, true) :: PetInstance
		result.Level = bestLevel
		if kind == "Golden" then
			p.Stats.Goldens += 1
			fire(player, "Golden", 1)
		else
			p.Stats.Rainbows += 1
		end
		DataService.MarkDirty(player)
		PetService.UpdateEquippedAttribute(player)
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
		local pet = remove(p, pets[1].Uid) :: PetInstance
		table.insert(p.DarkMatter, { PetId = pet.Id, Level = pet.Level or 1, Ready = os.time() + Config.Machines.DarkMatter.Time })
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
		local result = PetService.Add(player, entry.PetId, "DarkMatter") :: PetInstance
		result.Level = entry.Level or 1
		p.Stats.DarkMatters += 1
		DataService.MarkDirty(player)
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
			if def and def.Tier > bestTier and def.Tier <= 20 then
				bestTier = def.Tier
			end
			if pet.Variant ~= variant then
				sameVariant = false
			end
		end
		local upgradeChance = math.min(0.6, cfg.UpgradeChance * (#pets - 2))
		local targetTier = bestTier
		if rng:NextNumber() < upgradeChance then
			targetTier = math.min(20, bestTier + 1)
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
		p.Stats.Fusions += 1
		fire(player, "Fuse", 1)
		DataService.MarkDirty(player)
		return { ok = true, result = result }
	elseif kind == "Enchant" then
		local pet = find(p, tostring(payload.Uid))
		if not pet then
			return { ok = false, error = "الحيوان غير موجود" }
		end
		local slot = math.floor(tonumber(payload.Slot) or 1)
		pet.Enchants = pet.Enchants or {}
		if slot < 1 or slot > PetUtil.EnchantSlots(pet) then
			return { ok = false, error = "خانة غير متاحة لهذا النوع" }
		end
		if slot > #pet.Enchants + 1 then
			return { ok = false, error = "املأ الخانة السابقة أولاً" }
		end
		local def = Pets.Get(pet.Id) :: Pets.PetDef
		local cost = Config.EnchantCostPerTier * math.min(def.Tier, 20)
		if not DataService.Spend(player, "Diamonds", cost) then
			return { ok = false, error = "تحتاج 💎 " .. cost }
		end
		pet.Enchants = pet.Enchants or {}
		pet.Enchants[slot] = rollEnchant()
		p.Stats.Enchants += 1
		fire(player, "Enchant", 1)
		DataService.MarkDirty(player)
		PetService.UpdateEquippedAttribute(player)
		return { ok = true, result = pet.Enchants[slot] }
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
		payload.Enchants = PetUtil.EnchantBonuses(payload.Pets)
	end)
	table.insert(DataService.BonusProviders, function(player)
		local p = DataService.Get(player)
		if not p then
			return nil
		end
		return PetUtil.EnchantBonuses(p.Pets)
	end)
end

return PetService

--!strict
-- الأحداث العالمية الدورية: Coin Rush، Lucky Time، Diamond Rain، XP Fever، غارة الزعيم
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local BreakableService = require(script.Parent.BreakableService)
local Hooks = require(script.Parent.Hooks)

local EventService = {}

local active: any = nil
local activeBoss: any = nil
local activeEnds = 0
local lastId = ""
local rng = Random.new()

local function state(): Folder
	return Remotes.State()
end

local function findEvent(id: string): any?
	for _, e in ipairs(Config.Events.List) do
		if e.Id == id then
			return e
		end
	end
	return nil
end

function EventService.Active(): any?
	if active and os.time() < activeEnds then
		return active
	end
	return nil
end

local function endEvent()
	if active and active.Boss and BreakableService.BossAlive() then
		BreakableService.RemoveBoss()
		DataService.NotifyAll("👹 هرب الزعيم! حاولوا في المرة القادمة", Color3.fromRGB(255, 120, 120))
	end
	active = nil
	local s = state()
	s:SetAttribute("EventId", "")
	s:SetAttribute("EventEnds", 0)
end

function EventService.Start(id: string): boolean
	local e = findEvent(id)
	if not e then
		return false
	end
	if active then
		endEvent()
	end
	active = e
	activeEnds = os.time() + (e.Boss and Config.Events.Boss.Duration or Config.Events.Duration)
	lastId = id
	local s = state()
	s:SetAttribute("EventId", id)
	s:SetAttribute("EventEnds", activeEnds)
	DataService.NotifyAll("🎉 حدث: " .. e.Name .. " — " .. e.Arabic, Color3.fromRGB(255, 220, 90))
	Remotes.Event("EventEffect"):FireAllClients({ Type = "EventStart", Id = id })
	if e.Boss then
		-- اختيار زعيم يمكن لأحد اللاعبين الوصول لمنطقته
		local candidates = {}
		for _, bd in ipairs(Config.Bosses) do
			for _, pl in ipairs(Players:GetPlayers()) do
				local p = DataService.Get(pl)
				if p and (bd.Zone == 1 or p.UnlockedZones[tostring(bd.Zone)]) then
					table.insert(candidates, bd)
					break
				end
			end
		end
		activeBoss = candidates[rng:NextInteger(1, math.max(1, #candidates))] or Config.Bosses[1]
		local totalPower = 0
		for _, pl in ipairs(Players:GetPlayers()) do
			totalPower += PetService.GetPower(pl)
		end
		local health = math.max(5000, math.floor(totalPower * (activeBoss.HealthPerPower or 45)))
		BreakableService.SpawnBoss(health, activeBoss)
		DataService.NotifyAll("👹 " .. activeBoss.Name .. " (" .. activeBoss.Arabic .. ") ظهر في " .. (require(Shared.Data.Zones).Get(activeBoss.Zone) or { Name = "?" }).Name .. "!", Color3.fromRGB(255, 90, 90))
	end
	task.delay(activeEnds - os.time(), function()
		if active == e and os.time() >= activeEnds then
			endEvent()
		end
	end)
	return true
end

local function onBossKilled(contributors: { [Player]: number })
	local bossCfg = table.clone(Config.Events.Boss)
	if activeBoss then
		bossCfg.Name = activeBoss.Name
		bossCfg.Pet = activeBoss.Pet
	end
	DataService.NotifyAll("🏆 تم هزيمة " .. bossCfg.Name .. "! المكافآت وُزعت على المشاركين", Color3.fromRGB(120, 255, 140))
	for player in pairs(contributors) do
		local p = DataService.Get(player)
		if p and player.Parent == Players then
			p.Stats.BossKills += 1
			Hooks.Fire(player, "Boss", 1)
			if rng:NextNumber() < Config.TitanicBossChance then
				local tid = Config.TitanicPets[rng:NextInteger(1, #Config.TitanicPets)]
				PetService.Add(player, tid, "Normal", true)
				DataService.NotifyAll("🌟🌟 " .. player.Name .. " حصل على " .. tid .. " من الزعيم!!! 🌟🌟", Color3.new(1, 1, 1))
				Remotes.Event("EventEffect"):FireAllClients({ Type = "Titanic", Player = player.Name, PetId = tid })
			elseif rng:NextNumber() < bossCfg.PetChance then
				local inst = PetService.Add(player, bossCfg.Pet, "Normal", true)
				if inst then
					DataService.Notify(player, "👑 حصلت على " .. bossCfg.Name .. " من الزعيم!", Color3.fromRGB(255, 200, 40))
					Remotes.Event("HatchBroadcast"):FireAllClients({ Player = player.Name, PetId = bossCfg.Pet, Variant = "Normal", Rarity = "Mythical" })
				end
			end
			DataService.MarkDirty(player)
		end
	end
	if active and active.Boss then
		endEvent()
	end
end

function EventService.Init()
	BreakableService.OnBossKilled = onBossKilled
	table.insert(DataService.BonusProviders, function()
		local e = EventService.Active()
		if not e then
			return nil
		end
		return { EventCoins = e.Coins or 1, EventLuck = e.Luck or 1, EventDiamonds = e.Diamonds or 1, EventXP = e.XP or 1 }
	end)
	task.spawn(function()
		local s = state()
		while true do
			local nextAt = os.time() + Config.Events.Interval
			s:SetAttribute("NextEvent", nextAt)
			while os.time() < nextAt do
				task.wait(1)
			end
			if #Players:GetPlayers() > 0 and not active then
				local candidates = {}
				for _, e in ipairs(Config.Events.List) do
					if e.Id ~= lastId then
						table.insert(candidates, e)
					end
				end
				local pick = candidates[rng:NextInteger(1, #candidates)]
				EventService.Start(pick.Id)
			end
		end
	end)
end

return EventService

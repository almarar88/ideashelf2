--!strict
-- كنز عشوائي يظهر في منطقة عشوائية كل فترة
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local BreakableService = require(script.Parent.BreakableService)
local MapBuilder = require(script.Parent.MapBuilder)
local Rewards = require(script.Parent.Rewards)

local TreasureService = {}
local rng = Random.new()

local function spawnTreasure()
	-- منطقة يستطيع أحد اللاعبين الوصول لها
	local candidates = {}
	for _, pl in ipairs(Players:GetPlayers()) do
		local p = DataService.Get(pl)
		if p then
			for k in pairs(p.UnlockedZones) do
				local idx = tonumber(k)
				if idx and idx <= 10 and not table.find(candidates, idx) then
					table.insert(candidates, idx)
				end
			end
		end
	end
	if #candidates == 0 then
		return
	end
	local zoneIdx = candidates[rng:NextInteger(1, #candidates)]
	local layout = MapBuilder.Zones[zoneIdx]
	local zone = Zones.Get(zoneIdx)
	if not layout or not zone then
		return
	end
	local spot = layout.Spots[rng:NextInteger(1, #layout.Spots)] + Vector3.new(0, 0, 6)
	local id = BreakableService.SpawnDynamic("Treasure", zoneIdx, spot, {
		Health = math.floor(3000 * zone.Multiplier),
		Lifetime = Config.Treasure.Lifetime,
		Name = "💰 كنز!",
		OnBroken = function(contributors)
			for pl in pairs(contributors) do
				local p = DataService.Get(pl)
				if pl.Parent == Players and p then
					Rewards.Grant(pl, { Diamonds = Config.Treasure.Diamonds, Gems = Config.Treasure.Gems })
					p.Stats.Treasures += 1
					if rng:NextNumber() < Config.Treasure.PetChance then
						PetService.Add(pl, Config.Treasure.Pet, "Normal", true)
						DataService.Notify(pl, "🐢 حصلت على Treasure Turtle!", Color3.fromRGB(255, 215, 0))
					end
					DataService.MarkDirty(pl)
				end
			end
			DataService.NotifyAll("💰 تم فتح الكنز في " .. zone.Name .. "!", Color3.fromRGB(255, 215, 0))
		end,
	})
	if id then
		DataService.NotifyAll("🗺️ ظهر صندوق كنز في " .. zone.Name .. " (" .. zone.Arabic .. ")! لديك " .. Config.Treasure.Lifetime .. " ثانية", Color3.fromRGB(255, 215, 0))
		Remotes.Event("EventEffect"):FireAllClients({ Type = "Treasure", Zone = zoneIdx })
	end
end

function TreasureService.Init()
	task.spawn(function()
		while true do
			task.wait(Config.Treasure.Interval)
			if #Players:GetPlayers() > 0 then
				spawnTreasure()
			end
		end
	end)
end

return TreasureService

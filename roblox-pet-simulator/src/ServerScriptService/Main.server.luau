--!strict
-- نقطة تشغيل السيرفر
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared.Remotes)

local Services = script.Parent:WaitForChild("Services")

Remotes.Init()

local MapBuilder = require(Services.MapBuilder)
local DataService = require(Services.DataService)
local PetService = require(Services.PetService)
local EggService = require(Services.EggService)
local BreakableService = require(Services.BreakableService)
local ZoneService = require(Services.ZoneService)
local ShopService = require(Services.ShopService)
local RewardService = require(Services.RewardService)
local LeaderboardService = require(Services.LeaderboardService)

MapBuilder.Build()

for _, layout in pairs(MapBuilder.Zones) do
	for eggId, pos in pairs(layout.Eggs) do
		EggService.RegisterEggPosition(eggId, pos)
	end
end

DataService.Init()
PetService.Init()
EggService.Init()
BreakableService.Init()
ZoneService.Init()
ShopService.Init()
RewardService.Init()
LeaderboardService.Init()

print("[PetKingdom] Server ready")

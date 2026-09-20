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
local EventService = require(Services.EventService)
local MissionService = require(Services.MissionService)
local RebirthService = require(Services.RebirthService)
local TradeService = require(Services.TradeService)
local SpinService = require(Services.SpinService)
local MerchantService = require(Services.MerchantService)
local HoverboardService = require(Services.HoverboardService)
local AdminService = require(Services.AdminService)
local MarketService = require(Services.MarketService)

MapBuilder.Build()

for _, layout in pairs(MapBuilder.Zones) do
	for eggId, pos in pairs(layout.Eggs) do
		EggService.RegisterEggPosition(eggId, pos)
	end
end

-- الترتيب مهم: الخدمات التي تسجل مزودي المكافآت قبل تحميل اللاعبين
PetService.Init()
EventService.Init()
MissionService.Init()
RebirthService.Init()
SpinService.Init()
EggService.Init()
BreakableService.Init()
ZoneService.Init()
ShopService.Init()
RewardService.Init()
TradeService.Init()
MerchantService.Init()
HoverboardService.Init()
AdminService.Init()
MarketService.Init()
LeaderboardService.Init()
DataService.Init()

print("[PetKingdom] Server ready")

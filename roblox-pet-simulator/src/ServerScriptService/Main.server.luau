--!strict
-- نقطة تشغيل السيرفر
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared.Remotes)
local Config = require(Shared.Config)

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
local SeasonService = require(Services.SeasonService)
local CraftService = require(Services.CraftService)
local CosmeticService = require(Services.CosmeticService)
local DungeonService = require(Services.DungeonService)
local TreasureService = require(Services.TreasureService)
local TitleService = require(Services.TitleService)
local OfflineService = require(Services.OfflineService)
local FriendService = require(Services.FriendService)

local okMap, mapErr = pcall(MapBuilder.Build)
if not okMap then
	warn("[PetKingdom] فشل بناء الخريطة: " .. tostring(mapErr))
end

for _, layout in pairs(MapBuilder.Zones) do
	for eggId, pos in pairs(layout.Eggs) do
		EggService.RegisterEggPosition(eggId, pos)
	end
end

-- الترتيب مهم: الخدمات التي تسجل مزودي المكافآت قبل تحميل اللاعبين
-- كل خدمة معزولة بـ pcall حتى لا يوقف خطأ واحد اللعبة كلها
local function safeInit(name: string, service: any)
	local ok, err = pcall(service.Init)
	if not ok then
		warn("[PetKingdom] فشل تشغيل " .. name .. ": " .. tostring(err))
	end
end

safeInit("PetService", PetService)
safeInit("EventService", EventService)
safeInit("MissionService", MissionService)
safeInit("RebirthService", RebirthService)
safeInit("SpinService", SpinService)
safeInit("EggService", EggService)
safeInit("BreakableService", BreakableService)
safeInit("ZoneService", ZoneService)
safeInit("ShopService", ShopService)
safeInit("RewardService", RewardService)
safeInit("TradeService", TradeService)
safeInit("MerchantService", MerchantService)
safeInit("HoverboardService", HoverboardService)
safeInit("AdminService", AdminService)
safeInit("MarketService", MarketService)
safeInit("SeasonService", SeasonService)
safeInit("CraftService", CraftService)
safeInit("CosmeticService", CosmeticService)
safeInit("DungeonService", DungeonService)
safeInit("TreasureService", TreasureService)
safeInit("TitleService", TitleService)
safeInit("OfflineService", OfflineService)
safeInit("FriendService", FriendService)
safeInit("LeaderboardService", LeaderboardService)
safeInit("DataService", DataService)

-- دورة الليل والنهار
if Config.DayNight.Enabled then
	task.spawn(function()
		local Lighting = game:GetService("Lighting")
		while true do
			local t = (os.clock() % Config.DayNight.DayLength) / Config.DayNight.DayLength
			Lighting.ClockTime = 6 + t * 24
			task.wait(2)
		end
	end)
end

print("[PetKingdom] Server ready")

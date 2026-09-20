--!strict
-- نقطة تشغيل العميل
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared.Remotes)
Remotes.Init()

local Controllers = script.Parent:WaitForChild("Controllers")

local LoadingScreen = require(Controllers.LoadingScreen)
LoadingScreen.Show()

local DataController = require(Controllers.DataController)
local UIController = require(Controllers.UIController)
local InventoryUI = require(Controllers.InventoryUI)
local ShopUI = require(Controllers.ShopUI)
local MachineUI = require(Controllers.MachineUI)
local MissionsUI = require(Controllers.MissionsUI)
local StatsUI = require(Controllers.StatsUI)
local TradeUI = require(Controllers.TradeUI)
local SpinUI = require(Controllers.SpinUI)
local MerchantUI = require(Controllers.MerchantUI)
local AdminUI = require(Controllers.AdminUI)
local MarketUI = require(Controllers.MarketUI)
local EggController = require(Controllers.EggController)
local PetController = require(Controllers.PetController)
local BreakableController = require(Controllers.BreakableController)
local ZoneController = require(Controllers.ZoneController)
local EffectsController = require(Controllers.EffectsController)

DataController.Init()
DataController.Wait()

UIController.Init()
InventoryUI.Init()
ShopUI.Init()
EffectsController.Init()
MachineUI.Init()
MissionsUI.Init()
StatsUI.Init()
TradeUI.Init()
SpinUI.Init()
MerchantUI.Init()
AdminUI.Init()
MarketUI.Init()
EggController.Init()
PetController.Init()
BreakableController.Init()
ZoneController.Init()

LoadingScreen.Hide()

-- شارة VIP في الشات
local TextChatService = game:GetService("TextChatService")
local Players = game:GetService("Players")
if TextChatService.ChatVersion == Enum.ChatVersion.TextChatService then
	TextChatService.OnIncomingMessage = function(message: TextChatMessage)
		local props = Instance.new("TextChatMessageProperties")
		local source = message.TextSource
		if source then
			local sender = Players:GetPlayerByUserId(source.UserId)
			if sender and sender:GetAttribute("VIP") then
				props.PrefixText = "<font color='#FFD700'>[👑 VIP]</font> " .. message.PrefixText
			end
		end
		return props
	end
end

print("[PetKingdom] Client ready")

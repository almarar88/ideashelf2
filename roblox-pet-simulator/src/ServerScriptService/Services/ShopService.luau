--!strict
-- الجيم باس، المنتجات (الألماس/الجرعات)، الترقيات
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local ZoneService = require(script.Parent.ZoneService)

local ShopService = {}

local function gamepassKeyFromId(id: number): string?
	for key, gid in pairs(Config.Gamepasses) do
		if gid == id and gid > 0 then
			return key
		end
	end
	return nil
end

local function productKeyFromId(id: number): string?
	for key, pid in pairs(Config.DevProducts) do
		if pid == id and pid > 0 then
			return key
		end
	end
	return nil
end

local function grantGamepass(player: Player, key: string)
	local p = DataService.Get(player)
	if not p then
		return
	end
	p.Gamepasses[key] = true
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	if key == "VIP" then
		player:SetAttribute("VIP", true)
	end
end

local function refreshGamepasses(player: Player)
	for key, id in pairs(Config.Gamepasses) do
		if id > 0 then
			local ok, owns = pcall(MarketplaceService.UserOwnsGamePassAsync, MarketplaceService, player.UserId, id)
			if ok and owns then
				grantGamepass(player, key)
			end
		end
	end
end

function ShopService.UpgradeCost(key: string, level: number): number?
	for _, u in ipairs(Config.Upgrades) do
		if u.Key == key then
			if level >= u.MaxLevel then
				return nil
			end
			return math.floor(u.BaseCost * (u.CostMult ^ level) + 0.5)
		end
	end
	return nil
end

function ShopService.BuyUpgrade(player: Player, key: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local level = p.Upgrades[key]
	if level == nil then
		return { ok = false, error = "ترقية غير موجودة" }
	end
	local cost = ShopService.UpgradeCost(key, level)
	if not cost then
		return { ok = false, error = "وصلت للمستوى الأقصى" }
	end
	if not DataService.Spend(player, "Diamonds", cost) then
		return { ok = false, error = "تحتاج 💎 " .. cost }
	end
	p.Upgrades[key] = level + 1
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	if key == "Speed" then
		ZoneService.RefreshSpeed(player)
	end
	return { ok = true }
end

local function grantProduct(player: Player, key: string): boolean
	local info
	for _, i in ipairs(Config.DevProductInfo) do
		if i.Key == key then
			info = i
		end
	end
	if not info then
		return false
	end
	if info.Diamonds then
		DataService.AddDiamonds(player, info.Diamonds)
		DataService.Notify(player, "💎 حصلت على " .. info.Diamonds .. " ألماسة!", Color3.fromRGB(120, 220, 255))
	elseif info.Potion then
		DataService.GivePotion(player, info.Potion, info.Count or 1)
	elseif info.Spins then
		DataService.AddSpins(player, info.Spins)
		DataService.Notify(player, "🎡 حصلت على " .. info.Spins .. " لفات!", Color3.fromRGB(255, 220, 60))
	end
	return true
end

function ShopService.Init()
	MarketplaceService.ProcessReceipt = function(receipt)
		local player = Players:GetPlayerByUserId(receipt.PlayerId)
		if not player or not DataService.Get(player) then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		local key = productKeyFromId(receipt.ProductId)
		if key and grantProduct(player, key) then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
		return Enum.ProductPurchaseDecision.NotProcessedYet
	end

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		local key = gamepassKeyFromId(passId)
		if key then
			grantGamepass(player, key)
			DataService.Notify(player, "✅ تم شراء " .. key .. "!", Color3.fromRGB(120, 255, 140))
		end
	end)

	Remotes.Event("PromptPurchase").OnServerEvent:Connect(function(player, kind, key)
		key = tostring(key)
		if kind == "Gamepass" then
			local id = Config.Gamepasses[key]
			if id and id > 0 then
				pcall(MarketplaceService.PromptGamePassPurchase, MarketplaceService, player, id)
			else
				DataService.Notify(player, "⚠️ لم يتم ضبط رقم الجيم باس بعد (Config)", Color3.fromRGB(255, 200, 80))
			end
		elseif kind == "Product" then
			local id = Config.DevProducts[key]
			if id and id > 0 then
				pcall(MarketplaceService.PromptProductPurchase, MarketplaceService, player, id)
			else
				DataService.Notify(player, "⚠️ لم يتم ضبط رقم المنتج بعد (Config)", Color3.fromRGB(255, 200, 80))
			end
		end
	end)

	Remotes.Function("BuyUpgrade").OnServerInvoke = function(player, key)
		return ShopService.BuyUpgrade(player, tostring(key))
	end

	DataService.Loaded:Connect(function(player)
		task.spawn(refreshGamepasses, player)
	end)
end

return ShopService

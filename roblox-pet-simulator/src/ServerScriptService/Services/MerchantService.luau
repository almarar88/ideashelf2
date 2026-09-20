--!strict
-- التاجر المتجول: مخزون يتغير كل ساعة، حدود شراء لكل لاعب
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local MerchantStock = require(Shared.Modules.MerchantStock)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local Rewards = require(script.Parent.Rewards)
local RateLimit = require(script.Parent.RateLimit)

local MerchantService = {}

function MerchantService.Buy(player: Player, slot: number): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not RateLimit.Check(player, "Merchant", 5) then
		return { ok = false, error = "ببطء!" }
	end
	local rotation = MerchantStock.RotationId(os.time())
	if p.Merchant.Rotation ~= rotation then
		p.Merchant = { Rotation = rotation, Bought = {} }
	end
	local stock = MerchantStock.Stock(rotation)
	local item = stock[slot]
	if not item then
		return { ok = false, error = "عنصر غير موجود" }
	end
	local k = tostring(item.PoolIndex)
	if (p.Merchant.Bought[k] or 0) >= item.Limit then
		return { ok = false, error = "وصلت لحد الشراء لهذا العنصر" }
	end
	if not DataService.Spend(player, "Diamonds", item.Cost) then
		return { ok = false, error = "تحتاج 💎 " .. item.Cost }
	end
	p.Merchant.Bought[k] = (p.Merchant.Bought[k] or 0) + 1
	if item.Type == "Potion" then
		Rewards.Grant(player, { Potion = item.Key })
	elseif item.Type == "Pet" then
		Rewards.Grant(player, { Pet = item.Key })
	elseif item.Type == "Spins" then
		Rewards.Grant(player, { Spins = tonumber(item.Key) or 1 })
	elseif item.Type == "Tokens" then
		Rewards.Grant(player, { Tokens = tonumber(item.Key) or 1 })
	end
	DataService.Notify(player, "🧳 اشتريت " .. item.Name, Color3.fromRGB(120, 255, 140))
	DataService.MarkDirty(player)
	return { ok = true }
end

function MerchantService.Init()
	Remotes.Function("Merchant").OnServerInvoke = function(player, slot)
		return MerchantService.Buy(player, math.floor(tonumber(slot) or 0))
	end
end

return MerchantService

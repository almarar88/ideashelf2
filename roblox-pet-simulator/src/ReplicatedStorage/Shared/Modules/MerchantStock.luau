--!strict
-- مخزون التاجر المتجول: يُحسب من الوقت بنفس الطريقة على السيرفر والعميل
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)

local MerchantStock = {}

function MerchantStock.RotationId(now: number): number
	return math.floor(now / Config.Merchant.RotationSeconds)
end

function MerchantStock.SecondsLeft(now: number): number
	return Config.Merchant.RotationSeconds - (now % Config.Merchant.RotationSeconds)
end

-- يرجع قائمة العناصر (نسخ من Pool) للدورة المعطاة
function MerchantStock.Stock(rotationId: number): { any }
	local rng = Random.new(rotationId * 7919 + 13)
	local pool = table.clone(Config.Merchant.Pool)
	local out = {}
	for _ = 1, math.min(Config.Merchant.Slots, #pool) do
		local idx = rng:NextInteger(1, #pool)
		local item = table.clone(pool[idx])
		item.PoolIndex = idx
		table.insert(out, item)
		table.remove(pool, idx)
		-- إعادة حساب المؤشرات الأصلية بعد الحذف
		for _, it in ipairs(out) do
			if it.PoolIndex == nil then
				it.PoolIndex = 0
			end
		end
	end
	-- نثبّت PoolIndex بالبحث بالاسم لضمان المطابقة بين السيرفر والعميل
	for _, it in ipairs(out) do
		for i, p in ipairs(Config.Merchant.Pool) do
			if p.Type == it.Type and p.Key == it.Key then
				it.PoolIndex = i
			end
		end
	end
	return out
end

return MerchantStock

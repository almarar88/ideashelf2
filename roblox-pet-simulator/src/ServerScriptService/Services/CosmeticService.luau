--!strict
-- البيضة التجميلية: إكسسوارات للحيوانات
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local RateLimit = require(script.Parent.RateLimit)

local CosmeticService = {}
local rng = Random.new()

function CosmeticService.Hatch(player: Player): { ok: boolean, error: string?, result: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not DataService.Spend(player, "Diamonds", Config.CosmeticEggCost) then
		return { ok = false, error = "تحتاج 💎 " .. Config.CosmeticEggCost }
	end
	local total = 0
	for _, a in ipairs(Config.Accessories) do
		total += a.Chance
	end
	local r = rng:NextNumber() * total
	local chosen = Config.Accessories[1]
	for _, a in ipairs(Config.Accessories) do
		r -= a.Chance
		if r <= 0 then
			chosen = a
			break
		end
	end
	p.Accessories[chosen.Id] = (p.Accessories[chosen.Id] or 0) + 1
	DataService.MarkDirty(player)
	DataService.Notify(player, chosen.Icon .. " حصلت على " .. chosen.Name .. "!", Color3.fromRGB(255, 120, 200))
	return { ok = true, result = chosen.Id }
end

function CosmeticService.Init()
	Remotes.Function("Cosmetic").OnServerInvoke = function(player, action)
		if not RateLimit.Check(player, "Cosmetic", 3) then
			return { ok = false, error = "ببطء!" }
		end
		if action == "Hatch" then
			return CosmeticService.Hatch(player)
		end
		return { ok = false, error = "إجراء غير معروف" }
	end
end

return CosmeticService

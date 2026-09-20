--!strict
-- عجلة الحظ: لفة مجانية يومياً + لفات إضافية
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local Rewards = require(script.Parent.Rewards)
local RateLimit = require(script.Parent.RateLimit)

local SpinService = {}
local rng = Random.new()

local function coinScale(p: DataService.Profile): number
	local best = 1
	for k in pairs(p.UnlockedZones) do
		local z = Zones.Get(tonumber(k) or 1)
		if z then
			best = math.max(best, z.Multiplier)
		end
	end
	return best * 500
end

function SpinService.Spin(player: Player, paid: boolean): { ok: boolean, error: string?, index: number?, reward: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not RateLimit.Check(player, "Spin", 1, 4) then
		return { ok = false, error = "انتظر انتهاء اللفة" }
	end
	local day = math.floor(os.time() / 86400)
	if p.SpinDay ~= day then
		p.SpinDay = day
	elseif p.Spins > 0 then
		p.Spins -= 1
	elseif paid then
		if not DataService.Spend(player, "Diamonds", Config.Spin.ExtraSpinCost) then
			return { ok = false, error = "تحتاج 💎 " .. Config.Spin.ExtraSpinCost }
		end
	else
		return { ok = false, error = "لا تملك لفات. اللفة المجانية غداً" }
	end
	local total = 0
	for _, s in ipairs(Config.Spin.Segments) do
		total += s.Weight
	end
	local r = rng:NextNumber() * total
	local index = #Config.Spin.Segments
	for i, s in ipairs(Config.Spin.Segments) do
		r -= s.Weight
		if r <= 0 then
			index = i
			break
		end
	end
	local seg = Config.Spin.Segments[index]
	local scale = coinScale(p)
	Rewards.Grant(player, seg, scale)
	p.Stats.Spins += 1
	DataService.MarkDirty(player)
	return { ok = true, index = index, reward = Rewards.Describe(seg, scale) }
end

function SpinService.Init()
	Remotes.Function("Spin").OnServerInvoke = function(player, paid)
		return SpinService.Spin(player, paid == true)
	end
	table.insert(DataService.Extenders, function(_, payload)
		payload.FreeSpin = payload.SpinDay ~= math.floor(os.time() / 86400)
	end)
end

return SpinService

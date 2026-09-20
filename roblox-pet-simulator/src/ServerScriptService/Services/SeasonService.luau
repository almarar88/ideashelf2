--!strict
-- باس الموسم: خبرة من الأنشطة + 30 مستوى بمسارين
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local Rewards = require(script.Parent.Rewards)
local Hooks = require(script.Parent.Hooks)
local RateLimit = require(script.Parent.RateLimit)

local SeasonService = {}

function SeasonService.Tier(xp: number): (number, number, number)
	local tier = 0
	local acc = 0
	while tier < Config.Season.Tiers and xp >= acc + Config.SeasonXPForTier(tier + 1) do
		acc += Config.SeasonXPForTier(tier + 1)
		tier += 1
	end
	local into = xp - acc
	local needed = tier < Config.Season.Tiers and Config.SeasonXPForTier(tier + 1) or 0
	return tier, into, needed
end

function SeasonService.AddXP(player: Player, amount: number)
	local p = DataService.Get(player)
	if not p or amount <= 0 then
		return
	end
	local before = SeasonService.Tier(p.Season.XP)
	p.Season.XP += amount
	local after = SeasonService.Tier(p.Season.XP)
	if after > before then
		DataService.Notify(player, "🎫 باس الموسم: المستوى " .. after .. "! استلم مكافأتك", Color3.fromRGB(255, 200, 80))
	end
	DataService.MarkDirty(player)
end

function SeasonService.Claim(player: Player, tier: number, premium: boolean): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	tier = math.floor(tier)
	if tier < 1 or tier > Config.Season.Tiers then
		return { ok = false, error = "مستوى غير صحيح" }
	end
	local current = SeasonService.Tier(p.Season.XP)
	if tier > current then
		return { ok = false, error = "لم تصل لهذا المستوى بعد" }
	end
	if premium and not DataService.HasGamepass(player, "SeasonPass") then
		return { ok = false, error = "تحتاج Season Pass" }
	end
	local store = premium and p.Season.PremiumClaimed or p.Season.Claimed
	if store[tostring(tier)] then
		return { ok = false, error = "تم الاستلام" }
	end
	store[tostring(tier)] = true
	local reward = Config.SeasonReward(tier, premium)
	Rewards.Grant(player, reward)
	DataService.Notify(player, "🎫 مستوى " .. tier .. ": " .. Rewards.Describe(reward), Color3.fromRGB(255, 200, 80))
	return { ok = true }
end

function SeasonService.Init()
	Hooks.Listen(function(player, kind, amount)
		local xp = Config.Season.XPPerAction[kind]
		if xp then
			SeasonService.AddXP(player, xp * amount)
		end
	end)
	Remotes.Function("Season").OnServerInvoke = function(player, action, payload)
		if not RateLimit.Check(player, "Season", 5) then
			return { ok = false, error = "ببطء!" }
		end
		payload = type(payload) == "table" and payload or {}
		if action == "Claim" then
			return SeasonService.Claim(player, tonumber(payload.Tier) or 0, payload.Premium == true)
		elseif action == "ClaimAll" then
			local n = 0
			for t = 1, Config.Season.Tiers do
				if SeasonService.Claim(player, t, false).ok then
					n += 1
				end
				if DataService.HasGamepass(player, "SeasonPass") and SeasonService.Claim(player, t, true).ok then
					n += 1
				end
			end
			return { ok = true, count = n }
		end
		return { ok = false, error = "إجراء غير معروف" }
	end
	table.insert(DataService.Extenders, function(_, payload)
		local tier, into, needed = SeasonService.Tier(payload.Season and payload.Season.XP or 0)
		payload.SeasonTier = tier
		payload.SeasonInto = into
		payload.SeasonNeeded = needed
	end)
end

return SeasonService

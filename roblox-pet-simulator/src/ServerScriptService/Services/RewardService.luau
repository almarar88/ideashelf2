--!strict
-- المكافآت اليومية، مكافآت وقت اللعب، الأكواد، مكافأة المجموعة
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)

local RewardService = {}

local DAY = 20 * 3600 -- يمكن الاستلام كل 20 ساعة
local RESET = 48 * 3600

local function grant(player: Player, reward: any)
	if reward.Coins then
		DataService.AddCoins(player, reward.Coins)
	end
	if reward.Diamonds then
		DataService.AddDiamonds(player, reward.Diamonds)
	end
	if reward.Potion then
		DataService.GivePotion(player, reward.Potion)
	end
	if reward.Pet then
		PetService.Add(player, reward.Pet, reward.Variant or "Normal", true)
	end
	DataService.MarkDirty(player)
end

function RewardService.ClaimDaily(player: Player): { ok: boolean, error: string?, reward: any? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local now = os.time()
	local since = now - (p.Daily.LastClaim or 0)
	if since < DAY then
		return { ok = false, error = "عد بعد " .. math.ceil((DAY - since) / 3600) .. " ساعة" }
	end
	if since > RESET then
		p.Daily.Streak = 0
	end
	p.Daily.Streak += 1
	p.Daily.LastClaim = now
	local idx = ((p.Daily.Streak - 1) % #Config.DailyRewards) + 1
	local reward = Config.DailyRewards[idx]
	grant(player, reward)
	DataService.Notify(player, "🎁 مكافأة اليوم " .. idx .. " استلمتها!", Color3.fromRGB(255, 200, 80))
	return { ok = true, reward = reward }
end

function RewardService.ClaimPlaytime(player: Player, index: number): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	local reward = Config.PlaytimeRewards[index]
	if not p or not reward then
		return { ok = false, error = "غير موجود" }
	end
	if p.PlaytimeClaimed[tostring(index)] then
		return { ok = false, error = "تم الاستلام" }
	end
	local elapsed = os.time() - p.SessionStart
	if elapsed < reward.Minutes * 60 then
		return { ok = false, error = "لم يحن الوقت بعد" }
	end
	p.PlaytimeClaimed[tostring(index)] = true
	grant(player, reward)
	DataService.Notify(player, "⏱️ استلمت مكافأة " .. reward.Minutes .. " دقيقة!", Color3.fromRGB(120, 255, 200))
	return { ok = true }
end

function RewardService.RedeemCode(player: Player, code: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	code = string.upper((tostring(code):gsub("%s", "")))
	local reward = Config.Codes[code]
	if not reward then
		return { ok = false, error = "كود غير صحيح" }
	end
	if p.Codes[code] then
		return { ok = false, error = "استخدمت هذا الكود من قبل" }
	end
	p.Codes[code] = true
	grant(player, reward)
	DataService.Notify(player, "🔑 تم تفعيل الكود " .. code .. "!", Color3.fromRGB(120, 255, 140))
	return { ok = true }
end

function RewardService.Init()
	Remotes.Function("ClaimDaily").OnServerInvoke = function(player)
		return RewardService.ClaimDaily(player)
	end
	Remotes.Function("ClaimPlaytime").OnServerInvoke = function(player, index)
		return RewardService.ClaimPlaytime(player, tonumber(index) or 0)
	end
	Remotes.Function("RedeemCode").OnServerInvoke = function(player, code)
		return RewardService.RedeemCode(player, tostring(code))
	end
	Remotes.Function("GetServerTime").OnServerInvoke = function()
		return os.time()
	end
	DataService.Loaded:Connect(function(player, profile)
		if Config.GroupId > 0 then
			local ok, inGroup = pcall(player.IsInGroup, player, Config.GroupId)
			if ok and inGroup then
				profile.InGroup = true
				DataService.MarkDirty(player)
			end
		end
	end)
end

return RewardService

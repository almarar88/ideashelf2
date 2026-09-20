--!strict
-- المهام اليومية + الإنجازات + الدليل التعليمي
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local Rewards = require(script.Parent.Rewards)
local Hooks = require(script.Parent.Hooks)
local RateLimit = require(script.Parent.RateLimit)

local MissionService = {}

local function today(): number
	return math.floor(os.time() / 86400)
end

local function maxZone(p: DataService.Profile): number
	local best = 1
	for k in pairs(p.UnlockedZones) do
		best = math.max(best, tonumber(k) or 1)
	end
	return best
end

local function generate(player: Player, p: DataService.Profile)
	local day = today()
	if p.Missions.Day == day and #p.Missions.List > 0 then
		return
	end
	local rng = Random.new(day * 1000 + (player.UserId % 1000))
	local pool = table.clone(Config.Missions.Pool)
	local tierIdx = math.clamp(1 + math.floor(maxZone(p) / 5) + math.min(p.Rebirths, 1), 1, 3)
	local list = {}
	for _ = 1, math.min(Config.Missions.PerDay, #pool) do
		local idx = rng:NextInteger(1, #pool)
		local m = pool[idx]
		table.remove(pool, idx)
		table.insert(list, { Type = m.Type, Name = m.Name, Target = m.Targets[tierIdx], Progress = 0, Claimed = false, Reward = m.Reward })
	end
	p.Missions = { Day = day, List = list }
	DataService.MarkDirty(player)
end

local function onHook(player: Player, kind: string, amount: number)
	local p = DataService.Get(player)
	if not p then
		return
	end
	generate(player, p)
	local changed = false
	for _, m in ipairs(p.Missions.List) do
		if m.Type == kind and not m.Claimed and m.Progress < m.Target then
			m.Progress = math.min(m.Target, m.Progress + amount)
			changed = true
		end
	end
	-- الدليل التعليمي
	local step = Config.Tutorial[p.Tutorial.Step]
	if step then
		if step.Type == kind and step.Type ~= "Zone" then
			p.Tutorial.Progress = math.min(step.Target, p.Tutorial.Progress + amount)
			changed = true
		elseif step.Type == "Zone" and kind == "Zone" then
			if amount >= step.Target then
				p.Tutorial.Progress = step.Target
				changed = true
			end
		end
	end
	if changed then
		DataService.MarkDirty(player)
	end
end

function MissionService.ClaimMission(player: Player, index: number): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local m = p.Missions.List[index]
	if not m then
		return { ok = false, error = "مهمة غير موجودة" }
	end
	if m.Claimed then
		return { ok = false, error = "تم الاستلام" }
	end
	if m.Progress < m.Target then
		return { ok = false, error = "لم تكتمل بعد" }
	end
	m.Claimed = true
	Rewards.Grant(player, m.Reward)
	Hooks.Fire(player, "Mission", 1)
	DataService.Notify(player, "✅ مهمة مكتملة: " .. Rewards.Describe(m.Reward), Color3.fromRGB(120, 255, 140))
	return { ok = true }
end

function MissionService.ClaimAchievement(player: Player, id: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if p.Achievements[id] then
		return { ok = false, error = "تم الاستلام" }
	end
	for _, a in ipairs(Config.Achievements) do
		if a.Id == id then
			if (p.Stats[a.Stat] or 0) < a.Target then
				return { ok = false, error = "لم يكتمل بعد" }
			end
			p.Achievements[id] = true
			Rewards.Grant(player, a.Reward)
			DataService.Notify(player, "🏅 إنجاز: " .. a.Name .. " — " .. Rewards.Describe(a.Reward), Color3.fromRGB(255, 200, 40))
			return { ok = true }
		end
	end
	return { ok = false, error = "إنجاز غير موجود" }
end

function MissionService.ClaimTutorial(player: Player): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	local step = Config.Tutorial[p.Tutorial.Step]
	if not step then
		return { ok = false, error = "أكملت الدليل" }
	end
	if step.Type == "Zone" then
		if not p.UnlockedZones[tostring(step.Target)] then
			return { ok = false, error = "لم تكتمل بعد" }
		end
	elseif p.Tutorial.Progress < step.Target then
		return { ok = false, error = "لم تكتمل بعد" }
	end
	Rewards.Grant(player, step.Reward)
	DataService.Notify(player, "🎓 " .. Rewards.Describe(step.Reward), Color3.fromRGB(120, 200, 255))
	p.Tutorial.Step += 1
	p.Tutorial.Progress = 0
	DataService.MarkDirty(player)
	return { ok = true }
end

function MissionService.Init()
	Hooks.Listen(onHook)
	DataService.Loaded:Connect(function(player, profile)
		generate(player, profile)
	end)
	Remotes.Function("ClaimMission").OnServerInvoke = function(player, index)
		if not RateLimit.Check(player, "Claim", 5) then
			return { ok = false, error = "ببطء!" }
		end
		return MissionService.ClaimMission(player, math.floor(tonumber(index) or 0))
	end
	Remotes.Function("ClaimAchievement").OnServerInvoke = function(player, id)
		if not RateLimit.Check(player, "Claim", 5) then
			return { ok = false, error = "ببطء!" }
		end
		return MissionService.ClaimAchievement(player, tostring(id))
	end
	Remotes.Function("ClaimTutorial").OnServerInvoke = function(player)
		return MissionService.ClaimTutorial(player)
	end
	-- تجديد المهام عند تغير اليوم
	task.spawn(function()
		local Players = game:GetService("Players")
		while true do
			task.wait(60)
			for _, player in ipairs(Players:GetPlayers()) do
				local p = DataService.Get(player)
				if p then
					generate(player, p)
				end
			end
		end
	end)
end

return MissionService

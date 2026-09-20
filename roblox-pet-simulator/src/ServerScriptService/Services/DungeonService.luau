--!strict
-- زنزانة الشق: موجات من الصناديق تنتهي بحارس، مشتركة لكل من في الجزيرة
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local BreakableService = require(script.Parent.BreakableService)
local Rewards = require(script.Parent.Rewards)
local Hooks = require(script.Parent.Hooks)

local DungeonService = {}

local running = false
local wave = 0
local ends = 0
local alive: { [string]: boolean } = {}
local rng = Random.new()

local function state()
	return Remotes.State()
end

local function participants(): { Player }
	local out = {}
	local center = Config.Map.DungeonOffset
	for _, pl in ipairs(Players:GetPlayers()) do
		local char = pl.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if hrp and (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(center.X, 0, center.Z)).Magnitude < 160 and DataService.Get(pl) then
			table.insert(out, pl)
		end
	end
	return out
end

local function highestMult(player: Player): number
	local p = DataService.Get(player)
	local best = 1
	if p then
		for k in pairs(p.UnlockedZones) do
			local z = Zones.Get(tonumber(k) or 1)
			if z then
				best = math.max(best, z.Multiplier)
			end
		end
	end
	return best
end

local function broadcast(text: string)
	Remotes.Event("DungeonUpdate"):FireAllClients({ Active = running, Wave = wave, Ends = ends, Text = text })
	local s = state()
	s:SetAttribute("DungeonWave", wave)
	s:SetAttribute("DungeonEnds", ends)
end

local function finish(success: boolean)
	running = false
	for id in pairs(alive) do
		BreakableService.Remove(id)
	end
	alive = {}
	local players = participants()
	if success then
		for _, pl in ipairs(players) do
			local p = DataService.Get(pl) :: DataService.Profile
			Rewards.Grant(pl, Config.Dungeon.ClearReward)
			DataService.AddCoins(pl, math.floor(Config.Dungeon.CoinsPerWaveScale * highestMult(pl) * 3 * DataService.CoinMultiplier(pl)))
			p.Stats.DungeonClears += 1
			p.DungeonCooldown = os.time() + Config.Dungeon.Cooldown
			if rng:NextNumber() < Config.Dungeon.PetChance then
				PetService.Add(pl, Config.Dungeon.Pet, "Normal", true)
				DataService.Notify(pl, "🌀 حصلت على Rift Guardian!", Color3.fromRGB(157, 0, 255))
			end
			Hooks.Fire(pl, "Dungeon", 1)
			DataService.Notify(pl, "🏆 أنهيت الزنزانة! " .. Rewards.Describe(Config.Dungeon.ClearReward), Color3.fromRGB(120, 255, 140))
			DataService.MarkDirty(pl)
		end
		Remotes.Event("EventEffect"):FireAllClients({ Type = "DungeonClear" })
	else
		for _, pl in ipairs(players) do
			local p = DataService.Get(pl) :: DataService.Profile
			p.DungeonCooldown = os.time() + math.floor(Config.Dungeon.Cooldown / 2)
			DataService.MarkDirty(pl)
		end
	end
	wave = 0
	ends = 0
	broadcast(success and "🏆 اكتملت الزنزانة!" or "⏳ انتهى الوقت")
end

local function spawnWave()
	wave += 1
	alive = {}
	local players = participants()
	if #players == 0 then
		finish(false)
		return
	end
	local totalPower = 0
	for _, pl in ipairs(players) do
		totalPower += math.max(1, PetService.GetPower(pl))
	end
	local center = Config.Map.DungeonOffset
	local isBoss = wave > Config.Dungeon.Waves
	if isBoss then
		local health = math.max(3000, math.floor(totalPower * Config.Dungeon.BossSeconds))
		local id = BreakableService.SpawnDynamic("RiftBoss", -2, center + Vector3.new(0, 0, 30), {
			Health = health,
			RewardScale = 3,
			Name = "👹 Rift Warden",
			OnBroken = function(contributors)
				for pl in pairs(contributors) do
					if pl.Parent == Players and rng:NextNumber() < Config.Dungeon.BossPetChance then
						PetService.Add(pl, "titanic_overlord", "Normal", true)
						DataService.NotifyAll("🌟 " .. pl.Name .. " حصل على TITANIC Overlord من الزنزانة!!!", Color3.new(1, 1, 1))
					end
				end
				finish(true)
			end,
		})
		if id then
			alive[id] = true
		end
		broadcast("👹 الموجة الأخيرة: حارس الشق!")
		Remotes.Event("EventEffect"):FireAllClients({ Type = "DungeonBoss" })
		return
	end
	local n = Config.Dungeon.CratesPerWave
	local health = math.max(50, math.floor(totalPower * Config.Dungeon.CrateSecondsPerPower * (1 + wave * 0.3) / n))
	for i = 1, n do
		local ang = (i / n) * math.pi * 2
		local pos = center + Vector3.new(math.cos(ang) * 32, 0, math.sin(ang) * 32)
		local id = BreakableService.SpawnDynamic("RiftCrate", -2, pos, {
			Health = health,
			RewardScale = 0.05 * wave,
			OnBroken = function()
				local remaining = 0
				for aid in pairs(alive) do
					if BreakableService.IsAlive(aid) then
						remaining += 1
					end
				end
				if running and remaining == 0 then
					for _, pl in ipairs(participants()) do
						Rewards.Grant(pl, { Diamonds = Config.Dungeon.WaveReward.Diamonds * wave, Gems = Config.Dungeon.WaveReward.Gems * wave })
						DataService.AddCoins(pl, math.floor(Config.Dungeon.CoinsPerWaveScale * highestMult(pl) * wave * 0.2 * DataService.CoinMultiplier(pl)))
						Hooks.Fire(pl, "DungeonWave", 1)
					end
					task.delay(2, function()
						if running then
							spawnWave()
						end
					end)
				end
			end,
		})
		if id then
			alive[id] = true
		end
	end
	broadcast("🌀 الموجة " .. wave .. " / " .. Config.Dungeon.Waves)
	Remotes.Event("EventEffect"):FireAllClients({ Type = "DungeonWave", Wave = wave })
end

function DungeonService.Start(player: Player): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if running then
		return { ok = false, error = "الزنزانة جارية الآن، انضم للقتال!" }
	end
	if os.time() < (p.DungeonCooldown or 0) then
		return { ok = false, error = "انتظر " .. (p.DungeonCooldown - os.time()) .. " ثانية" }
	end
	local inside = false
	for _, pl in ipairs(participants()) do
		if pl == player then
			inside = true
		end
	end
	if not inside then
		return { ok = false, error = "ادخل الزنزانة أولاً" }
	end
	running = true
	wave = 0
	ends = os.time() + Config.Dungeon.TimeLimit
	DataService.NotifyAll("🌀 " .. player.Name .. " بدأ زنزانة الشق! انضموا من بوابة البلدة", Color3.fromRGB(157, 0, 255))
	spawnWave()
	task.delay(Config.Dungeon.TimeLimit, function()
		if running and os.time() >= ends then
			finish(false)
		end
	end)
	return { ok = true }
end

function DungeonService.Init()
	Remotes.Function("Dungeon").OnServerInvoke = function(player, action)
		if action == "Start" then
			return DungeonService.Start(player)
		end
		return { ok = false, error = "إجراء غير معروف" }
	end
end

return DungeonService

--!strict
-- الصناديق والعملات: الظهور، الاستهداف، الضرر، الضربات القاضية، الخبرة، المكافآت، الزعيم
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Breakables = require(Shared.Data.Breakables)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local MapBuilder = require(script.Parent.MapBuilder)
local Hooks = require(script.Parent.Hooks)

local BreakableService = {}

type Breakable = {
	Id: string,
	Type: string,
	Def: Breakables.BreakableDef,
	Zone: number,
	Mult: number,
	Health: number,
	MaxHealth: number,
	Alive: boolean,
	Damage: { [Player]: number },
	Position: Vector3,
	Model: Model,
	Special: boolean,
	Boss: boolean,
}

local breakables: { [string]: Breakable } = {}
local targets: { [Player]: string } = {}
local lastTap: { [Player]: number } = {}
local folder: Folder
local counter = 0
local rng = Random.new()
local boss: Breakable? = nil
BreakableService.OnBossKilled = nil :: ((contributors: { [Player]: number }) -> ())?

local function canUseZone(player: Player, zone: number): boolean
	local p = DataService.Get(player)
	if not p then
		return false
	end
	if zone == 0 then
		return DataService.HasGamepass(player, "VIP")
	elseif zone == -1 then
		return true
	end
	local required = Zones.RebirthRequired(zone)
	if required > 0 and p.Rebirths < required then
		return false
	end
	return p.UnlockedZones[tostring(zone)] == true
end

local function setTarget(player: Player, id: string?)
	if id then
		targets[player] = id
		player:SetAttribute("Target", id)
	else
		targets[player] = nil
		player:SetAttribute("Target", "")
	end
end

local function playerPosition(player: Player): Vector3?
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	return hrp and hrp.Position or nil
end

local function tryTarget(player: Player, b: Breakable, maxDist: number): boolean
	if not b.Alive or not canUseZone(player, b.Zone) then
		return false
	end
	local pos = playerPosition(player)
	if not pos or (pos - b.Position).Magnitude > maxDist then
		return false
	end
	setTarget(player, b.Id)
	return true
end

local function respawn(b: Breakable)
	if b.Boss then
		return
	end
	b.Health = b.MaxHealth
	b.Alive = true
	b.Damage = {}
	b.Model:SetAttribute("Health", b.Health)
	b.Model.Parent = folder
end

local function highestZoneMult(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 1
	end
	local best = 1
	for idxStr in pairs(p.UnlockedZones) do
		local z = Zones.Get(tonumber(idxStr) or 1)
		if z and z.Multiplier > best then
			best = z.Multiplier
		end
	end
	return best
end

local function breakIt(b: Breakable)
	if not b.Alive then
		return
	end
	b.Alive = false
	local total = 0
	for _, d in pairs(b.Damage) do
		total += d
	end
	if total <= 0 then
		total = 1
	end
	for player, d in pairs(b.Damage) do
		local p = DataService.Get(player)
		if player.Parent == Players and p then
			local share = d / total
			local mult = b.Boss and highestZoneMult(player) or b.Mult
			local coins, diamonds = 0, 0
			if b.Def.Coins > 0 then
				coins = math.max(1, math.floor(b.Def.Coins * mult * share * DataService.CoinMultiplier(player) + 0.5))
				DataService.AddCoins(player, coins)
				Hooks.Fire(player, "Coins", coins)
			end
			if b.Def.Diamonds > 0 then
				local raw = b.Def.Diamonds * share * DataService.DiamondMultiplier(player)
				diamonds = math.floor(raw)
				if rng:NextNumber() < (raw - diamonds) then
					diamonds += 1
				end
				if diamonds > 0 then
					DataService.AddDiamonds(player, diamonds, true)
					Hooks.Fire(player, "Diamonds", diamonds)
				end
			end
			local gems = 0
			if b.Def.Gems and b.Def.Gems > 0 then
				local raw = b.Def.Gems * share
				gems = math.floor(raw)
				if rng:NextNumber() < (raw - gems) then
					gems += 1
				end
				if gems > 0 then
					DataService.AddGems(player, gems, true)
				end
			end
			p.Stats.Breaks += 1
			Hooks.Fire(player, "Break", 1)
			PetService.GrantXP(player, Config.XPPerBreakBase * (b.Zone <= 0 and 3 or b.Zone) * (b.Boss and 25 or 1))
			Remotes.Event("RewardPopup"):FireClient(player, { Position = b.Position + Vector3.new(0, b.Def.Size.Y, 0), Coins = coins, Diamonds = diamonds, Gems = gems, Color = b.Def.Color })
		end
	end
	for player, id in pairs(targets) do
		if id == b.Id then
			setTarget(player, nil)
		end
	end
	if b.Type == "GiantChest" then
		DataService.NotifyAll("💥 تم كسر الصندوق العملاق! سيعود بعد " .. Format.Time(b.Def.Respawn), Color3.fromRGB(255, 120, 255))
	elseif b.Type == "MysteryBox" then
		DataService.NotifyAll("🎁 انفتح صندوق الغموض!", Color3.fromRGB(120, 120, 255))
	end
	local contributors = b.Damage
	b.Model.Parent = nil
	if b.Boss then
		boss = nil
		breakables[b.Id] = nil
		if BreakableService.OnBossKilled then
			BreakableService.OnBossKilled(contributors)
		end
	else
		task.delay(b.Def.Respawn, respawn, b)
	end
end

local function applyDamage(b: Breakable, player: Player, amount: number, crit: boolean?)
	if not b.Alive or amount <= 0 then
		return
	end
	amount = math.min(amount, b.Health)
	b.Health -= amount
	b.Damage[player] = (b.Damage[player] or 0) + amount
	local p = DataService.Get(player)
	if p then
		p.Stats.Damage += amount
	end
	b.Model:SetAttribute("Health", math.max(0, b.Health))
	b.Model:SetAttribute("LastHit", os.clock())
	b.Model:SetAttribute("LastHitBy", player.UserId)
	b.Model:SetAttribute("LastDamage", amount)
	b.Model:SetAttribute("LastCrit", crit == true)
	if b.Boss then
		Remotes.Event("BossUpdate"):FireAllClients({ Active = true, Health = math.max(0, b.Health), MaxHealth = b.MaxHealth })
	end
	if b.Health <= 0 then
		breakIt(b)
	end
end

local function tap(player: Player, b: Breakable)
	local now = os.clock()
	if now - (lastTap[player] or 0) < Config.TapCooldown then
		return
	end
	lastTap[player] = now
	local dmg = Config.TapDamageBase * DataService.DamageMultiplier(player)
	if PetService.GetPower(player) <= 0 then
		dmg *= 5
	end
	applyDamage(b, player, dmg)
end

local function spawnBreakable(typeName: string, zone: number, mult: number, pos: Vector3, special: boolean, isBoss: boolean?, healthOverride: number?): Breakable?
	local def = Breakables.Get(typeName)
	if not def then
		return nil
	end
	counter += 1
	local id = typeName .. "_" .. counter
	local model = MapBuilder.BuildBreakable(typeName, pos)
	model.Name = id
	model:SetAttribute("Id", id)
	model:SetAttribute("Type", typeName)
	model:SetAttribute("Zone", zone)
	local maxHealth = healthOverride or math.floor(def.Health * mult)
	model:SetAttribute("MaxHealth", maxHealth)
	model:SetAttribute("Health", maxHealth)
	model:SetAttribute("Coins", math.floor(def.Coins * mult))
	model:SetAttribute("Diamonds", def.Diamonds)
	model:SetAttribute("Boss", isBoss == true)
	local b: Breakable = {
		Id = id,
		Type = typeName,
		Def = def,
		Zone = zone,
		Mult = mult,
		Health = maxHealth,
		MaxHealth = maxHealth,
		Alive = true,
		Damage = {},
		Position = pos,
		Model = model,
		Special = special,
		Boss = isBoss == true,
	}
	breakables[id] = b
	local cd = model:FindFirstChildOfClass("ClickDetector") :: ClickDetector
	cd.MouseClick:Connect(function(player)
		if tryTarget(player, b, 70) then
			tap(player, b)
		elseif not canUseZone(player, b.Zone) then
			DataService.Notify(player, "🔒 افتح هذه المنطقة أولاً", Color3.fromRGB(255, 100, 100))
		end
	end)
	model.Parent = folder
	return b
end

local function nearestAlive(player: Player, maxDist: number): Breakable?
	local pos = playerPosition(player)
	if not pos then
		return nil
	end
	local best, bestDist = nil, maxDist
	for _, b in pairs(breakables) do
		if b.Alive and canUseZone(player, b.Zone) then
			local d = (b.Position - pos).Magnitude
			if d < bestDist then
				best, bestDist = b, d
			end
		end
	end
	return best
end

local function tick()
	for _, player in ipairs(Players:GetPlayers()) do
		local id = targets[player]
		local b = id and breakables[id]
		if b and b.Alive then
			local pos = playerPosition(player)
			if not pos or (pos - b.Position).Magnitude > 110 then
				setTarget(player, nil)
			else
				local dmg = PetService.GetPower(player)
				local crit = false
				local critChance = DataService.CritChance(player)
				if critChance > 0 and rng:NextNumber() < critChance then
					dmg *= Config.CritMultiplier
					crit = true
				end
				applyDamage(b, player, dmg, crit)
				if DataService.HasGamepass(player, "AutoTap") then
					lastTap[player] = 0
					tap(player, b)
				end
			end
		elseif DataService.HasGamepass(player, "AutoTap") and DataService.Get(player) then
			local nb = nearestAlive(player, 60)
			if nb then
				setTarget(player, nb.Id)
			end
		elseif id then
			setTarget(player, nil)
		end
	end
end

-- ===== الزعيم =====
function BreakableService.SpawnBoss(health: number): Breakable?
	if boss then
		return boss
	end
	local pos = MapBuilder.Specials.BossArena
	local b = spawnBreakable("Boss", 1, 1, pos, true, true, health)
	boss = b
	if b then
		Remotes.Event("BossUpdate"):FireAllClients({ Active = true, Health = b.Health, MaxHealth = b.MaxHealth })
	end
	return b
end

function BreakableService.RemoveBoss()
	if boss then
		local b = boss
		boss = nil
		b.Alive = false
		for player, id in pairs(targets) do
			if id == b.Id then
				setTarget(player, nil)
			end
		end
		b.Model:Destroy()
		breakables[b.Id] = nil
		Remotes.Event("BossUpdate"):FireAllClients({ Active = false })
	end
end

function BreakableService.BossAlive(): boolean
	return boss ~= nil
end

function BreakableService.Init()
	folder = Instance.new("Folder")
	folder.Name = "Breakables"
	folder.Parent = Workspace

	for index, layout in pairs(MapBuilder.Zones) do
		local zone = Zones.Get(index)
		if zone then
			local spotIndex = 1
			for _, entry in ipairs(zone.Breakables) do
				for _ = 1, entry.Count do
					local spot = layout.Spots[spotIndex]
					if not spot then
						break
					end
					spotIndex += 1
					spawnBreakable(entry.Type, index, zone.Multiplier, spot, false)
				end
			end
		end
	end
	spawnBreakable("GiantChest", 1, 1, MapBuilder.Specials.GiantChest, true)
	spawnBreakable("MysteryBox", 1, 1, MapBuilder.Specials.MysteryBox, true)

	Remotes.Event("SetTarget").OnServerEvent:Connect(function(player, id)
		if id == nil then
			setTarget(player, nil)
			return
		end
		local b = breakables[tostring(id)]
		if b then
			tryTarget(player, b, 70)
		end
	end)

	Players.PlayerRemoving:Connect(function(player)
		targets[player] = nil
		lastTap[player] = nil
		for _, b in pairs(breakables) do
			b.Damage[player] = nil
		end
	end)

	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc >= Config.DamageTickRate then
			acc -= Config.DamageTickRate
			tick()
		end
	end)
end

return BreakableService

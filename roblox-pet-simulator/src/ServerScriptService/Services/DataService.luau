--!strict
-- تحميل وحفظ بيانات اللاعبين + العملات + إرسال الملف للعميل
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)

local DataService = {}

export type Profile = {
	Coins: number,
	Diamonds: number,
	Pets: { any },
	UnlockedZones: { [string]: boolean },
	Upgrades: { [string]: number },
	Stats: { [string]: number },
	Daily: { LastClaim: number, Streak: number },
	Codes: { [string]: boolean },
	Potions: { [string]: number },
	DarkMatter: { any },
	Settings: { [string]: boolean },
	Index: { [string]: boolean },
	Gamepasses: { [string]: boolean },
	LastZone: number,
	InGroup: boolean,
	SessionStart: number,
	PlaytimeClaimed: { [string]: boolean },
}

local function template(): Profile
	return {
		Coins = 0,
		Diamonds = 0,
		Pets = {},
		UnlockedZones = { ["1"] = true },
		Upgrades = { Storage = 0, Equip = 0, Coins = 0, Luck = 0, Damage = 0, Speed = 0 },
		Stats = { Hatches = 0, Breaks = 0, CoinsEarned = 0, Playtime = 0, BestPet = 0 },
		Daily = { LastClaim = 0, Streak = 0 },
		Codes = {},
		Potions = { Lucky = 0, Coins = 0 },
		DarkMatter = {},
		Settings = { Music = true, HideOthersPets = false, LowGraphics = false },
		Index = {},
		Gamepasses = {},
		LastZone = 1,
		InGroup = false,
		SessionStart = 0,
		PlaytimeClaimed = {},
	}
end

local store = DataStoreService:GetDataStore(Config.DataStoreName)
local profiles: { [Player]: Profile } = {}
local dirty: { [Player]: boolean } = {}
local loadedEvent = Instance.new("BindableEvent")

DataService.Loaded = loadedEvent.Event

local function key(player: Player): string
	return "p_" .. player.UserId
end

local function reconcile(data: any): Profile
	local t = template()
	if type(data) ~= "table" then
		return t
	end
	for k, v in pairs(t) do
		if data[k] == nil then
			data[k] = v
		elseif type(v) == "table" and type(data[k]) == "table" and k ~= "Pets" and k ~= "DarkMatter" then
			for k2, v2 in pairs(v) do
				if data[k][k2] == nil then
					data[k][k2] = v2
				end
			end
		end
	end
	return data :: Profile
end

local function retry<T>(fn: () -> T, attempts: number): (boolean, T?)
	local ok, res
	for i = 1, attempts do
		ok, res = pcall(fn)
		if ok then
			return true, res
		end
		warn("[DataService] attempt " .. i .. " failed: " .. tostring(res))
		task.wait(1.5 * i)
	end
	return false, nil
end

local function load(player: Player)
	local ok, data = retry(function()
		return store:GetAsync(key(player))
	end, 3)
	if not ok then
		player:Kick("تعذر تحميل بياناتك، حاول مرة أخرى بعد قليل.")
		return
	end
	if player.Parent ~= Players then
		return -- غادر أثناء التحميل
	end
	local profile = reconcile(data)
	profile.SessionStart = os.time()
	profile.PlaytimeClaimed = {}
	profile.Gamepasses = {}
	profile.InGroup = false
	profiles[player] = profile

	-- leaderstats
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	local coins = Instance.new("NumberValue")
	coins.Name = "Coins"
	coins.Value = profile.Coins
	coins.Parent = ls
	local diamonds = Instance.new("NumberValue")
	diamonds.Name = "Diamonds"
	diamonds.Value = profile.Diamonds
	diamonds.Parent = ls
	ls.Parent = player

	dirty[player] = true
	loadedEvent:Fire(player, profile)
end

local function save(player: Player, remove: boolean?)
	local profile = profiles[player]
	if not profile then
		return
	end
	local snapshot = table.clone(profile)
	snapshot.Gamepasses = nil :: any
	snapshot.PlaytimeClaimed = nil :: any
	snapshot.InGroup = nil :: any
	snapshot.Stats = table.clone(profile.Stats)
	snapshot.Stats.Playtime = (profile.Stats.Playtime or 0) + (os.time() - profile.SessionStart)
	local ok = retry(function()
		return store:UpdateAsync(key(player), function()
			return snapshot
		end)
	end, 3)
	if not ok then
		warn("[DataService] failed to save " .. player.Name)
	end
	if remove then
		profiles[player] = nil
		dirty[player] = nil
	end
end

function DataService.Get(player: Player): Profile?
	return profiles[player]
end

function DataService.MarkDirty(player: Player)
	dirty[player] = true
end

-- دوال إضافية تضيف حقولاً محسوبة للملف المرسل للعميل (تسجلها الخدمات الأخرى)
DataService.Extenders = {} :: { (Player, any) -> () }

function DataService.Replicate(player: Player)
	local profile = profiles[player]
	if not profile then
		return
	end
	local payload = table.clone(profile) :: any
	payload.ServerTime = os.time()
	payload.OwnedPasses = {}
	for key in pairs(Config.Gamepasses) do
		payload.OwnedPasses[key] = DataService.HasGamepass(player, key)
	end
	payload.Luck = DataService.LuckMultiplier(player)
	payload.CoinMult = DataService.CoinMultiplier(player)
	for _, fn in ipairs(DataService.Extenders) do
		fn(player, payload)
	end
	Remotes.Event("ProfileUpdate"):FireClient(player, payload)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		local coins = ls:FindFirstChild("Coins") :: NumberValue?
		local diamonds = ls:FindFirstChild("Diamonds") :: NumberValue?
		if coins then
			coins.Value = math.floor(profile.Coins)
		end
		if diamonds then
			diamonds.Value = math.floor(profile.Diamonds)
		end
	end
end

function DataService.Notify(player: Player, text: string, color: Color3?)
	Remotes.Event("Notify"):FireClient(player, { Text = text, Color = color })
end

function DataService.NotifyAll(text: string, color: Color3?)
	Remotes.Event("Notify"):FireAllClients({ Text = text, Color = color })
end

function DataService.AddCoins(player: Player, amount: number)
	local p = profiles[player]
	if not p or amount <= 0 then
		return
	end
	p.Coins += amount
	p.Stats.CoinsEarned += amount
	dirty[player] = true
end

function DataService.AddDiamonds(player: Player, amount: number)
	local p = profiles[player]
	if not p or amount <= 0 then
		return
	end
	p.Diamonds += amount
	dirty[player] = true
end

function DataService.Spend(player: Player, currency: string, amount: number): boolean
	local p = profiles[player]
	if not p then
		return false
	end
	if currency == "Coins" then
		if p.Coins < amount then
			return false
		end
		p.Coins -= amount
	elseif currency == "Diamonds" then
		if p.Diamonds < amount then
			return false
		end
		p.Diamonds -= amount
	else
		return false
	end
	dirty[player] = true
	return true
end

function DataService.HasGamepass(player: Player, keyName: string): boolean
	local p = profiles[player]
	if not p then
		return false
	end
	if Config.StudioFreeGamepasses and RunService:IsStudio() then
		return true
	end
	return p.Gamepasses[keyName] == true
end

function DataService.PotionActive(player: Player, potion: string): boolean
	local p = profiles[player]
	return p ~= nil and (p.Potions[potion] or 0) > os.time()
end

function DataService.GivePotion(player: Player, potion: string)
	local p = profiles[player]
	local cfg = Config.Potions[potion]
	if not p or not cfg then
		return
	end
	local base = math.max(os.time(), p.Potions[potion] or 0)
	p.Potions[potion] = base + cfg.Duration
	dirty[player] = true
	DataService.Notify(player, "تم تفعيل " .. cfg.Name .. " ✨", Color3.fromRGB(180, 120, 255))
end

function DataService.LuckMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local upgrade = (p.Upgrades.Luck or 0) * 0.10
	local group = p.InGroup and Config.GroupBonus.Luck or 0
	local mult = 1 + upgrade + group
	if DataService.HasGamepass(player, "Lucky") then
		mult *= 2
	end
	if DataService.HasGamepass(player, "SuperLucky") then
		mult *= 3
	end
	if DataService.PotionActive(player, "Lucky") then
		mult *= Config.Potions.Lucky.Mult
	end
	return mult
end

function DataService.CoinMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local upgrade = (p.Upgrades.Coins or 0) * 0.05
	local group = p.InGroup and Config.GroupBonus.Coins or 0
	local mult = 1 + upgrade + group
	if DataService.HasGamepass(player, "VIP") then
		mult *= Config.VIPCoinMultiplier
	end
	if DataService.HasGamepass(player, "DoubleCoins") then
		mult *= 2
	end
	if DataService.PotionActive(player, "Coins") then
		mult *= Config.Potions.Coins.Mult
	end
	return mult
end

function DataService.Init()
	Remotes.Event("RequestProfile").OnServerEvent:Connect(function(player)
		if profiles[player] then
			DataService.Replicate(player)
		end
	end)
	Players.PlayerAdded:Connect(load)
	for _, p in ipairs(Players:GetPlayers()) do
		task.spawn(load, p)
	end
	Players.PlayerRemoving:Connect(function(player)
		save(player, true)
	end)

	-- إرسال التحديثات للعميل (بحد أقصى 10 مرات بالثانية)
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 0.1 then
			return
		end
		acc = 0
		for player, isDirty in pairs(dirty) do
			if isDirty and profiles[player] then
				dirty[player] = false
				DataService.Replicate(player)
			end
		end
	end)

	task.spawn(function()
		while true do
			task.wait(Config.AutoSaveInterval)
			for player in pairs(profiles) do
				save(player)
			end
		end
	end)

	game:BindToClose(function()
		if RunService:IsStudio() then
			task.wait(1)
		end
		for player in pairs(profiles) do
			save(player, true)
		end
	end)
end

return DataService

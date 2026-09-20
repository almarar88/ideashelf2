--!strict
-- تحميل وحفظ بيانات اللاعبين + العملات + المضاعفات + إرسال الملف للعميل
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local Mastery = require(Shared.Modules.Mastery)

local DataService = {}

export type Profile = {
	Coins: number,
	Diamonds: number,
	Tokens: number,
	Gems: number,
	Spins: number,
	Rebirths: number,
	Pets: { any },
	UnlockedZones: { [string]: boolean },
	Upgrades: { [string]: number },
	Stats: { [string]: number },
	Daily: { LastClaim: number, Streak: number },
	VIPDaily: number,
	Codes: { [string]: boolean },
	Potions: { [string]: number },
	PotionBag: { [string]: number },
	DarkMatter: { any },
	Settings: { [string]: any },
	Index: { [string]: boolean },
	Gamepasses: { [string]: boolean },
	LastZone: number,
	InGroup: boolean,
	SessionStart: number,
	PlaytimeClaimed: { [string]: boolean },
	Missions: { Day: number, List: { any } },
	Achievements: { [string]: boolean },
	Tutorial: { Step: number, Progress: number },
	Hoverboards: { Owned: { [string]: boolean }, Equipped: string },
	Merchant: { Rotation: number, Bought: { [string]: number } },
	SpinDay: number,
	MyListings: { [string]: any },
}

local function template(): Profile
	return {
		Coins = 0,
		Diamonds = 0,
		Tokens = 0,
		Gems = 0,
		Spins = 0,
		Rebirths = 0,
		Pets = {},
		UnlockedZones = { ["1"] = true },
		Upgrades = { Storage = 0, Equip = 0, Coins = 0, Luck = 0, Damage = 0, Speed = 0, Diamonds = 0, XP = 0 },
		Stats = { Hatches = 0, Breaks = 0, CoinsEarned = 0, DiamondsEarned = 0, Damage = 0, Playtime = 0, BestPet = 0, Fusions = 0, Goldens = 0, Rainbows = 0, DarkMatters = 0, Rebirths = 0, BossKills = 0, Trades = 0, Enchants = 0, Spins = 0, MarketSales = 0, GemsEarned = 0, Huges = 0, Titanics = 0 },
		Daily = { LastClaim = 0, Streak = 0 },
		VIPDaily = 0,
		Codes = {},
		Potions = { Lucky = 0, Coins = 0, Damage = 0, Diamonds = 0 },
		PotionBag = { Lucky = 0, Coins = 0, Damage = 0, Diamonds = 0 },
		DarkMatter = {},
		Settings = { Music = true, HideOthersPets = false, LowGraphics = false, AutoDeleteRank = 0, DamageNumbers = true },
		Index = {},
		Gamepasses = {},
		LastZone = 1,
		InGroup = false,
		SessionStart = 0,
		PlaytimeClaimed = {},
		Missions = { Day = 0, List = {} },
		Achievements = {},
		Tutorial = { Step = 1, Progress = 0 },
		Hoverboards = { Owned = {}, Equipped = "" },
		Merchant = { Rotation = 0, Bought = {} },
		SpinDay = 0,
		MyListings = {},
	}
end

local store = DataStoreService:GetDataStore(Config.DataStoreName)
local profiles: { [Player]: Profile } = {}
local dirty: { [Player]: boolean } = {}
local loadedEvent = Instance.new("BindableEvent")

DataService.Loaded = loadedEvent.Event
-- دوال إضافية تضيف حقولاً محسوبة للملف المرسل للعميل
DataService.Extenders = {} :: { (Player, any) -> () }
-- مزودو المكافآت: كل دالة ترجع { Coins=, Luck=, Damage=, Diamonds=, XP=, Crit=, Agility= } (إضافات أو مضاعفات)
DataService.BonusProviders = {} :: { (Player) -> { [string]: number }? }

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
	-- ترقية الحيوانات القديمة
	for _, pet in ipairs(data.Pets) do
		pet.Level = pet.Level or 1
		pet.XP = pet.XP or 0
		pet.Enchants = pet.Enchants or {}
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
		return
	end
	local profile = reconcile(data)
	profile.SessionStart = os.time()
	profile.PlaytimeClaimed = {}
	profile.Gamepasses = {}
	profile.InGroup = false
	profiles[player] = profile

	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	for _, name in ipairs({ "Coins", "Diamonds", "Gems", "Rebirths" }) do
		local v = Instance.new("NumberValue")
		v.Name = name
		v.Value = (profile :: any)[name]
		v.Parent = ls
	end
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

function DataService.IsAdmin(player: Player): boolean
	if Config.StudioEveryoneAdmin and RunService:IsStudio() then
		return true
	end
	return table.find(Config.Admins, player.UserId) ~= nil
end

function DataService.Replicate(player: Player)
	local profile = profiles[player]
	if not profile then
		return
	end
	local payload = table.clone(profile) :: any
	payload.ServerTime = os.time()
	payload.OwnedPasses = {}
	for k in pairs(Config.Gamepasses) do
		payload.OwnedPasses[k] = DataService.HasGamepass(player, k)
	end
	payload.Luck = DataService.LuckMultiplier(player)
	payload.CoinMult = DataService.CoinMultiplier(player)
	payload.DamageMult = DataService.DamageMultiplier(player)
	payload.DiamondMult = DataService.DiamondMultiplier(player)
	payload.IsAdmin = DataService.IsAdmin(player)
	payload.Premium = player.MembershipType == Enum.MembershipType.Premium
	for _, fn in ipairs(DataService.Extenders) do
		fn(player, payload)
	end
	Remotes.Event("ProfileUpdate"):FireClient(player, payload)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		for _, name in ipairs({ "Coins", "Diamonds", "Gems", "Rebirths" }) do
			local v = ls:FindFirstChild(name) :: NumberValue?
			if v then
				v.Value = math.floor((profile :: any)[name])
			end
		end
	end
end

function DataService.Notify(player: Player, text: string, color: Color3?)
	Remotes.Event("Notify"):FireClient(player, { Text = text, Color = color })
end

function DataService.NotifyAll(text: string, color: Color3?)
	Remotes.Event("Notify"):FireAllClients({ Text = text, Color = color })
end

-- ===== العملات =====
function DataService.AddCoins(player: Player, amount: number)
	local p = profiles[player]
	if not p or amount <= 0 then
		return
	end
	p.Coins += amount
	p.Stats.CoinsEarned += amount
	dirty[player] = true
end

function DataService.AddDiamonds(player: Player, amount: number, fromBreakable: boolean?)
	local p = profiles[player]
	if not p or amount <= 0 then
		return
	end
	p.Diamonds += amount
	if fromBreakable then
		p.Stats.DiamondsEarned += amount
	end
	dirty[player] = true
end

function DataService.AddTokens(player: Player, amount: number)
	local p = profiles[player]
	if p and amount > 0 then
		p.Tokens += amount
		dirty[player] = true
	end
end

function DataService.AddGems(player: Player, amount: number, earned: boolean?)
	local p = profiles[player]
	if p and amount > 0 then
		p.Gems += amount
		if earned then
			p.Stats.GemsEarned += amount
		end
		dirty[player] = true
	end
end

function DataService.AddSpins(player: Player, amount: number)
	local p = profiles[player]
	if p and amount > 0 then
		p.Spins += amount
		dirty[player] = true
	end
end

function DataService.Spend(player: Player, currency: string, amount: number): boolean
	local p = profiles[player]
	if not p or amount < 0 then
		return false
	end
	local field = if currency == "Coins" then "Coins" elseif currency == "Diamonds" then "Diamonds" elseif currency == "Tokens" then "Tokens" elseif currency == "Spins" then "Spins" elseif currency == "Gems" then "Gems" else nil
	if not field then
		return false
	end
	local pp = p :: any
	if pp[field] < amount then
		return false
	end
	pp[field] -= amount
	dirty[player] = true
	return true
end

-- ===== الجيم باس والجرعات =====
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

-- يضيف جرعة إلى الحقيبة
function DataService.GivePotion(player: Player, potion: string, count: number?)
	local p = profiles[player]
	local cfg = Config.Potions[potion]
	if not p or not cfg then
		return
	end
	p.PotionBag[potion] = (p.PotionBag[potion] or 0) + (count or 1)
	dirty[player] = true
	DataService.Notify(player, "🧪 حصلت على " .. cfg.Name .. " (في الحقيبة)", Color3.fromRGB(180, 120, 255))
end

function DataService.UsePotion(player: Player, potion: string): { ok: boolean, error: string? }
	local p = profiles[player]
	local cfg = Config.Potions[potion]
	if not p or not cfg then
		return { ok = false, error = "جرعة غير معروفة" }
	end
	if (p.PotionBag[potion] or 0) <= 0 then
		return { ok = false, error = "لا تملك هذه الجرعة" }
	end
	p.PotionBag[potion] -= 1
	local base = math.max(os.time(), p.Potions[potion] or 0)
	p.Potions[potion] = base + cfg.Duration
	dirty[player] = true
	DataService.Notify(player, "✨ تم تفعيل " .. cfg.Name, Color3.fromRGB(180, 120, 255))
	return { ok = true }
end

-- ===== المضاعفات =====
local function bonuses(player: Player): { [string]: number }
	local p = profiles[player]
	local out = { Coins = 0, Luck = 0, Damage = 0, Diamonds = 0, XP = 0, Crit = 0, Agility = 0, EventCoins = 1, EventLuck = 1, EventDiamonds = 1, EventXP = 1 }
	if not p then
		return out
	end
	local m = Mastery.Bonuses(p.Stats)
	for k, v in pairs(m) do
		out[k] = (out[k] or 0) + v
	end
	for _, fn in ipairs(DataService.BonusProviders) do
		local b = fn(player)
		if b then
			for k, v in pairs(b) do
				if k:sub(1, 5) == "Event" then
					out[k] = (out[k] or 1) * v
				else
					out[k] = (out[k] or 0) + v
				end
			end
		end
	end
	return out
end

function DataService.Bonuses(player: Player): { [string]: number }
	return bonuses(player)
end

function DataService.LuckMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local b = bonuses(player)
	local add = (p.Upgrades.Luck or 0) * 0.10 + (p.InGroup and Config.GroupBonus.Luck or 0)
		+ (player.MembershipType == Enum.MembershipType.Premium and Config.PremiumBonus.Luck or 0)
		+ p.Rebirths * Config.Rebirth.LuckPerRebirth + b.Luck
	local mult = 1 + add
	if DataService.HasGamepass(player, "Lucky") then
		mult *= 2
	end
	if DataService.HasGamepass(player, "SuperLucky") then
		mult *= 3
	end
	if DataService.PotionActive(player, "Lucky") then
		mult *= Config.Potions.Lucky.Mult
	end
	return mult * b.EventLuck
end

function DataService.CoinMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local b = bonuses(player)
	local add = (p.Upgrades.Coins or 0) * 0.05 + (p.InGroup and Config.GroupBonus.Coins or 0)
		+ (player.MembershipType == Enum.MembershipType.Premium and Config.PremiumBonus.Coins or 0)
		+ p.Rebirths * Config.Rebirth.CoinsPerRebirth + b.Coins
	local mult = 1 + add
	if DataService.HasGamepass(player, "VIP") then
		mult *= Config.VIPCoinMultiplier
	end
	if DataService.HasGamepass(player, "DoubleCoins") then
		mult *= 2
	end
	if DataService.PotionActive(player, "Coins") then
		mult *= Config.Potions.Coins.Mult
	end
	return mult * b.EventCoins
end

function DataService.DamageMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local b = bonuses(player)
	local mult = 1 + (p.Upgrades.Damage or 0) * 0.05 + p.Rebirths * Config.Rebirth.DamagePerRebirth + b.Damage
	if DataService.PotionActive(player, "Damage") then
		mult *= Config.Potions.Damage.Mult
	end
	return mult
end

function DataService.DiamondMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local b = bonuses(player)
	local mult = 1 + (p.Upgrades.Diamonds or 0) * 0.10 + p.Rebirths * Config.Rebirth.DiamondsPerRebirth + b.Diamonds
	if DataService.HasGamepass(player, "DoubleDiamonds") then
		mult *= 2
	end
	if DataService.PotionActive(player, "Diamonds") then
		mult *= Config.Potions.Diamonds.Mult
	end
	return mult * b.EventDiamonds
end

function DataService.XPMultiplier(player: Player): number
	local p = profiles[player]
	if not p then
		return 1
	end
	local b = bonuses(player)
	return (1 + (p.Upgrades.XP or 0) * 0.10 + b.XP) * b.EventXP
end

function DataService.CritChance(player: Player): number
	return bonuses(player).Crit
end

function DataService.Save(player: Player)
	save(player)
end

function DataService.ResetProfile(player: Player)
	local fresh = template()
	fresh.SessionStart = os.time()
	profiles[player] = fresh
	dirty[player] = true
	loadedEvent:Fire(player, fresh)
end

function DataService.Init()
	Remotes.Event("RequestProfile").OnServerEvent:Connect(function(player)
		if profiles[player] then
			DataService.Replicate(player)
		end
	end)
	Remotes.Function("UsePotion").OnServerInvoke = function(player, potion)
		return DataService.UsePotion(player, tostring(potion))
	end
	Remotes.Function("BuyPotion").OnServerInvoke = function(player, potion)
		local cfg = Config.Potions[tostring(potion)]
		if not cfg then
			return { ok = false, error = "جرعة غير معروفة" }
		end
		if not DataService.Spend(player, "Diamonds", cfg.Cost) then
			return { ok = false, error = "تحتاج 💎 " .. cfg.Cost }
		end
		DataService.GivePotion(player, tostring(potion), 1)
		return { ok = true }
	end

	Players.PlayerAdded:Connect(load)
	for _, p in ipairs(Players:GetPlayers()) do
		task.spawn(load, p)
	end
	Players.PlayerRemoving:Connect(function(player)
		save(player, true)
	end)

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

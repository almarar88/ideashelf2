--!strict
-- HUD + إدارة النوافذ + الإشعارات + النوافذ البسيطة (المناطق، المكافآت، الأكواد، الفهرس، الإعدادات)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local PetViewport = require(script.Parent.PetViewport)

local UIController = {}

local player = Players.LocalPlayer
local gui: ScreenGui
local windows: { [string]: UIKit.Window } = {}
local currentWindow: string? = nil
local hud: Frame
local notifHolder: Frame
local refreshers: { [string]: () -> () } = {}

UIController.Gui = nil :: ScreenGui?
UIController.Windows = windows

-- ===== النوافذ =====
function UIController.Register(name: string, window: UIKit.Window, refresh: (() -> ())?)
	windows[name] = window
	if refresh then
		refreshers[name] = refresh
	end
	window.Close.Activated:Connect(function()
		UIController.Close()
	end)
end

function UIController.Close()
	if currentWindow and windows[currentWindow] then
		windows[currentWindow].Root.Visible = false
	end
	currentWindow = nil
end

function UIController.Open(name: string)
	if currentWindow == name then
		UIController.Close()
		return
	end
	UIController.Close()
	local w = windows[name]
	if not w then
		return
	end
	currentWindow = name
	if refreshers[name] then
		refreshers[name]()
	end
	w.Root.Visible = true
	UIKit.Pop(w.Root)
end

function UIController.IsOpen(name: string): boolean
	return currentWindow == name
end

-- ===== الإشعارات =====
function UIController.Notify(text: string, color: Color3?)
	local frame = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundColor3 = UIKit.Colors.Panel2, BackgroundTransparency = 0.1, Parent = notifHolder })
	UIKit.Corner(frame, 12)
	UIKit.Stroke(frame, color or UIKit.Colors.Blue, 2.5)
	local label = UIKit.Label({ Text = text, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = color or UIKit.Colors.Text, MaxTextSize = 22, Parent = frame })
	UIKit.Pop(frame)
	task.delay(4, function()
		UIKit.Tween(frame, { BackgroundTransparency = 1 }, 0.4)
		UIKit.Tween(label, { TextTransparency = 1, TextStrokeTransparency = 1 }, 0.4)
		task.wait(0.45)
		frame:Destroy()
	end)
end

-- ===== HUD =====
local coinsLabel: TextLabel
local diamondsLabel: TextLabel
local powerLabel: TextLabel
local zoneLabel: TextLabel
local potionsLabel: TextLabel
local giftButton: TextButton

local function buildHUD()
	hud = UIKit.Frame({ Name = "HUD", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })

	-- العملات
	local currency = UIKit.Frame({ Size = UDim2.fromOffset(210, 96), Position = UDim2.fromOffset(16, 16), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.15, Parent = hud })
	UIKit.Corner(currency, 16)
	UIKit.Stroke(currency, UIKit.Colors.Panel3, 2)
	UIKit.Padding(currency, 8)
	UIKit.List(currency, 6)
	local function currencyRow(icon: string, color: Color3): TextLabel
		local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 36), BackgroundColor3 = Color3.fromRGB(15, 16, 28), Parent = currency })
		UIKit.Corner(row, 10)
		UIKit.Label({ Text = icon, Size = UDim2.fromOffset(34, 36), Parent = row })
		local l = UIKit.Label({ Text = "0", Size = UDim2.new(1, -44, 1, 0), Position = UDim2.fromOffset(40, 0), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = color, MaxTextSize = 26, Parent = row })
		return l
	end
	coinsLabel = currencyRow("💰", UIKit.Colors.Gold)
	diamondsLabel = currencyRow("💎", UIKit.Colors.Cyan)

	-- القوة والمنطقة
	local top = UIKit.Frame({ Size = UDim2.fromOffset(300, 40), Position = UDim2.new(0.5, -150, 0, 12), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.15, Parent = hud })
	UIKit.Corner(top, 14)
	UIKit.Stroke(top, UIKit.Colors.Panel3, 2)
	zoneLabel = UIKit.Label({ Text = "Town", Size = UDim2.fromScale(0.5, 1), MaxTextSize = 22, Parent = top })
	powerLabel = UIKit.Label({ Text = "⚔️ 0", Size = UDim2.fromScale(0.5, 1), Position = UDim2.fromScale(0.5, 0), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 22, Parent = top })

	-- الجرعات
	potionsLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(300, 24), Position = UDim2.new(0.5, -150, 0, 56), TextColor3 = UIKit.Colors.Purple, MaxTextSize = 18, Parent = hud })

	-- أزرار القائمة اليسرى
	local menu = UIKit.Frame({ BackgroundTransparency = 1, Size = UDim2.fromOffset(80, 520), Position = UDim2.fromOffset(16, 124), Parent = hud })
	UIKit.List(menu, 4)
	UIKit.IconButton(menu, "🐾", "Pets", UIKit.Colors.Green, function()
		UIController.Open("Inventory")
	end)
	UIKit.IconButton(menu, "🛒", "Shop", UIKit.Colors.Blue, function()
		UIController.Open("Shop")
	end)
	UIKit.IconButton(menu, "🗺️", "Zones", UIKit.Colors.Gold, function()
		UIController.Open("Zones")
	end)
	UIKit.IconButton(menu, "🎁", "Rewards", UIKit.Colors.Pink, function()
		UIController.Open("Rewards")
	end)
	UIKit.IconButton(menu, "📖", "Index", UIKit.Colors.Purple, function()
		UIController.Open("Index")
	end)
	UIKit.IconButton(menu, "🔑", "Codes", UIKit.Colors.Cyan, function()
		UIController.Open("Codes")
	end)

	-- أزرار يمين
	local right = UIKit.Frame({ BackgroundTransparency = 1, Size = UDim2.fromOffset(80, 200), Position = UDim2.new(1, -96, 0, 16), Parent = hud })
	UIKit.List(right, 4)
	UIKit.IconButton(right, "⚙️", "Settings", UIKit.Colors.Panel3, function()
		UIController.Open("Settings")
	end)
	giftButton = UIKit.IconButton(right, "⏱️", "Gift", UIKit.Colors.Red, function()
		UIController.Open("Rewards")
	end)

	-- زر VIP
	UIKit.IconButton(right, "👑", "VIP", UIKit.Colors.Gold, function()
		if DataController.Owns("VIP") then
			Remotes.Event("Teleport"):FireServer(0)
		else
			Remotes.Event("PromptPurchase"):FireServer("Gamepass", "VIP")
		end
	end)
end

local function tweenNumber(label: TextLabel, from: number, to: number)
	local start = os.clock()
	local dur = 0.35
	task.spawn(function()
		while os.clock() - start < dur do
			local a = (os.clock() - start) / dur
			label.Text = Format.Number(from + (to - from) * a)
			task.wait()
		end
		label.Text = Format.Number(to)
	end)
end

local lastCoins, lastDiamonds = 0, 0

local function refreshHUD(p: any)
	tweenNumber(coinsLabel, lastCoins, p.Coins)
	tweenNumber(diamondsLabel, lastDiamonds, p.Diamonds)
	lastCoins, lastDiamonds = p.Coins, p.Diamonds
	powerLabel.Text = "⚔️ " .. Format.Number(p.Power or 0)
end

local function updateTimers()
	local p = DataController.Profile
	if not p then
		return
	end
	local now = DataController.ServerTime()
	local parts = {}
	for key, cfg in pairs(Config.Potions) do
		local exp = p.Potions[key] or 0
		if exp > now then
			table.insert(parts, "🧪 " .. cfg.Name .. " " .. Format.Time(exp - now))
		end
	end
	potionsLabel.Text = table.concat(parts, "   ")
	-- زر الهدية
	local elapsed = now - (p.SessionStart or now)
	local nextReward
	for i, r in ipairs(Config.PlaytimeRewards) do
		if not p.PlaytimeClaimed[tostring(i)] then
			nextReward = r
			break
		end
	end
	if nextReward then
		local remain = nextReward.Minutes * 60 - elapsed
		giftButton.Text = remain <= 0 and "🎁" or Format.Time(remain)
		giftButton.BackgroundColor3 = remain <= 0 and UIKit.Colors.Green or UIKit.Colors.Red
	else
		giftButton.Text = "✅"
	end
	-- المنطقة الحالية
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if hrp then
		local vip = Config.Map.VIPOffset
		local idx
		if (Vector3.new(hrp.Position.X, 0, hrp.Position.Z) - Vector3.new(vip.X, 0, vip.Z)).Magnitude < 220 then
			idx = 0
		else
			idx = math.clamp(math.floor(hrp.Position.Z / Config.Map.ZoneSpacing + 0.5) + 1, 1, #Zones.List)
		end
		local zone = Zones.Get(idx)
		if zone then
			zoneLabel.Text = zone.Name
		end
	end
end

-- ===== نافذة المناطق =====
local function buildZonesWindow()
	local w = UIKit.Window(gui, "Zones", "🗺️ المناطق", UDim2.fromOffset(520, 560), UIKit.Colors.Gold)
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 8)
	local rows: { [number]: { Frame: Frame, Button: TextButton, Status: TextLabel } } = {}
	local all = table.clone(Zones.List)
	table.insert(all, Zones.VIP)
	for _, zone in ipairs(all) do
		local row = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 64), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
		UIKit.Corner(row, 12)
		UIKit.Stroke(row, zone.Accent, 2)
		local swatch = UIKit.Frame({ Size = UDim2.fromOffset(44, 44), Position = UDim2.fromOffset(10, 10), BackgroundColor3 = zone.Ground, Parent = row })
		UIKit.Corner(swatch, 10)
		UIKit.Label({ Text = zone.Name .. "  •  " .. zone.Arabic, Size = UDim2.new(1, -230, 0, 30), Position = UDim2.fromOffset(64, 6), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = row })
		local status = UIKit.Label({ Text = "", Size = UDim2.new(1, -230, 0, 22), Position = UDim2.fromOffset(64, 36), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = row })
		local btn = UIKit.Button({ Text = "...", Size = UDim2.fromOffset(150, 44), Position = UDim2.new(1, -160, 0, 10), MaxTextSize = 20, Parent = row })
		rows[zone.Index] = { Frame = row, Button = btn, Status = status }
		btn.Activated:Connect(function()
			local p = DataController.Profile
			if not p then
				return
			end
			if zone.Index == 0 then
				if DataController.Owns("VIP") then
					Remotes.Event("Teleport"):FireServer(0)
					UIController.Close()
				else
					Remotes.Event("PromptPurchase"):FireServer("Gamepass", "VIP")
				end
				return
			end
			if p.UnlockedZones[tostring(zone.Index)] then
				Remotes.Event("Teleport"):FireServer(zone.Index)
				UIController.Close()
			else
				local res = Remotes.Function("UnlockZone"):InvokeServer(zone.Index)
				if not res.ok and res.error then
					UIController.Notify(res.error, UIKit.Colors.Red)
				end
			end
		end)
	end
	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		for idx, row in pairs(rows) do
			local zone = Zones.Get(idx) :: Zones.ZoneDef
			if idx == 0 then
				local owns = DataController.Owns("VIP")
				row.Button.Text = owns and "انتقال" or "👑 شراء VIP"
				row.Button.BackgroundColor3 = owns and UIKit.Colors.Green or UIKit.Colors.Gold
				row.Status.Text = "منطقة حصرية لأعضاء VIP"
			elseif p.UnlockedZones[tostring(idx)] then
				row.Button.Text = "انتقال"
				row.Button.BackgroundColor3 = UIKit.Colors.Green
				row.Status.Text = "✅ مفتوحة"
			elseif p.UnlockedZones[tostring(idx - 1)] then
				row.Button.Text = "🔓 " .. Format.Number(zone.Cost)
				row.Button.BackgroundColor3 = p.Coins >= zone.Cost and UIKit.Colors.Gold or UIKit.Colors.Panel3
				row.Status.Text = "💰 " .. Format.Number(zone.Cost) .. " لفتحها"
			else
				row.Button.Text = "🔒"
				row.Button.BackgroundColor3 = UIKit.Colors.Panel3
				row.Status.Text = "افتح المنطقة السابقة أولاً"
			end
		end
	end
	UIController.Register("Zones", w, refresh)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Zones") then
			refresh()
		end
	end)
end

-- ===== نافذة المكافآت =====
local function buildRewardsWindow()
	local w = UIKit.Window(gui, "Rewards", "🎁 المكافآت", UDim2.fromOffset(640, 560), UIKit.Colors.Pink)
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 10)

	UIKit.Label({ Text = "📅 المكافأة اليومية", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 24, Parent = scroll })
	local dailyRow = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 110), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(dailyRow, 6, true)
	local dailyTiles = {}
	for i, r in ipairs(Config.DailyRewards) do
		local tile = UIKit.Frame({ Size = UDim2.fromOffset(78, 100), BackgroundColor3 = UIKit.Colors.Panel2, Parent = dailyRow })
		UIKit.Corner(tile, 10)
		local stroke = UIKit.Stroke(tile, UIKit.Colors.Panel3, 2)
		UIKit.Label({ Text = "يوم " .. i, Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = tile })
		local text = "💎 " .. r.Diamonds
		if r.Potion then
			text = text .. "\n🧪"
		end
		UIKit.Label({ Text = text, Size = UDim2.new(1, 0, 1, -24), Position = UDim2.fromOffset(0, 22), MaxTextSize = 20, Parent = tile })
		dailyTiles[i] = { Tile = tile, Stroke = stroke }
	end
	local dailyBtn = UIKit.Button({ Text = "استلام", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(200, 44), MaxTextSize = 22, Parent = scroll })
	local dailyStatus = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = scroll })
	dailyBtn.Activated:Connect(function()
		local res = Remotes.Function("ClaimDaily"):InvokeServer()
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)

	UIKit.Label({ Text = "⏱️ مكافآت وقت اللعب", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 24, Parent = scroll })
	local ptRow = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 120), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(ptRow, 6, true)
	local ptTiles = {}
	for i, r in ipairs(Config.PlaytimeRewards) do
		local tile = UIKit.Frame({ Size = UDim2.fromOffset(92, 116), BackgroundColor3 = UIKit.Colors.Panel2, Parent = ptRow })
		UIKit.Corner(tile, 10)
		UIKit.Label({ Text = r.Minutes .. " دقيقة", Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = tile })
		UIKit.Label({ Text = "💎 " .. r.Diamonds .. (r.Potion and "\n🧪" or ""), Size = UDim2.new(1, 0, 0, 46), Position = UDim2.fromOffset(0, 22), MaxTextSize = 20, Parent = tile })
		local btn = UIKit.Button({ Text = "...", Size = UDim2.new(1, -12, 0, 34), Position = UDim2.new(0, 6, 1, -40), MaxTextSize = 16, Parent = tile })
		btn.Activated:Connect(function()
			local res = Remotes.Function("ClaimPlaytime"):InvokeServer(i)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		ptTiles[i] = btn
	end

	local groupLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 40), TextColor3 = UIKit.Colors.Green, MaxTextSize = 18, Parent = scroll })

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local now = DataController.ServerTime()
		local nextIdx = ((p.Daily.Streak or 0) % #Config.DailyRewards) + 1
		for i, t in pairs(dailyTiles) do
			t.Stroke.Color = i == nextIdx and UIKit.Colors.Gold or UIKit.Colors.Panel3
			t.Tile.BackgroundColor3 = i < nextIdx and UIKit.Colors.Panel3 or UIKit.Colors.Panel2
		end
		local since = now - (p.Daily.LastClaim or 0)
		local canClaim = since >= 20 * 3600
		dailyBtn.BackgroundColor3 = canClaim and UIKit.Colors.Green or UIKit.Colors.Panel3
		dailyStatus.Text = canClaim and "جاهزة للاستلام! سلسلة: " .. (p.Daily.Streak or 0) or ("التالية بعد " .. Format.Time(20 * 3600 - since))
		local elapsed = now - (p.SessionStart or now)
		for i, btn in pairs(ptTiles) do
			local r = Config.PlaytimeRewards[i]
			if p.PlaytimeClaimed[tostring(i)] then
				btn.Text = "✅"
				btn.BackgroundColor3 = UIKit.Colors.Panel3
			elseif elapsed >= r.Minutes * 60 then
				btn.Text = "استلام"
				btn.BackgroundColor3 = UIKit.Colors.Green
			else
				btn.Text = Format.Time(r.Minutes * 60 - elapsed)
				btn.BackgroundColor3 = UIKit.Colors.Panel3
			end
		end
		if Config.GroupId > 0 then
			groupLabel.Text = p.InGroup and "✅ مكافأة المجموعة مفعلة: +25% حظ و +25% عملات" or "انضم لمجموعة اللعبة واحصل على +25% حظ و +25% عملات"
		else
			groupLabel.Text = ""
		end
	end
	UIController.Register("Rewards", w, refresh)
	task.spawn(function()
		while true do
			task.wait(1)
			if UIController.IsOpen("Rewards") then
				refresh()
			end
		end
	end)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Rewards") then
			refresh()
		end
	end)
end

-- ===== نافذة الأكواد =====
local function buildCodesWindow()
	local w = UIKit.Window(gui, "Codes", "🔑 الأكواد", UDim2.fromOffset(420, 240), UIKit.Colors.Cyan)
	UIKit.Label({ Text = "أدخل الكود للحصول على مكافآت! تابع حساباتنا للأكواد الجديدة.", Size = UDim2.new(1, 0, 0, 44), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = w.Content })
	local box = UIKit.New("TextBox", {
		Size = UDim2.new(1, 0, 0, 46),
		Position = UDim2.fromOffset(0, 54),
		BackgroundColor3 = Color3.fromRGB(15, 16, 28),
		PlaceholderText = "CODE",
		Text = "",
		Font = UIKit.Font,
		TextColor3 = UIKit.Colors.Text,
		TextSize = 24,
		ClearTextOnFocus = false,
		Parent = w.Content,
	}) :: TextBox
	UIKit.Corner(box, 10)
	UIKit.Stroke(box, UIKit.Colors.Panel3, 2)
	UIKit.Button({ Text = "تفعيل", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 46), Position = UDim2.fromOffset(0, 112), MaxTextSize = 22, Parent = w.Content }, function()
		local res = Remotes.Function("RedeemCode"):InvokeServer(box.Text)
		if res.ok then
			box.Text = ""
		elseif res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)
	UIController.Register("Codes", w)
end

-- ===== نافذة الفهرس =====
local function buildIndexWindow()
	local w = UIKit.Window(gui, "Index", "📖 فهرس الحيوانات", UDim2.fromOffset(760, 580), UIKit.Colors.Purple)
	local counter = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 26), MaxTextSize = 20, TextColor3 = UIKit.Colors.Muted, Parent = w.Content })
	local scroll = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -30), Position = UDim2.fromOffset(0, 30) })
	UIKit.Grid(scroll, UDim2.fromOffset(110, 140), 8)
	local cards: { [string]: { Card: Frame, Vp: ViewportFrame?, Name: TextLabel } } = {}
	local built = false
	local function build()
		if built then
			return
		end
		built = true
		local sorted = table.clone(Pets.List)
		table.sort(sorted, function(a, b)
			if a.Tier ~= b.Tier then
				return a.Tier < b.Tier
			end
			return Rarities.Rank(a.Rarity) < Rarities.Rank(b.Rarity)
		end)
		for i, def in ipairs(sorted) do
			local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
			UIKit.Corner(card, 12)
			UIKit.Stroke(card, Rarities.Color(def.Rarity), 2)
			local vpHolder = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 96), BackgroundTransparency = 1, Parent = card })
			local name = UIKit.Label({ Text = "???", Size = UDim2.new(1, -6, 0, 24), Position = UDim2.fromOffset(3, 98), MaxTextSize = 15, Parent = card })
			UIKit.Label({ Text = def.Rarity, Size = UDim2.new(1, 0, 0, 16), Position = UDim2.fromOffset(0, 120), TextColor3 = Rarities.Color(def.Rarity), MaxTextSize = 13, Parent = card })
			cards[def.Id] = { Card = card, Vp = nil, Name = name }
			cards[def.Id].Vp = PetViewport.Create(vpHolder, def.Id, "Normal")
		end
	end
	local function refresh()
		build()
		local p = DataController.Profile
		if not p then
			return
		end
		local found = 0
		for id, c in pairs(cards) do
			local def = Pets.Get(id) :: Pets.PetDef
			local discovered = p.Index[id] == true
			if discovered then
				found += 1
			end
			c.Name.Text = discovered and def.Name or "???"
			if c.Vp then
				c.Vp.ImageTransparency = discovered and 0 or 0.85
			end
		end
		counter.Text = "اكتشفت " .. found .. " / " .. #Pets.List
	end
	UIController.Register("Index", w, refresh)
end

-- ===== الإعدادات =====
local function buildSettingsWindow()
	local w = UIKit.Window(gui, "Settings", "⚙️ الإعدادات", UDim2.fromOffset(420, 300), UIKit.Colors.Panel3)
	UIKit.List(w.Content, 8)
	local function toggle(text: string, key: string)
		local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = UIKit.Colors.Panel2, Parent = w.Content })
		UIKit.Corner(row, 10)
		UIKit.Label({ Text = text, Size = UDim2.new(1, -120, 1, 0), Position = UDim2.fromOffset(12, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = row })
		local btn = UIKit.Button({ Text = "ON", Size = UDim2.fromOffset(90, 36), Position = UDim2.new(1, -100, 0, 6), MaxTextSize = 18, Parent = row })
		local function refresh()
			local p = DataController.Profile
			local on = p and p.Settings and p.Settings[key] ~= false
			if key == "HideOthersPets" or key == "LowGraphics" then
				on = p and p.Settings and p.Settings[key] == true
			end
			btn.Text = on and "ON" or "OFF"
			btn.BackgroundColor3 = on and UIKit.Colors.Green or UIKit.Colors.Red
		end
		btn.Activated:Connect(function()
			local p = DataController.Profile
			if p then
				p.Settings[key] = not (p.Settings[key] == true)
				Remotes.Function("PetAction"):InvokeServer("Setting", { Key = key, Value = p.Settings[key] })
				refresh()
			end
		end)
		DataController.Changed:Connect(refresh)
		refresh()
	end
	toggle("🎵 الموسيقى", "Music")
	toggle("🙈 إخفاء حيوانات الآخرين", "HideOthersPets")
	toggle("⚡ رسومات منخفضة", "LowGraphics")
	UIController.Register("Settings", w)
end

function UIController.Init()
	gui = Instance.new("ScreenGui")
	gui.Name = "PetKingdomUI"
	gui.ResetOnSpawn = false
	gui.IgnoreGuiInset = true
	gui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling
	gui.Parent = player:WaitForChild("PlayerGui")
	UIController.Gui = gui

	notifHolder = UIKit.Frame({ Name = "Notifications", BackgroundTransparency = 1, Size = UDim2.fromOffset(380, 300), Position = UDim2.new(0.5, -190, 0, 90), Parent = gui })
	UIKit.List(notifHolder, 6, false, true)

	buildHUD()
	buildZonesWindow()
	buildRewardsWindow()
	buildCodesWindow()
	buildIndexWindow()
	buildSettingsWindow()

	DataController.Changed:Connect(refreshHUD)
	if DataController.Profile then
		refreshHUD(DataController.Profile)
	end
	task.spawn(function()
		while true do
			updateTimers()
			task.wait(1)
		end
	end)

	Remotes.Event("Notify").OnClientEvent:Connect(function(data)
		UIController.Notify(data.Text, data.Color)
	end)
	Remotes.Event("HatchBroadcast").OnClientEvent:Connect(function(data)
		local def = Pets.Get(data.PetId)
		if def then
			UIController.Notify("🌟 " .. data.Player .. " حصل على " .. def.Name .. " (" .. def.Rarity .. ")!", Rarities.Color(def.Rarity))
		end
	end)

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.X then
			UIController.Close()
		end
	end)
end

return UIController

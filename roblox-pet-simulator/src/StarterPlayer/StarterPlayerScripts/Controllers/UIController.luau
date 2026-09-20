--!strict
-- HUD + إدارة النوافذ + الإشعارات + النوافذ البسيطة (المناطق، المكافآت، الأكواد، الفهرس، الإعدادات)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Pets = require(Shared.Data.Pets)
local Eggs = require(Shared.Data.Eggs)
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

function UIController.Refresh(name: string)
	if currentWindow == name and refreshers[name] then
		refreshers[name]()
	end
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
local tokensLabel: TextLabel
local gemsLabel: TextLabel
local powerLabel: TextLabel
local zoneLabel: TextLabel
local rebirthLabel: TextLabel
local potionsLabel: TextLabel
local giftButton: TextButton
local adminButton: TextButton
local eventBanner: Frame
local eventLabel: TextLabel
local eventTimer: TextLabel
local dungeonBanner: Frame
local dungeonLabel: TextLabel
local dungeonTimer: TextLabel
local bossBar: Frame
local bossFill: Frame
local bossText: TextLabel
local questFrame: Frame
local questText: TextLabel
local questProgress: TextLabel
local questClaim: TextButton
local potionBar: Frame
local potionButtons: { [string]: TextButton } = {}

local function buildHUD()
	hud = UIKit.Frame({ Name = "HUD", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })

	-- العملات
	local currency = UIKit.Frame({ Size = UDim2.fromOffset(220, 180), Position = UDim2.fromOffset(16, 16), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.15, Parent = hud })
	UIKit.Corner(currency, 16)
	UIKit.Stroke(currency, UIKit.Colors.Panel3, 2)
	UIKit.Padding(currency, 8)
	UIKit.List(currency, 6)
	local function currencyRow(icon: string, color: Color3): TextLabel
		local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 36), BackgroundColor3 = Color3.fromRGB(15, 16, 28), Parent = currency })
		UIKit.Corner(row, 10)
		UIKit.Label({ Text = icon, Size = UDim2.fromOffset(34, 36), Parent = row })
		return UIKit.Label({ Text = "0", Size = UDim2.new(1, -44, 1, 0), Position = UDim2.fromOffset(40, 0), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = color, MaxTextSize = 26, Parent = row })
	end
	coinsLabel = currencyRow("💰", UIKit.Colors.Gold)
	diamondsLabel = currencyRow("💎", UIKit.Colors.Cyan)
	gemsLabel = currencyRow("💠", Color3.fromRGB(200, 140, 255))
	tokensLabel = currencyRow("🔁", Color3.fromRGB(255, 140, 60))

	-- القوة والمنطقة والريبيرث
	local top = UIKit.Frame({ Size = UDim2.fromOffset(440, 40), Position = UDim2.new(0.5, -220, 0, 12), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.15, Parent = hud })
	UIKit.Corner(top, 14)
	UIKit.Stroke(top, UIKit.Colors.Panel3, 2)
	zoneLabel = UIKit.Label({ Text = "Town", Size = UDim2.fromScale(0.4, 1), MaxTextSize = 22, Parent = top })
	powerLabel = UIKit.Label({ Text = "⚔️ 0", Size = UDim2.fromScale(0.35, 1), Position = UDim2.fromScale(0.4, 0), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 22, Parent = top })
	rebirthLabel = UIKit.Label({ Text = "🔁 0", Size = UDim2.fromScale(0.25, 1), Position = UDim2.fromScale(0.75, 0), TextColor3 = Color3.fromRGB(255, 140, 60), MaxTextSize = 22, Parent = top })

	potionsLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(440, 22), Position = UDim2.new(0.5, -220, 0, 56), TextColor3 = UIKit.Colors.Purple, MaxTextSize = 17, Parent = hud })

	-- شريط الحدث
	eventBanner = UIKit.Frame({ Size = UDim2.fromOffset(440, 40), Position = UDim2.new(0.5, -220, 0, 82), BackgroundColor3 = Color3.fromRGB(80, 40, 120), Visible = false, Parent = hud })
	UIKit.Corner(eventBanner, 12)
	UIKit.Stroke(eventBanner, UIKit.Colors.Gold, 2.5)
	UIKit.Gradient(eventBanner, Color3.fromRGB(255, 255, 255), Color3.fromRGB(150, 150, 150))
	eventLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, -90, 1, 0), Position = UDim2.fromOffset(8, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = eventBanner })
	eventTimer = UIKit.Label({ Text = "", Size = UDim2.fromOffset(80, 40), Position = UDim2.new(1, -86, 0, 0), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 20, Parent = eventBanner })

	-- شريط الزنزانة
	dungeonBanner = UIKit.Frame({ Size = UDim2.fromOffset(440, 40), Position = UDim2.new(0.5, -220, 0, 170), BackgroundColor3 = Color3.fromRGB(60, 0, 110), Visible = false, Parent = hud })
	UIKit.Corner(dungeonBanner, 12)
	UIKit.Stroke(dungeonBanner, Color3.fromRGB(157, 0, 255), 2.5)
	dungeonLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, -90, 1, 0), Position = UDim2.fromOffset(8, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = dungeonBanner })
	dungeonTimer = UIKit.Label({ Text = "", Size = UDim2.fromOffset(80, 40), Position = UDim2.new(1, -86, 0, 0), TextColor3 = Color3.fromRGB(200, 140, 255), MaxTextSize = 20, Parent = dungeonBanner })

	-- شريط الزعيم
	bossBar = UIKit.Frame({ Size = UDim2.fromOffset(520, 34), Position = UDim2.new(0.5, -260, 0, 128), BackgroundColor3 = Color3.fromRGB(15, 15, 25), Visible = false, Parent = hud })
	UIKit.Corner(bossBar, 10)
	UIKit.Stroke(bossBar, UIKit.Colors.Red, 3)
	bossFill = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(60, 200, 60), Parent = bossBar })
	UIKit.Corner(bossFill, 10)
	bossText = UIKit.Label({ Text = "", MaxTextSize = 20, TextStrokeTransparency = 0, Parent = bossBar })

	-- متتبع الدليل التعليمي
	questFrame = UIKit.Frame({ Size = UDim2.fromOffset(300, 92), Position = UDim2.new(1, -316, 0.5, -46), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.15, Visible = false, Parent = hud })
	UIKit.Corner(questFrame, 12)
	UIKit.Stroke(questFrame, UIKit.Colors.Cyan, 2)
	UIKit.Label({ Text = "🎓 الدليل", Size = UDim2.new(1, -12, 0, 22), Position = UDim2.fromOffset(6, 2), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UIKit.Colors.Cyan, MaxTextSize = 16, Parent = questFrame })
	questText = UIKit.Label({ Text = "", Size = UDim2.new(1, -12, 0, 36), Position = UDim2.fromOffset(6, 22), MaxTextSize = 15, Parent = questFrame })
	questProgress = UIKit.Label({ Text = "", Size = UDim2.new(0.5, 0, 0, 28), Position = UDim2.new(0, 6, 1, -32), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = questFrame })
	questClaim = UIKit.Button({ Text = "استلام", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(120, 28), Position = UDim2.new(1, -126, 1, -32), MaxTextSize = 16, Visible = false, Parent = questFrame }, function()
		local res = Remotes.Function("ClaimTutorial"):InvokeServer()
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)

	-- شريط الجرعات السريع
	potionBar = UIKit.Frame({ Size = UDim2.fromOffset(240, 52), Position = UDim2.new(1, -256, 1, -70), BackgroundTransparency = 1, Parent = hud })
	UIKit.List(potionBar, 6, true)
	for _, key in ipairs(Config.PotionOrder) do
		local cfg = Config.Potions[key]
		local btn = UIKit.Button({ Text = cfg.Icon .. " 0", Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(54, 48), MaxTextSize = 16, Parent = potionBar }, function()
			local res = Remotes.Function("UsePotion"):InvokeServer(key)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		potionButtons[key] = btn
	end

	-- أزرار القائمة اليسرى
	local menu = UIKit.Frame({ BackgroundTransparency = 1, Size = UDim2.fromOffset(80, 720), Position = UDim2.fromOffset(16, 206), Parent = hud })
	UIKit.List(menu, 2)
	local function menuBtn(icon: string, text: string, color: Color3, win: string)
		UIKit.IconButton(menu, icon, text, color, function()
			UIController.Open(win)
		end)
	end
	menuBtn("🐾", "Pets", UIKit.Colors.Green, "Inventory")
	menuBtn("🛒", "Shop", UIKit.Colors.Blue, "Shop")
	menuBtn("🗺️", "Zones", UIKit.Colors.Gold, "Zones")
	menuBtn("🎁", "Rewards", UIKit.Colors.Pink, "Rewards")
	menuBtn("📋", "Missions", UIKit.Colors.Cyan, "Missions")
	menuBtn("📊", "Stats", Color3.fromRGB(255, 140, 60), "Stats")
	menuBtn("🤝", "Trade", Color3.fromRGB(60, 120, 220), "Trade")
	menuBtn("🏪", "Market", Color3.fromRGB(255, 140, 60), "Market")
	menuBtn("🎫", "Season", UIKit.Colors.Gold, "Season")
	menuBtn("📖", "Index", UIKit.Colors.Purple, "Index")

	-- أزرار يمين
	local right = UIKit.Frame({ BackgroundTransparency = 1, Size = UDim2.fromOffset(80, 360), Position = UDim2.new(1, -96, 0, 16), Parent = hud })
	UIKit.List(right, 2)
	UIKit.IconButton(right, "⚙️", "Settings", UIKit.Colors.Panel3, function()
		UIController.Open("Settings")
	end)
	giftButton = UIKit.IconButton(right, "⏱️", "Gift", UIKit.Colors.Red, function()
		UIController.Open("Rewards")
	end)
	UIKit.IconButton(right, "🔑", "Codes", UIKit.Colors.Cyan, function()
		UIController.Open("Codes")
	end)
	UIKit.IconButton(right, "🏆", "Top", UIKit.Colors.Gold, function()
		UIController.Open("Leaderboards")
	end)
	UIKit.IconButton(right, "👑", "VIP", UIKit.Colors.Gold, function()
		if DataController.Owns("VIP") then
			Remotes.Event("Teleport"):FireServer(0)
		else
			Remotes.Event("PromptPurchase"):FireServer("Gamepass", "VIP")
		end
	end)
	adminButton = UIKit.IconButton(right, "🛠️", "Admin", UIKit.Colors.Red, function()
		UIController.Open("Admin")
	end)
	adminButton.Parent.Visible = false
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
	tokensLabel.Text = tostring(p.Tokens or 0)
	gemsLabel.Text = Format.Number(p.Gems or 0)
	powerLabel.Text = "⚔️ " .. Format.Number(p.Power or 0)
	rebirthLabel.Text = "🔁 " .. (p.Rebirths or 0)
	adminButton.Parent.Visible = p.IsAdmin == true
	for key, btn in pairs(potionButtons) do
		local n = p.PotionBag and p.PotionBag[key] or 0
		btn.Text = Config.Potions[key].Icon .. " " .. n
		btn.BackgroundColor3 = n > 0 and UIKit.Colors.Purple or UIKit.Colors.Panel3
	end
	-- الدليل
	local step = Config.Tutorial[p.Tutorial and p.Tutorial.Step or 999]
	if step then
		questFrame.Visible = true
		questText.Text = step.Text
		local prog = p.Tutorial.Progress
		local done = false
		if step.Type == "Zone" then
			done = p.UnlockedZones[tostring(step.Target)] == true
			questProgress.Text = done and "✅" or "🔒"
		else
			questProgress.Text = prog .. " / " .. step.Target
			done = prog >= step.Target
		end
		questClaim.Visible = done
	else
		questFrame.Visible = false
	end
end

local function updateTimers()
	local p = DataController.Profile
	if not p then
		return
	end
	local now = DataController.ServerTime()
	local parts = {}
	for _, key in ipairs(Config.PotionOrder) do
		local cfg = Config.Potions[key]
		local exp = p.Potions[key] or 0
		if exp > now then
			table.insert(parts, cfg.Icon .. " " .. Format.Time(exp - now))
		end
	end
	potionsLabel.Text = table.concat(parts, "   ")
	-- الحدث
	local state = Remotes.State()
	local eventId = state:GetAttribute("EventId")
	local ends = tonumber(state:GetAttribute("EventEnds")) or 0
	if type(eventId) == "string" and eventId ~= "" and ends > now then
		local e
		for _, ev in ipairs(Config.Events.List) do
			if ev.Id == eventId then
				e = ev
			end
		end
		eventBanner.Visible = true
		eventLabel.Text = e and (e.Name .. " • " .. e.Arabic) or eventId
		eventTimer.Text = Format.Time(ends - now)
	else
		eventBanner.Visible = false
		local nextAt = tonumber(state:GetAttribute("NextEvent")) or 0
		if nextAt > now and nextAt - now < 60 then
			eventBanner.Visible = true
			eventLabel.Text = "⏳ حدث قادم بعد"
			eventTimer.Text = Format.Time(nextAt - now)
		end
	end
	-- الزنزانة
	local dEnds = tonumber(state:GetAttribute("DungeonEnds")) or 0
	if dEnds > now then
		dungeonBanner.Visible = true
		dungeonTimer.Text = Format.Time(dEnds - now)
	else
		dungeonBanner.Visible = false
	end
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
		local pos = hrp.Position
		local vip = Config.Map.VIPOffset
		local market = Config.Map.MarketOffset
		local w2 = Config.Map.World2Offset
		local w3 = Config.Map.World3Offset
		local flat = Vector3.new(pos.X, 0, pos.Z)
		local idx
		if (flat - Vector3.new(vip.X, 0, vip.Z)).Magnitude < 220 then
			idx = 0
		elseif (flat - Vector3.new(market.X, 0, market.Z)).Magnitude < 260 then
			idx = -1
		elseif pos.X > w3.X - 500 then
			idx = math.clamp(Zones.WorldStart[3] + math.floor((pos.Z - w3.Z) / Config.Map.ZoneSpacing + 0.5), Zones.WorldStart[3], #Zones.List)
		elseif pos.X > w2.X - 500 then
			idx = math.clamp(Zones.WorldStart[2] + math.floor((pos.Z - w2.Z) / Config.Map.ZoneSpacing + 0.5), Zones.WorldStart[2], Zones.WorldStart[3] - 1)
		else
			idx = math.clamp(math.floor(pos.Z / Config.Map.ZoneSpacing + 0.5) + 1, 1, Zones.WorldStart[2] - 1)
		end
		local zone = Zones.Get(idx)
		if zone then
			zoneLabel.Text = zone.Name
		end
	end
end

-- ===== نافذة المناطق =====
local function buildZonesWindow()
	local w = UIKit.Window(gui, "Zones", "🗺️ المناطق", UDim2.fromOffset(560, 600), UIKit.Colors.Gold)
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 8)
	local rows: { [number]: { Frame: Frame, Button: TextButton, Status: TextLabel } } = {}
	local all = table.clone(Zones.List)
	table.insert(all, Zones.VIP)
	table.insert(all, Zones.Market)
	for _, zone in ipairs(all) do
		if zone.Index == Zones.WorldStart[2] then
			UIKit.Label({ Text = "🌐 العالم الثاني — Tech World (يتطلب ريبيرث)", Size = UDim2.new(1, -8, 0, 30), TextColor3 = UIKit.Colors.Cyan, MaxTextSize = 20, Parent = scroll })
		elseif zone.Index == Zones.WorldStart[3] then
			UIKit.Label({ Text = "✨ العالم الثالث — Mythic Realm (يتطلب 3 ريبيرث)", Size = UDim2.new(1, -8, 0, 30), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 20, Parent = scroll })
		elseif zone.Index == 0 then
			UIKit.Label({ Text = "🏝️ جزر خاصة", Size = UDim2.new(1, -8, 0, 30), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 20, Parent = scroll })
		end
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
			elseif zone.Index == -1 then
				Remotes.Event("Teleport"):FireServer(-1)
				UIController.Close()
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
			elseif idx == -1 then
				row.Button.Text = "انتقال"
				row.Button.BackgroundColor3 = Color3.fromRGB(255, 140, 60)
				row.Status.Text = "سوق عالمي، أكشاك، بيضة البازار 💠"
			elseif (p.Rebirths or 0) < Zones.RebirthRequired(idx) then
				row.Button.Text = "🔁 ريبيرث"
				row.Button.BackgroundColor3 = UIKit.Colors.Panel3
				row.Status.Text = "يتطلب " .. Zones.RebirthRequired(idx) .. " ريبيرث"
			elseif p.UnlockedZones[tostring(idx)] then
				row.Button.Text = "انتقال"
				row.Button.BackgroundColor3 = UIKit.Colors.Green
				row.Status.Text = "✅ مفتوحة  •  x" .. Format.Number(zone.Multiplier)
			elseif Zones.IsWorldStart(idx) or p.UnlockedZones[tostring(idx - 1)] then
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
end

-- ===== نافذة المكافآت =====
local function buildRewardsWindow()
	local w = UIKit.Window(gui, "Rewards", "🎁 المكافآت", UDim2.fromOffset(760, 600), UIKit.Colors.Pink)
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 10)

	UIKit.Label({ Text = "📅 المكافأة اليومية", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 24, Parent = scroll })
	local dailyRow = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 110), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(dailyRow, 6, true)
	local dailyTiles = {}
	for i, r in ipairs(Config.DailyRewards) do
		local tile = UIKit.Frame({ Size = UDim2.fromOffset(92, 100), BackgroundColor3 = UIKit.Colors.Panel2, Parent = dailyRow })
		UIKit.Corner(tile, 10)
		local stroke = UIKit.Stroke(tile, UIKit.Colors.Panel3, 2)
		UIKit.Label({ Text = "يوم " .. i, Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = tile })
		local text = "💎 " .. r.Diamonds
		if r.Potion then
			text = text .. "\n🧪"
		end
		if r.Spins then
			text = text .. " 🎡" .. r.Spins
		end
		UIKit.Label({ Text = text, Size = UDim2.new(1, 0, 1, -24), Position = UDim2.fromOffset(0, 22), MaxTextSize = 18, Parent = tile })
		dailyTiles[i] = { Tile = tile, Stroke = stroke }
	end
	local dailyBtnRow = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(dailyBtnRow, 10, true)
	local dailyBtn = UIKit.Button({ Text = "استلام", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(200, 44), MaxTextSize = 22, Parent = dailyBtnRow })
	local vipBtn = UIKit.Button({ Text = "👑 صندوق VIP اليومي", Color = UIKit.Colors.Gold, Size = UDim2.fromOffset(240, 44), MaxTextSize = 20, Parent = dailyBtnRow })
	local dailyStatus = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = scroll })
	dailyBtn.Activated:Connect(function()
		local res = Remotes.Function("ClaimDaily"):InvokeServer()
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)
	vipBtn.Activated:Connect(function()
		if not DataController.Owns("VIP") then
			Remotes.Event("PromptPurchase"):FireServer("Gamepass", "VIP")
			return
		end
		local res = Remotes.Function("ClaimVIPDaily"):InvokeServer()
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)

	UIKit.Label({ Text = "⏱️ مكافآت وقت اللعب", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 24, Parent = scroll })
	local ptRow = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 250), BackgroundTransparency = 1, Parent = scroll })
	UIKit.Grid(ptRow, UDim2.fromOffset(92, 116), 6)
	local ptTiles = {}
	for i, r in ipairs(Config.PlaytimeRewards) do
		local tile = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = ptRow })
		UIKit.Corner(tile, 10)
		UIKit.Label({ Text = r.Minutes .. " دقيقة", Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = tile })
		UIKit.Label({ Text = "💎 " .. r.Diamonds .. (r.Potion and "\n🧪" or "") .. (r.Spins and " 🎡" or ""), Size = UDim2.new(1, 0, 0, 46), Position = UDim2.fromOffset(0, 22), MaxTextSize = 18, Parent = tile })
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
		local day = math.floor(now / 86400)
		vipBtn.BackgroundColor3 = (DataController.Owns("VIP") and p.VIPDaily ~= day) and UIKit.Colors.Gold or UIKit.Colors.Panel3
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
		local lines = {}
		if Config.GroupId > 0 then
			table.insert(lines, p.InGroup and "✅ مكافأة المجموعة مفعلة: +25% حظ و +25% عملات" or "انضم لمجموعة اللعبة واحصل على +25% حظ و +25% عملات")
		end
		if p.Premium then
			table.insert(lines, "⭐ Premium: +10% حظ و +10% عملات")
		end
		groupLabel.Text = table.concat(lines, "\n")
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
	local w = UIKit.Window(gui, "Index", "📖 فهرس الحيوانات", UDim2.fromOffset(820, 600), UIKit.Colors.Purple)
	local counter = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 26), MaxTextSize = 20, TextColor3 = UIKit.Colors.Muted, Parent = w.Content })
	-- مكافآت إكمال فهرس كل بيضة
	local eggRow = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 0, 62), Position = UDim2.fromOffset(0, 28), ScrollingDirection = Enum.ScrollingDirection.X, AutomaticCanvasSize = Enum.AutomaticSize.X })
	UIKit.List(eggRow, 6, true)
	local eggChips: { [string]: TextButton } = {}
	for i, egg in ipairs(Eggs.List) do
		eggChips[egg.Id] = UIKit.Button({ LayoutOrder = i, Text = egg.Name, Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(150, 50), MaxTextSize = 13, Parent = eggRow }, function()
			local res = Remotes.Function("PetAction"):InvokeServer("ClaimIndex", { EggId = egg.Id })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
	end
	local scroll = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -96), Position = UDim2.fromOffset(0, 96) })
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
			local ab = Config.Abilities[def.Shape]
			UIKit.Label({ Text = (ab and (ab.Icon .. " ") or "") .. def.Rarity, Size = UDim2.new(1, 0, 0, 16), Position = UDim2.fromOffset(0, 120), TextColor3 = Rarities.Color(def.Rarity), MaxTextSize = 13, Parent = card })
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
		for _, egg in ipairs(Eggs.List) do
			local chip = eggChips[egg.Id]
			local have, total = 0, #egg.Pets
			for _, entry in ipairs(egg.Pets) do
				if p.Index[entry.Pet] then
					have += 1
				end
			end
			local claimed = p.IndexClaimed and p.IndexClaimed[egg.Id]
			local reward = Config.IndexReward(math.max(1, egg.Zone))
			chip.Text = egg.Name .. "  " .. have .. "/" .. total .. (claimed and "  ✅" or ("\n💎" .. Format.Number(reward.Diamonds) .. " 💠" .. reward.Gems))
			chip.BackgroundColor3 = claimed and UIKit.Colors.Panel3 or (have >= total and UIKit.Colors.Green or UIKit.Colors.Panel3)
		end
	end
	UIController.Register("Index", w, refresh)
end

-- ===== الإعدادات =====
local function buildSettingsWindow()
	local w = UIKit.Window(gui, "Settings", "⚙️ الإعدادات", UDim2.fromOffset(460, 400), UIKit.Colors.Panel3)
	UIKit.List(w.Content, 8)
	local function toggle(text: string, key: string, defaultOn: boolean)
		local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 48), BackgroundColor3 = UIKit.Colors.Panel2, Parent = w.Content })
		UIKit.Corner(row, 10)
		UIKit.Label({ Text = text, Size = UDim2.new(1, -120, 1, 0), Position = UDim2.fromOffset(12, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = row })
		local btn = UIKit.Button({ Text = "ON", Size = UDim2.fromOffset(90, 36), Position = UDim2.new(1, -100, 0, 6), MaxTextSize = 18, Parent = row })
		local function refresh()
			local p = DataController.Profile
			local v = p and p.Settings and p.Settings[key]
			local on = if v == nil then defaultOn else v == true
			btn.Text = on and "ON" or "OFF"
			btn.BackgroundColor3 = on and UIKit.Colors.Green or UIKit.Colors.Red
		end
		btn.Activated:Connect(function()
			local p = DataController.Profile
			if p then
				local v = p.Settings[key]
				local on = if v == nil then defaultOn else v == true
				p.Settings[key] = not on
				Remotes.Function("PetAction"):InvokeServer("Setting", { Key = key, Value = p.Settings[key] })
				refresh()
			end
		end)
		DataController.Changed:Connect(refresh)
		refresh()
	end
	toggle("🎵 الموسيقى", "Music", true)
	toggle("🙈 إخفاء حيوانات الآخرين", "HideOthersPets", false)
	toggle("⚡ رسومات منخفضة", "LowGraphics", false)
	toggle("🔢 أرقام الضرر", "DamageNumbers", true)

	-- الحذف التلقائي
	local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 80), BackgroundColor3 = UIKit.Colors.Panel2, Parent = w.Content })
	UIKit.Corner(row, 10)
	UIKit.Label({ Text = "🗑️ حذف تلقائي بعد الفتح (حتى الندرة):", Size = UDim2.new(1, -12, 0, 28), Position = UDim2.fromOffset(12, 4), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 18, Parent = row })
	local opts = UIKit.Frame({ Size = UDim2.new(1, -12, 0, 36), Position = UDim2.fromOffset(6, 38), BackgroundTransparency = 1, Parent = row })
	UIKit.List(opts, 6, true)
	local optButtons = {}
	for rank = 0, 4 do
		local label = rank == 0 and "إيقاف" or Rarities.Order[rank]
		local btn = UIKit.Button({ Text = label, Size = UDim2.fromOffset(80, 34), MaxTextSize = 15, Parent = opts }, function()
			Remotes.Function("PetAction"):InvokeServer("Setting", { Key = "AutoDeleteRank", Value = rank })
		end)
		optButtons[rank] = btn
	end
	local function refreshAuto()
		local p = DataController.Profile
		local cur = p and p.Settings and p.Settings.AutoDeleteRank or 0
		for rank, btn in pairs(optButtons) do
			btn.BackgroundColor3 = rank == cur and UIKit.Colors.Green or UIKit.Colors.Panel3
		end
	end
	DataController.Changed:Connect(refreshAuto)
	refreshAuto()
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

	notifHolder = UIKit.Frame({ Name = "Notifications", BackgroundTransparency = 1, Size = UDim2.fromOffset(380, 300), Position = UDim2.new(0.5, -190, 0, 170), Parent = gui })
	UIKit.List(notifHolder, 6, false, true)

	buildHUD()
	buildZonesWindow()
	buildRewardsWindow()
	buildCodesWindow()
	buildIndexWindow()
	buildSettingsWindow()

	DataController.Changed:Connect(function(p)
		refreshHUD(p)
		if currentWindow and refreshers[currentWindow] then
			refreshers[currentWindow]()
		end
	end)
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
	Remotes.Event("BossUpdate").OnClientEvent:Connect(function(data)
		if data.Active then
			bossBar.Visible = true
			local ratio = math.clamp((data.Health or 0) / math.max(1, data.MaxHealth or 1), 0, 1)
			bossFill.Size = UDim2.fromScale(ratio, 1)
			bossText.Text = "👹 " .. (data.Name or Config.Events.Boss.Name) .. "  " .. Format.Number(data.Health or 0) .. " / " .. Format.Number(data.MaxHealth or 0)
		else
			bossBar.Visible = false
		end
	end)

	Remotes.Event("DungeonUpdate").OnClientEvent:Connect(function(data)
		dungeonLabel.Text = data.Text or ""
		if data.Active then
			dungeonBanner.Visible = true
		end
	end)
	Remotes.Event("EventEffect").OnClientEvent:Connect(function(data)
		if data.Type == "WelcomeBack" then
			local popup = UIKit.Frame({ Size = UDim2.fromOffset(420, 150), Position = UDim2.new(0.5, -210, 0, 220), BackgroundColor3 = UIKit.Colors.Panel, ZIndex = 20, Parent = gui })
			UIKit.Corner(popup, 16)
			UIKit.Stroke(popup, UIKit.Colors.Gold, 3)
			UIKit.Label({ Text = "👋 أهلاً بعودتك!", Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 8), MaxTextSize = 26, ZIndex = 21, Parent = popup })
			UIKit.Label({ Text = "حيواناتك جمعت أثناء غيابك (" .. Format.Time(data.Seconds or 0) .. "):\n💰 " .. Format.Number(data.Coins or 0), Size = UDim2.new(1, -16, 0, 60), Position = UDim2.fromOffset(8, 48), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 20, ZIndex = 21, Parent = popup })
			UIKit.Button({ Text = "رائع!", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(160, 36), Position = UDim2.new(0.5, -80, 1, -44), MaxTextSize = 18, ZIndex = 21, Parent = popup }, function()
				popup:Destroy()
			end)
			UIKit.Pop(popup)
		end
	end)

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.Escape or input.KeyCode == Enum.KeyCode.X then
			UIController.Close()
		elseif input.KeyCode == Enum.KeyCode.Q then
			local res = Remotes.Function("Hoverboard"):InvokeServer("Toggle", "")
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end
	end)
end

return UIController

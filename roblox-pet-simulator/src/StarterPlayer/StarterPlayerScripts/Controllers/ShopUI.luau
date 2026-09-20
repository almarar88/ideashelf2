--!strict
-- المتجر: الجيم باس، الألماس والجرعات، الترقيات، الهوفربورد
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)

local ShopUI = {}

local function upgradeCost(u: any, level: number): number?
	if level >= u.MaxLevel then
		return nil
	end
	return math.floor(u.BaseCost * (u.CostMult ^ level) + 0.5)
end

function ShopUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Shop", "🛒 المتجر", UDim2.fromOffset(860, 620), UIKit.Colors.Blue)

	local tabs = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.List(tabs, 6, true, true)
	local pages: { [string]: ScrollingFrame } = {}
	local tabButtons: { [string]: TextButton } = {}
	local function showPage(name: string)
		for n, page in pairs(pages) do
			page.Visible = n == name
			tabButtons[n].BackgroundColor3 = n == name and UIKit.Colors.Blue or UIKit.Colors.Panel3
		end
	end
	for _, info in ipairs({ { "Gamepasses", "🎟️ جيم باس" }, { "Diamonds", "💎 ألماس" }, { "Upgrades", "⬆️ ترقيات" }, { "Potions", "🧪 جرعات" }, { "Boards", "🛹 هوفربورد" } }) do
		tabButtons[info[1]] = UIKit.Button({ Text = info[2], Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(158, 40), MaxTextSize = 17, Parent = tabs }, function()
			showPage(info[1])
		end)
		pages[info[1]] = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -52), Position = UDim2.fromOffset(0, 52), Visible = false })
		UIKit.Grid(pages[info[1]], UDim2.fromOffset(260, 150), 10)
	end

	local passCards: { [string]: TextButton } = {}
	for i, gp in ipairs(Config.GamepassInfo) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Gamepasses })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, UIKit.Colors.Gold, 2)
		UIKit.Label({ Text = gp.Icon, Size = UDim2.fromOffset(50, 50), Position = UDim2.fromOffset(8, 6), Parent = card })
		UIKit.Label({ Text = gp.Name, Size = UDim2.new(1, -70, 0, 30), Position = UDim2.fromOffset(64, 10), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = card })
		UIKit.Label({ Text = gp.Desc, Size = UDim2.new(1, -16, 0, 50), Position = UDim2.fromOffset(8, 56), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, TextYAlignment = Enum.TextYAlignment.Top, Parent = card })
		passCards[gp.Key] = UIKit.Button({ Text = "شراء", Color = UIKit.Colors.Green, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			Remotes.Event("PromptPurchase"):FireServer("Gamepass", gp.Key)
		end)
	end

	for i, pr in ipairs(Config.DevProductInfo) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Diamonds })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, UIKit.Colors.Cyan, 2)
		UIKit.Label({ Text = pr.Icon, Size = UDim2.fromOffset(60, 60), Position = UDim2.new(0.5, -30, 0, 8), Parent = card })
		UIKit.Label({ Text = pr.Name, Size = UDim2.new(1, -16, 0, 30), Position = UDim2.fromOffset(8, 70), MaxTextSize = 20, Parent = card })
		UIKit.Button({ Text = "شراء", Color = UIKit.Colors.Cyan, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			Remotes.Event("PromptPurchase"):FireServer("Product", pr.Key)
		end)
	end

	local upgradeRows: { [string]: { Btn: TextButton, Level: TextLabel, Bar: Frame } } = {}
	for i, u in ipairs(Config.Upgrades) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Upgrades })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, UIKit.Colors.Purple, 2)
		UIKit.Label({ Text = u.Icon, Size = UDim2.fromOffset(50, 50), Position = UDim2.fromOffset(8, 6), Parent = card })
		UIKit.Label({ Text = u.Name, Size = UDim2.new(1, -70, 0, 30), Position = UDim2.fromOffset(64, 10), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = card })
		UIKit.Label({ Text = u.Desc, Size = UDim2.new(1, -16, 0, 22), Position = UDim2.fromOffset(8, 54), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 15, Parent = card })
		local level = UIKit.Label({ Text = "", Size = UDim2.new(1, -16, 0, 20), Position = UDim2.fromOffset(8, 76), MaxTextSize = 15, Parent = card })
		local _, fill = UIKit.ProgressBar(card, UIKit.Colors.Purple, UDim2.new(1, -16, 0, 8), UDim2.fromOffset(8, 98))
		local btn = UIKit.Button({ Text = "", Color = UIKit.Colors.Purple, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			local res = Remotes.Function("BuyUpgrade"):InvokeServer(u.Key)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		upgradeRows[u.Key] = { Btn = btn, Level = level, Bar = fill }
	end

	-- الجرعات
	local potionRows: { [string]: { Btn: TextButton, Count: TextLabel } } = {}
	for i, key in ipairs(Config.PotionOrder) do
		local cfg = Config.Potions[key]
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Potions })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, UIKit.Colors.Purple, 2)
		UIKit.Label({ Text = cfg.Icon, Size = UDim2.fromOffset(60, 60), Position = UDim2.new(0.5, -30, 0, 6), Parent = card })
		UIKit.Label({ Text = cfg.Name .. " (x" .. cfg.Mult .. " لمدة " .. Format.Time(cfg.Duration) .. ")", Size = UDim2.new(1, -16, 0, 26), Position = UDim2.fromOffset(8, 66), MaxTextSize = 16, Parent = card })
		local count = UIKit.Label({ Text = "", Size = UDim2.new(1, -16, 0, 20), Position = UDim2.fromOffset(8, 90), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, Parent = card })
		local btn = UIKit.Button({ Text = "💎 " .. cfg.Cost, Color = UIKit.Colors.Purple, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			local res = Remotes.Function("BuyPotion"):InvokeServer(key)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		potionRows[key] = { Btn = btn, Count = count }
	end

	-- الهوفربورد
	local boardRows: { [string]: { Btn: TextButton, Swatch: Frame } } = {}
	for i, b in ipairs(Config.Hoverboards) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Boards })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, b.Color, 2)
		local swatch = UIKit.Frame({ Size = UDim2.fromOffset(120, 22), Position = UDim2.new(0.5, -60, 0, 18), BackgroundColor3 = b.Color, Parent = card })
		UIKit.Corner(swatch, 11)
		UIKit.Label({ Text = b.Icon .. " " .. b.Name, Size = UDim2.new(1, -16, 0, 28), Position = UDim2.fromOffset(8, 48), MaxTextSize = 20, Parent = card })
		UIKit.Label({ Text = "+" .. b.Speed .. " سرعة  •  اضغط Q للركوب", Size = UDim2.new(1, -16, 0, 22), Position = UDim2.fromOffset(8, 78), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, Parent = card })
		local btn = UIKit.Button({ Text = "💎 " .. Format.Number(b.Cost), Color = UIKit.Colors.Cyan, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			local p = DataController.Profile
			local owned = p and p.Hoverboards.Owned[b.Id]
			local res = Remotes.Function("Hoverboard"):InvokeServer(owned and "Equip" or "Buy", b.Id)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		boardRows[b.Id] = { Btn = btn, Swatch = swatch }
	end

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		for key, btn in pairs(passCards) do
			local owned = DataController.Owns(key)
			btn.Text = owned and "✅ مملوك" or "شراء"
			btn.BackgroundColor3 = owned and UIKit.Colors.Panel3 or UIKit.Colors.Green
		end
		for _, u in ipairs(Config.Upgrades) do
			local row = upgradeRows[u.Key]
			local level = p.Upgrades[u.Key] or 0
			local cost = upgradeCost(u, level)
			row.Level.Text = "المستوى " .. level .. " / " .. u.MaxLevel
			row.Bar.Size = UDim2.fromScale(level / u.MaxLevel, 1)
			if cost then
				row.Btn.Text = "💎 " .. Format.Number(cost)
				row.Btn.BackgroundColor3 = p.Diamonds >= cost and UIKit.Colors.Purple or UIKit.Colors.Panel3
			else
				row.Btn.Text = "الحد الأقصى"
				row.Btn.BackgroundColor3 = UIKit.Colors.Panel3
			end
		end
		for key, row in pairs(potionRows) do
			row.Count.Text = "في الحقيبة: " .. (p.PotionBag[key] or 0)
			row.Btn.BackgroundColor3 = p.Diamonds >= Config.Potions[key].Cost and UIKit.Colors.Purple or UIKit.Colors.Panel3
		end
		for _, b in ipairs(Config.Hoverboards) do
			local row = boardRows[b.Id]
			local owned = p.Hoverboards.Owned[b.Id]
			if owned then
				local eq = p.Hoverboards.Equipped == b.Id
				row.Btn.Text = eq and "✅ مجهز" or "تجهيز"
				row.Btn.BackgroundColor3 = eq and UIKit.Colors.Panel3 or UIKit.Colors.Green
			else
				row.Btn.Text = "💎 " .. Format.Number(b.Cost)
				row.Btn.BackgroundColor3 = p.Diamonds >= b.Cost and UIKit.Colors.Cyan or UIKit.Colors.Panel3
			end
		end
	end

	showPage("Gamepasses")
	UIController.Register("Shop", w, refresh)
end

return ShopUI

--!strict
-- المتجر: الجيم باس، الألماس والجرعات، الترقيات
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
	local w = UIKit.Window(gui, "Shop", "🛒 المتجر", UDim2.fromOffset(820, 600), UIKit.Colors.Blue)

	local tabs = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.List(tabs, 8, true, true)
	local pages: { [string]: ScrollingFrame } = {}
	local tabButtons: { [string]: TextButton } = {}
	local function showPage(name: string)
		for n, page in pairs(pages) do
			page.Visible = n == name
			tabButtons[n].BackgroundColor3 = n == name and UIKit.Colors.Blue or UIKit.Colors.Panel3
		end
	end
	for _, info in ipairs({ { "Gamepasses", "🎟️ جيم باس" }, { "Diamonds", "💎 ألماس وجرعات" }, { "Upgrades", "⬆️ ترقيات" } }) do
		tabButtons[info[1]] = UIKit.Button({ Text = info[2], Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(220, 40), MaxTextSize = 20, Parent = tabs }, function()
			showPage(info[1])
		end)
		pages[info[1]] = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -52), Position = UDim2.fromOffset(0, 52), Visible = false })
		UIKit.Grid(pages[info[1]], UDim2.fromOffset(250, 150), 10)
	end

	-- الجيم باس
	local passCards: { [string]: TextButton } = {}
	for i, gp in ipairs(Config.GamepassInfo) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = pages.Gamepasses })
		UIKit.Corner(card, 14)
		UIKit.Stroke(card, UIKit.Colors.Gold, 2)
		UIKit.Label({ Text = gp.Icon, Size = UDim2.fromOffset(50, 50), Position = UDim2.fromOffset(8, 6), Parent = card })
		UIKit.Label({ Text = gp.Name, Size = UDim2.new(1, -70, 0, 30), Position = UDim2.fromOffset(64, 10), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = card })
		UIKit.Label({ Text = gp.Desc, Size = UDim2.new(1, -16, 0, 50), Position = UDim2.fromOffset(8, 56), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 15, TextYAlignment = Enum.TextYAlignment.Top, Parent = card })
		passCards[gp.Key] = UIKit.Button({ Text = "شراء", Color = UIKit.Colors.Green, Size = UDim2.new(1, -16, 0, 34), Position = UDim2.new(0, 8, 1, -40), MaxTextSize = 18, Parent = card }, function()
			Remotes.Event("PromptPurchase"):FireServer("Gamepass", gp.Key)
		end)
	end

	-- الألماس والجرعات
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

	-- الترقيات
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
	end

	showPage("Gamepasses")
	UIController.Register("Shop", w, refresh)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Shop") then
			refresh()
		end
	end)
end

function ShopUI.OpenTab(tab: string)
	UIController.Open("Shop")
end

return ShopUI

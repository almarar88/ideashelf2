--!strict
-- باس الموسم
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)

local SeasonUI = {}

local function describe(r: any): string
	local parts = {}
	if r.Diamonds then table.insert(parts, "💎" .. Format.Number(r.Diamonds)) end
	if r.Gems then table.insert(parts, "💠" .. r.Gems) end
	if r.Potion then table.insert(parts, "🧪" .. (r.Count or 1)) end
	if r.Spins then table.insert(parts, "🎡" .. r.Spins) end
	if r.Pet then table.insert(parts, "🐾" .. (r.Variant and (r.Variant .. " ") or "") .. r.Pet) end
	return table.concat(parts, " ")
end

function SeasonUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Season", "🎫 " .. Config.Season.Name, UDim2.fromOffset(900, 600), UIKit.Colors.Gold)
	local header = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 70), BackgroundColor3 = UIKit.Colors.Panel2, Parent = w.Content })
	UIKit.Corner(header, 12)
	local tierLabel = UIKit.Label({ Text = "", Size = UDim2.new(0.5, 0, 0, 30), Position = UDim2.fromOffset(12, 4), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = header })
	local _, fill, xpLabel = UIKit.ProgressBar(header, UIKit.Colors.Gold, UDim2.new(0.5, -24, 0, 20), UDim2.fromOffset(12, 40))
	local passBtn = UIKit.Button({ Text = "🎫 شراء Season Pass", Color = UIKit.Colors.Purple, Size = UDim2.fromOffset(220, 40), Position = UDim2.new(1, -460, 0, 15), MaxTextSize = 17, Parent = header }, function()
		Remotes.Event("PromptPurchase"):FireServer("Gamepass", "SeasonPass")
	end)
	UIKit.Button({ Text = "استلام الكل", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(220, 40), Position = UDim2.new(1, -232, 0, 15), MaxTextSize = 17, Parent = header }, function()
		local res = Remotes.Function("Season"):InvokeServer("ClaimAll", {})
		if res.ok then
			UIController.Notify("🎫 استلمت " .. (res.count or 0) .. " مكافأة", UIKit.Colors.Green)
		end
	end)
	local scroll = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -80), Position = UDim2.fromOffset(0, 80), ScrollingDirection = Enum.ScrollingDirection.X, AutomaticCanvasSize = Enum.AutomaticSize.X })
	UIKit.List(scroll, 6, true)
	local columns = {}
	for t = 1, Config.Season.Tiers do
		local col = UIKit.Frame({ LayoutOrder = t, Size = UDim2.new(0, 120, 1, -10), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
		UIKit.Corner(col, 12)
		local title = UIKit.Label({ Text = "المستوى " .. t, Size = UDim2.new(1, 0, 0, 26), MaxTextSize = 16, Parent = col })
		local freeCard = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 150), Position = UDim2.fromOffset(4, 30), BackgroundColor3 = UIKit.Colors.Panel3, Parent = col })
		UIKit.Corner(freeCard, 10)
		UIKit.Label({ Text = "مجاني", Size = UDim2.new(1, 0, 0, 20), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 13, Parent = freeCard })
		UIKit.Label({ Text = describe(Config.SeasonReward(t, false)), Size = UDim2.new(1, -6, 0, 80), Position = UDim2.fromOffset(3, 20), MaxTextSize = 14, Parent = freeCard })
		local freeBtn = UIKit.Button({ Text = "", Size = UDim2.new(1, -10, 0, 30), Position = UDim2.new(0, 5, 1, -36), MaxTextSize = 14, Parent = freeCard }, function()
			local res = Remotes.Function("Season"):InvokeServer("Claim", { Tier = t, Premium = false })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		local premCard = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 150), Position = UDim2.fromOffset(4, 186), BackgroundColor3 = Color3.fromRGB(70, 50, 30), Parent = col })
		UIKit.Corner(premCard, 10)
		UIKit.Stroke(premCard, UIKit.Colors.Gold, 1.5)
		UIKit.Label({ Text = "🎫 مميز", Size = UDim2.new(1, 0, 0, 20), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 13, Parent = premCard })
		UIKit.Label({ Text = describe(Config.SeasonReward(t, true)), Size = UDim2.new(1, -6, 0, 80), Position = UDim2.fromOffset(3, 20), MaxTextSize = 14, Parent = premCard })
		local premBtn = UIKit.Button({ Text = "", Size = UDim2.new(1, -10, 0, 30), Position = UDim2.new(0, 5, 1, -36), MaxTextSize = 14, Parent = premCard }, function()
			local res = Remotes.Function("Season"):InvokeServer("Claim", { Tier = t, Premium = true })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		columns[t] = { Title = title, Free = freeBtn, Prem = premBtn, Col = col }
	end
	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local tier = p.SeasonTier or 0
		tierLabel.Text = "المستوى " .. tier .. " / " .. Config.Season.Tiers .. "   •   XP: " .. Format.Number(p.Season.XP or 0)
		if (p.SeasonNeeded or 0) > 0 then
			fill.Size = UDim2.fromScale(math.clamp((p.SeasonInto or 0) / p.SeasonNeeded, 0, 1), 1)
			xpLabel.Text = Format.Number(p.SeasonInto or 0) .. " / " .. Format.Number(p.SeasonNeeded)
		else
			fill.Size = UDim2.fromScale(1, 1)
			xpLabel.Text = "MAX"
		end
		local hasPass = DataController.Owns("SeasonPass")
		passBtn.Text = hasPass and "✅ Season Pass مفعل" or "🎫 شراء Season Pass"
		passBtn.BackgroundColor3 = hasPass and UIKit.Colors.Panel3 or UIKit.Colors.Purple
		for t, c in pairs(columns) do
			local reached = t <= tier
			c.Col.BackgroundColor3 = reached and UIKit.Colors.Panel2 or Color3.fromRGB(25, 27, 45)
			local fc = p.Season.Claimed[tostring(t)]
			c.Free.Text = fc and "✅" or (reached and "استلام" or "🔒")
			c.Free.BackgroundColor3 = fc and UIKit.Colors.Panel3 or (reached and UIKit.Colors.Green or UIKit.Colors.Panel3)
			local pc = p.Season.PremiumClaimed[tostring(t)]
			c.Prem.Text = pc and "✅" or (reached and (hasPass and "استلام" or "🎫") or "🔒")
			c.Prem.BackgroundColor3 = pc and UIKit.Colors.Panel3 or ((reached and hasPass) and UIKit.Colors.Gold or UIKit.Colors.Panel3)
		end
	end
	UIController.Register("Season", w, refresh)
end

return SeasonUI

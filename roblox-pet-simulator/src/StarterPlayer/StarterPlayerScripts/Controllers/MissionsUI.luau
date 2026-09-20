--!strict
-- المهام اليومية + الإنجازات
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)

local MissionsUI = {}

local function describe(reward: any): string
	local parts = {}
	if reward.Coins then
		table.insert(parts, "💰 " .. Format.Number(reward.Coins))
	end
	if reward.Diamonds then
		table.insert(parts, "💎 " .. reward.Diamonds)
	end
	if reward.Potion then
		table.insert(parts, "🧪 " .. reward.Potion)
	end
	if reward.Pet then
		table.insert(parts, "🐾 " .. reward.Pet)
	end
	if reward.Spins then
		table.insert(parts, "🎡 " .. reward.Spins)
	end
	return table.concat(parts, " ")
end

function MissionsUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Missions", "📋 المهام والإنجازات", UDim2.fromOffset(760, 600), UIKit.Colors.Cyan)
	local tabs = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.List(tabs, 8, true, true)
	local pages: { [string]: ScrollingFrame } = {}
	local tabButtons: { [string]: TextButton } = {}
	local function showPage(name: string)
		for n, page in pairs(pages) do
			page.Visible = n == name
			tabButtons[n].BackgroundColor3 = n == name and UIKit.Colors.Cyan or UIKit.Colors.Panel3
		end
	end
	for _, info in ipairs({ { "Missions", "📋 مهام اليوم" }, { "Achievements", "🏅 الإنجازات" } }) do
		tabButtons[info[1]] = UIKit.Button({ Text = info[2], Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(240, 40), MaxTextSize = 20, Parent = tabs }, function()
			showPage(info[1])
		end)
		pages[info[1]] = UIKit.Scroll(w.Content, { Size = UDim2.new(1, 0, 1, -52), Position = UDim2.fromOffset(0, 52), Visible = false })
		UIKit.List(pages[info[1]], 8)
	end

	local resetLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, -8, 0, 24), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = pages.Missions })
	local missionRows: { Frame } = {}

	local function rowFor(parent: Instance, title: string, sub: string, progress: number, target: number, claimed: boolean, onClaim: () -> ()): Frame
		local row = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 74), BackgroundColor3 = UIKit.Colors.Panel2, Parent = parent })
		UIKit.Corner(row, 12)
		UIKit.Stroke(row, claimed and UIKit.Colors.Panel3 or (progress >= target and UIKit.Colors.Green or UIKit.Colors.Panel3), 2)
		UIKit.Label({ Text = title, Size = UDim2.new(1, -190, 0, 28), Position = UDim2.fromOffset(12, 6), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = row })
		UIKit.Label({ Text = sub, Size = UDim2.new(1, -190, 0, 20), Position = UDim2.fromOffset(12, 32), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UIKit.Colors.Gold, MaxTextSize = 15, Parent = row })
		local _, fill, label = UIKit.ProgressBar(row, UIKit.Colors.Cyan, UDim2.new(1, -200, 0, 12), UDim2.fromOffset(12, 56))
		fill.Size = UDim2.fromScale(math.clamp(progress / math.max(1, target), 0, 1), 1)
		label.Text = ""
		local btn = UIKit.Button({ Text = claimed and "✅" or (progress >= target and "استلام" or Format.Number(progress) .. " / " .. Format.Number(target)), Color = claimed and UIKit.Colors.Panel3 or (progress >= target and UIKit.Colors.Green or UIKit.Colors.Panel3), Size = UDim2.fromOffset(160, 44), Position = UDim2.new(1, -170, 0, 15), MaxTextSize = 17, Parent = row })
		if not claimed and progress >= target then
			btn.Activated:Connect(onClaim)
		end
		return row
	end

	local achRows: { Frame } = {}

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		for _, r in ipairs(missionRows) do
			r:Destroy()
		end
		missionRows = {}
		local now = DataController.ServerTime()
		resetLabel.Text = "تتجدد المهام بعد " .. Format.Time(86400 - (now % 86400))
		for i, m in ipairs(p.Missions.List or {}) do
			local title = (m.Name:gsub("{n}", Format.Number(m.Target)))
			local row = rowFor(pages.Missions, title, "المكافأة: " .. describe(m.Reward), m.Progress, m.Target, m.Claimed, function()
				local res = Remotes.Function("ClaimMission"):InvokeServer(i)
				if not res.ok and res.error then
					UIController.Notify(res.error, UIKit.Colors.Red)
				end
			end)
			row.LayoutOrder = i
			table.insert(missionRows, row)
		end
		for _, r in ipairs(achRows) do
			r:Destroy()
		end
		achRows = {}
		for i, a in ipairs(Config.Achievements) do
			local value = p.Stats[a.Stat] or 0
			local row = rowFor(pages.Achievements, a.Name, "المكافأة: " .. describe(a.Reward), value, a.Target, p.Achievements[a.Id] == true, function()
				local res = Remotes.Function("ClaimAchievement"):InvokeServer(a.Id)
				if not res.ok and res.error then
					UIController.Notify(res.error, UIKit.Colors.Red)
				end
			end)
			row.LayoutOrder = i
			table.insert(achRows, row)
		end
	end

	showPage("Missions")
	UIController.Register("Missions", w, refresh)
end

return MissionsUI

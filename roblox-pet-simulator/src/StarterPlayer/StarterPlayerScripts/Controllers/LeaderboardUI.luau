--!strict
-- نافذة المتصدرين
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local UIController = require(script.Parent.UIController)

local LeaderboardUI = {}

function LeaderboardUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Leaderboards", "🏆 المتصدرون", UDim2.fromOffset(860, 560), UIKit.Colors.Gold)
	local grid = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.Grid(grid, UDim2.new(0.5, -6, 0.5, -6), 8)
	local boards = {}
	for i, info in ipairs({ { "Coins", "💰 أغنى اللاعبين", UIKit.Colors.Gold }, { "Hatches", "🥚 أكثر فتحاً", UIKit.Colors.Cyan }, { "Rebirths", "🔁 أكثر ريبيرث", Color3.fromRGB(255, 140, 60) }, { "Damage", "⚔️ أعلى ضرر", UIKit.Colors.Pink } }) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = grid })
		UIKit.Corner(card, 12)
		UIKit.Stroke(card, info[3], 2)
		UIKit.Label({ Text = info[2], Size = UDim2.new(1, 0, 0, 30), TextColor3 = info[3], MaxTextSize = 20, Parent = card })
		boards[info[1]] = UIKit.Label({ Text = "...", Size = UDim2.new(1, -16, 1, -36), Position = UDim2.fromOffset(8, 32), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, MaxTextSize = 16, Parent = card })
	end
	local function refresh()
		local data = Remotes.Function("GetLeaderboards"):InvokeServer()
		for key, label in pairs(boards) do
			local rows = type(data) == "table" and data[key] or nil
			if rows and #rows > 0 then
				local lines = {}
				for _, r in ipairs(rows) do
					table.insert(lines, string.format("%d. %s  —  %s", r.Rank, r.Name, Format.Number(r.Value)))
				end
				label.Text = table.concat(lines, "\n")
			else
				label.Text = "لا توجد بيانات بعد"
			end
		end
	end
	UIController.Register("Leaderboards", w, refresh)
end

return LeaderboardUI

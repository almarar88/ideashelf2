--!strict
-- البيضة التجميلية: الإكسسوارات
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local EffectsController = require(script.Parent.EffectsController)

local CosmeticUI = {}

function CosmeticUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Cosmetic", "🎩 البيضة التجميلية", UDim2.fromOffset(700, 520), UIKit.Colors.Pink)
	UIKit.Label({ Text = "افتح البيضة التجميلية لتحصل على إكسسوار عشوائي، ثم جهّزه على أي حيوان من نافذة الحيوانات.", Size = UDim2.new(1, 0, 0, 40), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = w.Content })
	local grid = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 300), Position = UDim2.fromOffset(0, 44), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.Grid(grid, UDim2.fromOffset(150, 130), 8)
	local counts: { [string]: TextLabel } = {}
	local total = 0
	for _, a in ipairs(Config.Accessories) do
		total += a.Chance
	end
	for i, a in ipairs(Config.Accessories) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = grid })
		UIKit.Corner(card, 12)
		UIKit.Stroke(card, a.Color, 2)
		UIKit.Label({ Text = a.Icon, Size = UDim2.new(1, 0, 0, 56), MaxTextSize = 44, Parent = card })
		UIKit.Label({ Text = a.Name, Size = UDim2.new(1, -6, 0, 24), Position = UDim2.fromOffset(3, 58), MaxTextSize = 15, Parent = card })
		UIKit.Label({ Text = string.format("%.1f%%", a.Chance / total * 100), Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 82), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 13, Parent = card })
		counts[a.Id] = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 104), TextColor3 = UIKit.Colors.Green, MaxTextSize = 13, Parent = card })
	end
	local result = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 34), Position = UDim2.new(0, 0, 1, -90), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 22, Parent = w.Content })
	local hatching = false
	UIKit.Button({ Text = "🥚 فتح (💎 " .. Config.CosmeticEggCost .. ")", Color = UIKit.Colors.Pink, Size = UDim2.fromOffset(300, 48), Position = UDim2.new(0.5, -150, 1, -52), MaxTextSize = 20, Parent = w.Content }, function()
		if hatching then
			return
		end
		hatching = true
		local res = Remotes.Function("Cosmetic"):InvokeServer("Hatch")
		if res.ok then
			for _, a in ipairs(Config.Accessories) do
				if a.Id == res.result then
					result.Text = "🎉 " .. a.Icon .. " " .. a.Name .. "!"
					UIKit.Pop(result)
				end
			end
			EffectsController.Play("Hatch")
		elseif res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
		hatching = false
	end)
	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		for id, label in pairs(counts) do
			local n = p.Accessories[id] or 0
			label.Text = n > 0 and ("تملك: " .. n) or ""
		end
	end
	UIController.Register("Cosmetic", w, refresh)
end

return CosmeticUI

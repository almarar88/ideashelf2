--!strict
-- عجلة الحظ مع أنيميشن الدوران
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local EffectsController = require(script.Parent.EffectsController)

local SpinUI = {}
local spinning = false

function SpinUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Spin", "🎡 عجلة الحظ", UDim2.fromOffset(560, 600), UIKit.Colors.Gold)
	local wheel = UIKit.Frame({ Size = UDim2.fromOffset(340, 340), Position = UDim2.new(0.5, -170, 0, 10), BackgroundColor3 = UIKit.Colors.Panel2, Parent = w.Content })
	UIKit.Corner(wheel, 170)
	UIKit.Stroke(wheel, UIKit.Colors.Gold, 4)
	local n = #Config.Spin.Segments
	local colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(80, 200, 255), Color3.fromRGB(255, 220, 60), Color3.fromRGB(120, 255, 120), Color3.fromRGB(200, 100, 255), Color3.fromRGB(255, 150, 60), Color3.fromRGB(80, 255, 220), Color3.fromRGB(255, 120, 200) }
	for i, seg in ipairs(Config.Spin.Segments) do
		local ang = (i - 1) / n * 360
		local holder = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Rotation = ang, Parent = wheel })
		local chip = UIKit.Frame({ Size = UDim2.fromOffset(96, 44), Position = UDim2.new(0.5, -48, 0, 14), BackgroundColor3 = colors[(i - 1) % #colors + 1], Parent = holder })
		UIKit.Corner(chip, 10)
		UIKit.Label({ Text = seg.Label, MaxTextSize = 15, Parent = chip })
	end
	local pointer = UIKit.Label({ Text = "▼", Size = UDim2.fromOffset(40, 40), Position = UDim2.new(0.5, -20, 0, -22), TextColor3 = UIKit.Colors.Red, MaxTextSize = 40, ZIndex = 3, Parent = w.Content })
	pointer.TextStrokeTransparency = 0
	local info = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 30), Position = UDim2.fromOffset(0, 360), MaxTextSize = 18, TextColor3 = UIKit.Colors.Muted, Parent = w.Content })
	local result = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 34), Position = UDim2.fromOffset(0, 392), MaxTextSize = 22, TextColor3 = UIKit.Colors.Gold, Parent = w.Content })
	local btns = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 50), Position = UDim2.fromOffset(0, 440), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.List(btns, 10, true, true)
	local spinBtn = UIKit.Button({ Text = "لف!", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(200, 48), MaxTextSize = 22, Parent = btns })
	local buyBtn = UIKit.Button({ Text = "لفة بـ 💎 " .. Config.Spin.ExtraSpinCost, Color = UIKit.Colors.Cyan, Size = UDim2.fromOffset(200, 48), MaxTextSize = 18, Parent = btns })

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local free = p.FreeSpin == true
		info.Text = (free and "🎁 لفة مجانية متاحة!" or "اللفة المجانية القادمة غداً") .. "   •   لفات إضافية: " .. (p.Spins or 0)
		spinBtn.BackgroundColor3 = (free or (p.Spins or 0) > 0) and UIKit.Colors.Green or UIKit.Colors.Panel3
	end

	local function doSpin(paid: boolean)
		if spinning then
			return
		end
		local res = Remotes.Function("Spin"):InvokeServer(paid)
		if not res.ok then
			UIController.Notify(res.error or "خطأ", UIKit.Colors.Red)
			return
		end
		spinning = true
		result.Text = ""
		EffectsController.Play("Spin")
		local target = -((res.index - 1) / n * 360) - 360 * 5
		wheel.Rotation = 0
		local tween = TweenService:Create(wheel, TweenInfo.new(3.2, Enum.EasingStyle.Quart, Enum.EasingDirection.Out), { Rotation = target })
		tween:Play()
		tween.Completed:Wait()
		result.Text = "🎉 " .. tostring(res.reward)
		UIKit.Pop(result)
		spinning = false
		refresh()
	end
	spinBtn.Activated:Connect(function()
		doSpin(false)
	end)
	buyBtn.Activated:Connect(function()
		doSpin(true)
	end)
	UIController.Register("Spin", w, refresh)
end

return SpinUI

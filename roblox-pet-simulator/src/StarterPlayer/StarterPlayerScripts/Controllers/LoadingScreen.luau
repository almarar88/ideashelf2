--!strict
-- شاشة تحميل مع نصائح
local Players = game:GetService("Players")
local UIKit = require(script.Parent.UIKit)

local LoadingScreen = {}

local TIPS = {
	"اضغط على الصناديق لتهاجمها حيواناتك",
	"E لفتح بيضة، R لفتح 3، T للفتح التلقائي",
	"الحيوانات تكسب خبرة مع كل صندوق وتصبح أقوى بالمستويات",
	"آلة الإنشانت تعطي حيواناتك قدرات إضافية",
	"الريبيرث يعطيك مضاعفات دائمة وتوكنات لبيضة الريبيرث",
	"اضغط Q لركوب الهوفربورد",
	"عجلة الحظ مجانية مرة كل يوم",
	"التاجر المتجول يغير بضاعته كل ساعة",
	"الأحداث العالمية كل 7 دقائق: اجمع أصدقاءك لهزيمة الزعيم",
	"ادمج 10 حيوانات دفعة واحدة لأعلى فرصة ترقية",
}

local gui: ScreenGui
local statusLabel: TextLabel

function LoadingScreen.Show()
	gui = Instance.new("ScreenGui")
	gui.Name = "Loading"
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 100
	gui.ResetOnSpawn = false
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	local bg = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.fromRGB(18, 20, 40), Parent = gui })
	UIKit.Gradient(bg, Color3.fromRGB(40, 30, 90), Color3.fromRGB(10, 12, 30))
	local title = UIKit.Label({ Text = "🐾 Pet Kingdom Simulator", Size = UDim2.new(1, 0, 0, 90), Position = UDim2.new(0, 0, 0.32, 0), MaxTextSize = 64, TextStrokeTransparency = 0, Parent = bg })
	UIKit.Gradient(title, Color3.fromRGB(255, 230, 120), Color3.fromRGB(255, 150, 60))
	statusLabel = UIKit.Label({ Text = "جاري تحميل بياناتك...", Size = UDim2.new(1, 0, 0, 34), Position = UDim2.new(0, 0, 0.32, 100), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 22, Parent = bg })
	local tip = UIKit.Label({ Text = "💡 " .. TIPS[math.random(#TIPS)], Size = UDim2.new(0.8, 0, 0, 40), Position = UDim2.new(0.1, 0, 0.75, 0), TextColor3 = UIKit.Colors.Cyan, MaxTextSize = 20, Parent = bg })
	local dots = 0
	task.delay(20, function()
		if gui and gui.Parent then
			tip.Text = "⚠️ التحميل يأخذ وقتاً أطول من المعتاد. افتح View > Output في Studio وأرسل نص الخطأ."
			tip.TextColor3 = Color3.fromRGB(255, 120, 120)
		end
	end)
	task.spawn(function()
		while gui and gui.Parent do
			dots = (dots + 1) % 4
			statusLabel.Text = "جاري تحميل بياناتك" .. string.rep(".", dots)
			if dots == 0 then
				tip.Text = "💡 " .. TIPS[math.random(#TIPS)]
			end
			task.wait(0.6)
		end
	end)
end

function LoadingScreen.Hide()
	if gui then
		local g = gui
		gui = nil :: any
		for _, d in ipairs(g:GetDescendants()) do
			if d:IsA("Frame") then
				UIKit.Tween(d, { BackgroundTransparency = 1 }, 0.5)
			elseif d:IsA("TextLabel") then
				UIKit.Tween(d, { TextTransparency = 1, TextStrokeTransparency = 1 }, 0.5)
			end
		end
		task.delay(0.55, function()
			g:Destroy()
		end)
	end
end

return LoadingScreen

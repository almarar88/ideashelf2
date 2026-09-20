--!strict
-- لوحة الأدمن
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local UIController = require(script.Parent.UIController)

local AdminUI = {}

function AdminUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Admin", "🛠️ لوحة الأدمن", UDim2.fromOffset(520, 520), UIKit.Colors.Red)
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 8)
	local function run(cmd: string, payload: any)
		local res = Remotes.Function("Admin"):InvokeServer(cmd, payload)
		UIController.Notify(res.ok and ("✅ " .. cmd) or (res.error or "خطأ"), res.ok and UIKit.Colors.Green or UIKit.Colors.Red)
	end
	local function inputRow(label: string, placeholder: string, cmd: string, build: (string) -> any)
		local row = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 46), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
		UIKit.Corner(row, 10)
		UIKit.Label({ Text = label, Size = UDim2.fromOffset(150, 46), Position = UDim2.fromOffset(8, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 16, Parent = row })
		local box = UIKit.New("TextBox", { Size = UDim2.new(1, -280, 0, 34), Position = UDim2.fromOffset(160, 6), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = placeholder, Text = "", Font = UIKit.Font, TextColor3 = UIKit.Colors.Text, TextSize = 18, ClearTextOnFocus = false, Parent = row }) :: TextBox
		UIKit.Corner(box, 8)
		UIKit.Button({ Text = "تنفيذ", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(100, 34), Position = UDim2.new(1, -108, 0, 6), MaxTextSize = 16, Parent = row }, function()
			run(cmd, build(box.Text))
		end)
	end
	local function num(t: string)
		return { Amount = tonumber(t) or 0 }
	end
	inputRow("💰 عملات", "1000000", "Coins", num)
	inputRow("💎 ألماس", "10000", "Diamonds", num)
	inputRow("🔁 توكنات", "5", "Tokens", num)
	inputRow("🎡 لفات", "5", "Spins", num)
	inputRow("🔁 عدد الريبيرث", "3", "Rebirths", num)
	inputRow("🐾 حيوان (id [variant])", "huge_cat Rainbow", "Pet", function(t)
		local id, variant = t:match("^(%S+)%s*(%S*)$")
		return { Id = id or t, Variant = (variant ~= "" and variant) or "Normal" }
	end)
	inputRow("🧪 جرعة (key عدد)", "Lucky 3", "Potion", function(t)
		local key, count = t:match("^(%S+)%s*(%S*)$")
		return { Id = key or t, Amount = tonumber(count) or 1 }
	end)
	local evRow = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 46), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(evRow, 6, true)
	for _, e in ipairs(Config.Events.List) do
		UIKit.Button({ Text = e.Name, Color = UIKit.Colors.Purple, Size = UDim2.fromOffset(92, 40), MaxTextSize = 13, Parent = evRow }, function()
			run("Event", { Id = e.Id })
		end)
	end
	local misc = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 46), BackgroundTransparency = 1, Parent = scroll })
	UIKit.List(misc, 6, true)
	UIKit.Button({ Text = "🔓 فتح كل المناطق", Color = UIKit.Colors.Gold, Size = UDim2.fromOffset(200, 40), MaxTextSize = 16, Parent = misc }, function()
		run("UnlockAll", {})
	end)
	UIKit.Button({ Text = "⚠️ تصفير بياناتي", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(200, 40), MaxTextSize = 16, Parent = misc }, function()
		run("Reset", {})
	end)
	UIController.Register("Admin", w)
end

return AdminUI

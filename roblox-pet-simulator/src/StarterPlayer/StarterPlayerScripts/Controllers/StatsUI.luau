--!strict
-- الإحصائيات + الإتقان + الريبيرث + تفاصيل المضاعفات
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local Mastery = require(Shared.Modules.Mastery)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)

local StatsUI = {}

function StatsUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Stats", "📊 الإحصائيات والريبيرث", UDim2.fromOffset(820, 620), Color3.fromRGB(255, 140, 60))
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 10)

	-- الريبيرث
	local rb = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 130), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
	UIKit.Corner(rb, 14)
	UIKit.Stroke(rb, Color3.fromRGB(255, 140, 60), 2)
	UIKit.Label({ Text = "🔁 الريبيرث", Size = UDim2.new(1, -20, 0, 30), Position = UDim2.fromOffset(12, 6), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 24, Parent = rb })
	local rbDesc = UIKit.Label({ Text = "", Size = UDim2.new(1, -220, 0, 60), Position = UDim2.fromOffset(12, 40), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = rb })
	local rbBtn = UIKit.Button({ Text = "ريبيرث", Color = Color3.fromRGB(255, 140, 60), Size = UDim2.fromOffset(190, 52), Position = UDim2.new(1, -202, 0, 40), MaxTextSize = 20, Parent = rb }, function()
		local res = Remotes.Function("Rebirth"):InvokeServer()
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		else
			UIController.Close()
		end
	end)

	-- المضاعفات
	local mult = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 96), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
	UIKit.Corner(mult, 14)
	local multLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, -20, 1, -8), Position = UDim2.fromOffset(12, 4), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, MaxTextSize = 17, Parent = mult })

	-- الإتقان
	UIKit.Label({ Text = "🏆 الإتقان (Mastery)", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = scroll })
	local masteryRows = {}
	for _, cfg in ipairs(Config.Mastery) do
		local row = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 66), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
		UIKit.Corner(row, 12)
		local title = UIKit.Label({ Text = cfg.Icon .. " " .. cfg.Name, Size = UDim2.new(0.6, 0, 0, 28), Position = UDim2.fromOffset(12, 4), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 19, Parent = row })
		local bonus = UIKit.Label({ Text = "", Size = UDim2.new(0.4, -12, 0, 28), Position = UDim2.new(0.6, 0, 0, 4), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = UIKit.Colors.Green, MaxTextSize = 16, Parent = row })
		local _, fill, label = UIKit.ProgressBar(row, UIKit.Colors.Gold, UDim2.new(1, -24, 0, 22), UDim2.fromOffset(12, 36))
		masteryRows[cfg.Key] = { Title = title, Bonus = bonus, Fill = fill, Label = label }
	end

	-- الإحصائيات
	UIKit.Label({ Text = "📈 الإحصائيات", Size = UDim2.new(1, 0, 0, 30), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = scroll })
	local statsGrid = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 260), BackgroundTransparency = 1, Parent = scroll })
	UIKit.Grid(statsGrid, UDim2.fromOffset(190, 56), 8)
	local statLabels = {}
	local STATS = {
		{ "Hatches", "🥚 بيض مفتوح" }, { "Breaks", "💥 صناديق مكسورة" }, { "CoinsEarned", "💰 عملات مكتسبة" }, { "DiamondsEarned", "💎 ألماس مكتسب" },
		{ "Damage", "⚔️ ضرر كلي" }, { "Fusions", "🔮 دمج" }, { "Goldens", "✨ ذهبي" }, { "Rainbows", "🌈 قوس قزح" },
		{ "DarkMatters", "🌑 مادة مظلمة" }, { "BossKills", "👹 زعماء" }, { "Trades", "🤝 تبادلات" }, { "Enchants", "🔧 إنشانت" },
		{ "Spins", "🎡 لفات" }, { "BestPet", "🏅 أقوى حيوان" }, { "Playtime", "⏱️ وقت اللعب" },
	}
	for i, s in ipairs(STATS) do
		local cell = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = statsGrid })
		UIKit.Corner(cell, 10)
		UIKit.Label({ Text = s[2], Size = UDim2.new(1, -8, 0, 22), Position = UDim2.fromOffset(4, 2), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, Parent = cell })
		statLabels[s[1]] = UIKit.Label({ Text = "0", Size = UDim2.new(1, -8, 0, 28), Position = UDim2.fromOffset(4, 24), MaxTextSize = 20, Parent = cell })
	end

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local cost = p.RebirthCost or 0
		local next = (p.Rebirths or 0) + 1
		rbDesc.Text = string.format("التكلفة: 💰 %s  •  يتطلب فتح المنطقة %d\nيعيد العملات والمناطق 2–10، وتحصل على: +%d%% عملات، +%d%% حظ، +%d%% قوة، +%d توكن (دائم)",
			Format.Number(cost), Config.Rebirth.RequiredZone,
			math.floor(Config.Rebirth.CoinsPerRebirth * 100), math.floor(Config.Rebirth.LuckPerRebirth * 100), math.floor(Config.Rebirth.DamagePerRebirth * 100), Config.Rebirth.TokensPerRebirth)
		local can = p.Coins >= cost and p.UnlockedZones[tostring(Config.Rebirth.RequiredZone)]
		rbBtn.Text = "ريبيرث #" .. next
		rbBtn.BackgroundColor3 = can and Color3.fromRGB(255, 140, 60) or UIKit.Colors.Panel3
		multLabel.Text = string.format("💰 عملات x%.2f    🍀 حظ x%.2f    ⚔️ قوة x%.2f    💎 ألماس x%.2f\n🔁 ريبيرث: %d    🔧 إنشانت: عملات +%d%% / قوة +%d%% / حظ +%d%% / قاضية %d%%",
			p.CoinMult or 1, p.Luck or 1, p.DamageMult or 1, p.DiamondMult or 1, p.Rebirths or 0,
			math.floor(((p.Enchants and p.Enchants.Coins) or 0) * 100), math.floor(((p.Enchants and p.Enchants.Damage) or 0) * 100), math.floor(((p.Enchants and p.Enchants.Luck) or 0) * 100), math.floor(((p.Enchants and p.Enchants.Crit) or 0) * 100))
		for _, cfg in ipairs(Config.Mastery) do
			local row = masteryRows[cfg.Key]
			local level, value, needed = Mastery.Progress(cfg, p.Stats[cfg.Stat] or 0)
			row.Title.Text = cfg.Icon .. " " .. cfg.Name .. "  Lv." .. level
			local perks = {}
			for k, v in pairs(cfg.PerLevel) do
				table.insert(perks, "+" .. math.floor(v * level * 100 + 0.5) .. "% " .. k)
			end
			row.Bonus.Text = table.concat(perks, " ")
			if needed > 0 then
				local prev = level > 0 and Mastery.Threshold(cfg, level) or 0
				row.Fill.Size = UDim2.fromScale(math.clamp((value - prev) / math.max(1, needed - prev), 0, 1), 1)
				row.Label.Text = Format.Number(value) .. " / " .. Format.Number(needed)
			else
				row.Fill.Size = UDim2.fromScale(1, 1)
				row.Label.Text = "الحد الأقصى"
			end
		end
		for key, label in pairs(statLabels) do
			local v = p.Stats[key] or 0
			if key == "Playtime" then
				label.Text = Format.Time(v + (DataController.ServerTime() - (p.SessionStart or 0)))
			else
				label.Text = Format.Number(v)
			end
		end
	end
	UIController.Register("Stats", w, refresh)
end

return StatsUI

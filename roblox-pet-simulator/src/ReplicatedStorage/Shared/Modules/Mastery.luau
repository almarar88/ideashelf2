--!strict
-- الإتقان: مستويات تعتمد على الإحصائيات (مشترك بين السيرفر والعميل)
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)

local Mastery = {}

function Mastery.Threshold(cfg: any, level: number): number
	return math.floor(cfg.Base * (cfg.Mult ^ (level - 1)))
end

-- يرجع المستوى الحالي، القيمة الحالية، المطلوب للمستوى التالي (0 = الأقصى)
function Mastery.Progress(cfg: any, statValue: number): (number, number, number)
	local level = 0
	while level < cfg.MaxLevel and statValue >= Mastery.Threshold(cfg, level + 1) do
		level += 1
	end
	local needed = level < cfg.MaxLevel and Mastery.Threshold(cfg, level + 1) or 0
	return level, statValue, needed
end

function Mastery.Bonuses(stats: { [string]: number }): { [string]: number }
	local out = { Coins = 0, Luck = 0, Damage = 0, Diamonds = 0 }
	for _, cfg in ipairs(Config.Mastery) do
		local level = Mastery.Progress(cfg, stats[cfg.Stat] or 0)
		for k, v in pairs(cfg.PerLevel) do
			out[k] = (out[k] or 0) + v * level
		end
	end
	return out
end

return Mastery

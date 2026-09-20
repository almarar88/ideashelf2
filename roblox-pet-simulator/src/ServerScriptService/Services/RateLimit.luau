--!strict
-- حد المعدل لكل لاعب لكل مفتاح (حماية من الإرسال المفرط)
local Players = game:GetService("Players")

local RateLimit = {}
local buckets: { [Player]: { [string]: { Count: number, Reset: number } } } = {}

function RateLimit.Check(player: Player, key: string, maxPerWindow: number, window: number?): boolean
	window = window or 1
	local now = os.clock()
	local b = buckets[player]
	if not b then
		b = {}
		buckets[player] = b
	end
	local e = b[key]
	if not e or now >= e.Reset then
		e = { Count = 0, Reset = now + (window :: number) }
		b[key] = e
	end
	e.Count += 1
	return e.Count <= maxPerWindow
end

Players.PlayerRemoving:Connect(function(player)
	buckets[player] = nil
end)

return RateLimit

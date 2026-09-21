--!strict
-- لوحات المتصدرين العالمية (OrderedDataStore)
local Players = game:GetService("Players")
local DataStoreService = game:GetService("DataStoreService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local DataService = require(script.Parent.DataService)
local MapBuilder = require(script.Parent.MapBuilder)

local LeaderboardService = {}
local Remotes = require(Shared.Remotes)
local cached: { [string]: { any } } = {}

local stores: { [string]: any } = {}
do
	local ok = pcall(function()
		stores.Coins = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Coins")
		stores.Hatches = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Hatches")
		stores.Rebirths = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Rebirths")
		stores.Damage = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Damage")
	end)
	if not ok then
		warn("[Leaderboard] OrderedDataStore غير متاح، اللوحات معطلة في هذه الجلسة")
		stores = {}
	end
end

local function refresh()
	if not stores.Coins then
		return
	end
	for _, player in ipairs(Players:GetPlayers()) do
		local p = DataService.Get(player)
		if p then
			pcall(stores.Coins.SetAsync, stores.Coins, tostring(player.UserId), math.floor(math.min(p.Stats.CoinsEarned, 9e15)))
			pcall(stores.Hatches.SetAsync, stores.Hatches, tostring(player.UserId), math.floor(p.Stats.Hatches))
			pcall(stores.Rebirths.SetAsync, stores.Rebirths, tostring(player.UserId), math.floor(p.Rebirths))
			pcall(stores.Damage.SetAsync, stores.Damage, tostring(player.UserId), math.floor(math.min(p.Stats.Damage, 9e15)))
		end
	end
	for key, store in pairs(stores) do
		local label = MapBuilder.Boards[key]
		if label then
			local ok, pages = pcall(store.GetSortedAsync, store, false, 10)
			if ok then
				local lines = {}
				local rows = {}
				for i, entry in ipairs(pages:GetCurrentPage()) do
					local name = "???"
					local okName, res = pcall(Players.GetNameFromUserIdAsync, Players, tonumber(entry.key) :: number)
					if okName then
						name = res
					end
					table.insert(lines, string.format("%d. %s  -  %s", i, name, Format.Number(entry.value)))
					table.insert(rows, { Rank = i, Name = name, Value = entry.value, UserId = tonumber(entry.key) })
				end
				cached[key] = rows
				label.Text = #lines > 0 and table.concat(lines, "\n") or "لا يوجد بيانات بعد"
			end
		end
	end
end

function LeaderboardService.Init()
	Remotes.Function("GetLeaderboards").OnServerInvoke = function()
		return cached
	end
	task.spawn(function()
		task.wait(5)
		while true do
			refresh()
			task.wait(60)
		end
	end)
end

return LeaderboardService

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

local stores = {
	Coins = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Coins"),
	Hatches = DataStoreService:GetOrderedDataStore(Config.LeaderboardStore .. "_Hatches"),
}

local function refresh()
	for _, player in ipairs(Players:GetPlayers()) do
		local p = DataService.Get(player)
		if p then
			pcall(stores.Coins.SetAsync, stores.Coins, tostring(player.UserId), math.floor(p.Stats.CoinsEarned))
			pcall(stores.Hatches.SetAsync, stores.Hatches, tostring(player.UserId), math.floor(p.Stats.Hatches))
		end
	end
	for key, store in pairs(stores) do
		local label = MapBuilder.Boards[key]
		if label then
			local ok, pages = pcall(store.GetSortedAsync, store, false, 10)
			if ok then
				local lines = {}
				for i, entry in ipairs(pages:GetCurrentPage()) do
					local name = "???"
					local okName, res = pcall(Players.GetNameFromUserIdAsync, Players, tonumber(entry.key) :: number)
					if okName then
						name = res
					end
					table.insert(lines, string.format("%d. %s  -  %s", i, name, Format.Number(entry.value)))
				end
				label.Text = #lines > 0 and table.concat(lines, "\n") or "لا يوجد بيانات بعد"
			end
		end
	end
end

function LeaderboardService.Init()
	task.spawn(function()
		task.wait(5)
		while true do
			refresh()
			task.wait(60)
		end
	end)
end

return LeaderboardService

--!strict
-- مكافأة حظ عند اللعب مع الأصدقاء
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local DataService = require(script.Parent.DataService)

local FriendService = {}
local friendsOnline: { [Player]: number } = {}

local function recompute()
	local list = Players:GetPlayers()
	for _, a in ipairs(list) do
		local n = 0
		for _, b in ipairs(list) do
			if a ~= b then
				local ok, isFriend = pcall(a.IsFriendsWith, a, b.UserId)
				if ok and isFriend then
					n += 1
				end
			end
		end
		friendsOnline[a] = n
		a:SetAttribute("FriendsOnline", n)
	end
end

function FriendService.Init()
	table.insert(DataService.BonusProviders, function(player)
		local n = friendsOnline[player] or 0
		if n <= 0 then
			return nil
		end
		return { Luck = math.min(Config.FriendLuckMax, n * Config.FriendLuckPerFriend) }
	end)
	Players.PlayerAdded:Connect(function()
		task.delay(1, recompute)
	end)
	Players.PlayerRemoving:Connect(function(player)
		friendsOnline[player] = nil
		task.delay(1, recompute)
	end)
	task.spawn(recompute)
end

return FriendService

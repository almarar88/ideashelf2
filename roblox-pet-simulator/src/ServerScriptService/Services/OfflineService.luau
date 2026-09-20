--!strict
-- أرباح وقت الغياب: عند العودة يحصل اللاعب على عملات تقريبية حسب قوته ومدة غيابه
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Breakables = require(Shared.Data.Breakables)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)

local OfflineService = {}

function OfflineService.Init()
	DataService.Loaded:Connect(function(player, profile)
		task.delay(2, function()
			local p = DataService.Get(player)
			if not p or p ~= profile then
				return
			end
			local last = p.LastSeen or 0
			if last <= 0 then
				return
			end
			local elapsed = math.min(os.time() - last, Config.Offline.MaxHours * 3600)
			if elapsed < 300 then
				return
			end
			local power = PetService.GetPower(player)
			if power <= 0 then
				return
			end
			local best = Zones.List[1]
			for k in pairs(p.UnlockedZones) do
				local z = Zones.Get(tonumber(k) or 1)
				if z and z.Multiplier > best.Multiplier then
					best = z
				end
			end
			local pile = Breakables.Get("CoinPile") :: Breakables.BreakableDef
			local pileHealth = pile.Health * best.Multiplier
			local pileCoins = pile.Coins * best.Multiplier
			local perSecond = math.min(power / pileHealth, 1) * pileCoins
			local coins = math.floor(perSecond * elapsed * Config.Offline.Rate * DataService.CoinMultiplier(player))
			if coins <= 0 then
				return
			end
			DataService.AddCoins(player, coins)
			DataService.MarkDirty(player)
			Remotes.Event("EventEffect"):FireClient(player, { Type = "WelcomeBack", Coins = coins, Seconds = elapsed })
		end)
	end)
end

return OfflineService

--!strict
-- الريبيرث: إعادة العملات والمناطق مقابل مضاعفات دائمة + توكنات
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local ZoneService = require(script.Parent.ZoneService)

local RebirthService = {}

function RebirthService.Cost(rebirths: number): number
	return math.floor(Config.Rebirth.BaseCost * (Config.Rebirth.CostMult ^ rebirths))
end

function RebirthService.Rebirth(player: Player): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not p.UnlockedZones[tostring(Config.Rebirth.RequiredZone)] then
		return { ok = false, error = "افتح المنطقة " .. Config.Rebirth.RequiredZone .. " أولاً" }
	end
	local cost = RebirthService.Cost(p.Rebirths)
	if p.Coins < cost then
		return { ok = false, error = "تحتاج 💰 " .. Format.Number(cost) }
	end
	p.Coins = 0
	for i = 2, 10 do
		p.UnlockedZones[tostring(i)] = nil
	end
	p.Rebirths += 1
	p.Stats.Rebirths += 1
	p.Tokens += Config.Rebirth.TokensPerRebirth
	p.LastZone = 1
	DataService.MarkDirty(player)
	ZoneService.Teleport(player, 1)
	DataService.NotifyAll("🔁 " .. player.Name .. " قام بالريبيرث رقم " .. p.Rebirths .. "!", Color3.fromRGB(255, 120, 60))
	return { ok = true }
end

function RebirthService.Init()
	Remotes.Function("Rebirth").OnServerInvoke = function(player)
		return RebirthService.Rebirth(player)
	end
	table.insert(DataService.Extenders, function(player, payload)
		payload.RebirthCost = RebirthService.Cost(payload.Rebirths or 0)
	end)
end

return RebirthService

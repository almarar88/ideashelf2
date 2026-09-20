--!strict
-- أوامر الأدمن (للاختبار والإدارة)
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Pets = require(Shared.Data.Pets)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local EventService = require(script.Parent.EventService)
local ZoneService = require(script.Parent.ZoneService)

local AdminService = {}

function AdminService.Run(player: Player, command: string, payload: any): { ok: boolean, error: string? }
	if not DataService.IsAdmin(player) then
		return { ok = false, error = "غير مصرح" }
	end
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	payload = type(payload) == "table" and payload or {}
	local n = tonumber(payload.Amount) or 0
	if command == "Coins" then
		p.Coins += n
	elseif command == "Diamonds" then
		p.Diamonds += n
	elseif command == "Tokens" then
		p.Tokens += n
	elseif command == "Gems" then
		p.Gems += n
	elseif command == "Spins" then
		p.Spins += n
	elseif command == "Rebirths" then
		p.Rebirths = math.max(0, math.floor(n))
	elseif command == "Pet" then
		local id = tostring(payload.Id)
		if not Pets.Get(id) then
			return { ok = false, error = "حيوان غير موجود: " .. id }
		end
		PetService.Add(player, id, tostring(payload.Variant or "Normal"), true)
	elseif command == "UnlockAll" then
		for i = 1, 20 do
			p.UnlockedZones[tostring(i)] = true
		end
	elseif command == "Event" then
		if not EventService.Start(tostring(payload.Id)) then
			return { ok = false, error = "حدث غير موجود" }
		end
	elseif command == "Potion" then
		DataService.GivePotion(player, tostring(payload.Id), math.max(1, math.floor(n)))
	elseif command == "Reset" then
		DataService.ResetProfile(player)
		ZoneService.Teleport(player, 1)
		return { ok = true }
	else
		return { ok = false, error = "أمر غير معروف" }
	end
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	return { ok = true }
end

function AdminService.Init()
	Remotes.Function("Admin").OnServerInvoke = function(player, command, payload)
		return AdminService.Run(player, tostring(command), payload)
	end
end

return AdminService

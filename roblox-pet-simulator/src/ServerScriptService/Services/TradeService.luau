--!strict
-- نظام التبادل بين اللاعبين مع تأكيد مزدوج وعدّ تنازلي
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local RateLimit = require(script.Parent.RateLimit)

local TradeService = {}

type Trade = {
	A: Player,
	B: Player,
	Offers: { [Player]: { string } },
	Confirmed: { [Player]: boolean },
	Countdown: number?,
	Token: number,
}

local trades: { [Player]: Trade } = {}
local pending: { [Player]: Player } = {} -- target -> requester
local tokenCounter = 0

local function other(t: Trade, player: Player): Player
	return t.A == player and t.B or t.A
end

local function petsFor(player: Player, uids: { string }): { any }
	local p = DataService.Get(player)
	local out = {}
	if not p then
		return out
	end
	for _, uid in ipairs(uids) do
		local pet = PetService.Find(p, uid)
		if pet then
			table.insert(out, { Uid = pet.Uid, Id = pet.Id, Variant = pet.Variant, Level = pet.Level, Enchants = pet.Enchants })
		end
	end
	return out
end

local function broadcast(t: Trade)
	for _, player in ipairs({ t.A, t.B }) do
		local o = other(t, player)
		Remotes.Event("TradeUpdate"):FireClient(player, {
			Partner = { Name = o.Name, UserId = o.UserId, DisplayName = o.DisplayName },
			MyOffer = petsFor(player, t.Offers[player]),
			TheirOffer = petsFor(o, t.Offers[o]),
			MyConfirmed = t.Confirmed[player],
			TheirConfirmed = t.Confirmed[o],
			Countdown = t.Countdown,
		})
	end
end

local function cancel(t: Trade, reason: string?)
	trades[t.A] = nil
	trades[t.B] = nil
	for _, player in ipairs({ t.A, t.B }) do
		if player.Parent == Players then
			Remotes.Event("TradeUpdate"):FireClient(player, nil)
			if reason then
				DataService.Notify(player, reason, Color3.fromRGB(255, 120, 120))
			end
		end
	end
end

local function execute(t: Trade)
	local pa, pb = DataService.Get(t.A), DataService.Get(t.B)
	if not pa or not pb then
		cancel(t, "فشل التبادل")
		return
	end
	local function validate(p: DataService.Profile, uids: { string }): boolean
		for _, uid in ipairs(uids) do
			local pet = PetService.Find(p, uid)
			if not pet or pet.Locked then
				return false
			end
		end
		return true
	end
	if not validate(pa, t.Offers[t.A]) or not validate(pb, t.Offers[t.B]) then
		cancel(t, "تغيرت الحيوانات، أُلغي التبادل")
		return
	end
	if #pa.Pets - #t.Offers[t.A] + #t.Offers[t.B] > PetService.StorageCapacity(t.A) then
		cancel(t, "مخزن " .. t.A.Name .. " ممتلئ")
		return
	end
	if #pb.Pets - #t.Offers[t.B] + #t.Offers[t.A] > PetService.StorageCapacity(t.B) then
		cancel(t, "مخزن " .. t.B.Name .. " ممتلئ")
		return
	end
	local movedA, movedB = {}, {}
	for _, uid in ipairs(t.Offers[t.A]) do
		table.insert(movedA, PetService.Remove(pa, uid))
	end
	for _, uid in ipairs(t.Offers[t.B]) do
		table.insert(movedB, PetService.Remove(pb, uid))
	end
	for _, pet in ipairs(movedA) do
		pet.Equipped = false
		pet.Locked = false
		table.insert(pb.Pets, pet)
		pb.Index[pet.Id] = true
	end
	for _, pet in ipairs(movedB) do
		pet.Equipped = false
		pet.Locked = false
		table.insert(pa.Pets, pet)
		pa.Index[pet.Id] = true
	end
	pa.Stats.Trades += 1
	pb.Stats.Trades += 1
	DataService.MarkDirty(t.A)
	DataService.MarkDirty(t.B)
	PetService.UpdateEquippedAttribute(t.A)
	PetService.UpdateEquippedAttribute(t.B)
	trades[t.A] = nil
	trades[t.B] = nil
	for _, player in ipairs({ t.A, t.B }) do
		Remotes.Event("TradeUpdate"):FireClient(player, nil)
		DataService.Notify(player, "🤝 تم التبادل بنجاح!", Color3.fromRGB(120, 255, 140))
	end
end

local function startCountdown(t: Trade)
	tokenCounter += 1
	local token = tokenCounter
	t.Token = token
	t.Countdown = Config.TradeCountdown
	broadcast(t)
	task.spawn(function()
		for i = Config.TradeCountdown, 1, -1 do
			task.wait(1)
			if trades[t.A] ~= t or t.Token ~= token then
				return
			end
			t.Countdown = i - 1
			broadcast(t)
		end
		if trades[t.A] == t and t.Token == token and t.Confirmed[t.A] and t.Confirmed[t.B] then
			execute(t)
		end
	end)
end

local function resetConfirm(t: Trade)
	t.Confirmed[t.A] = false
	t.Confirmed[t.B] = false
	t.Countdown = nil
	t.Token += 1
end

function TradeService.Init()
	Remotes.Event("TradeRequest").OnServerEvent:Connect(function(player, targetId)
		if not RateLimit.Check(player, "TradeReq", 3, 5) then
			return
		end
		local target = Players:GetPlayerByUserId(tonumber(targetId) or 0)
		if not target or target == player or trades[player] or trades[target] then
			DataService.Notify(player, "اللاعب غير متاح للتبادل", Color3.fromRGB(255, 120, 120))
			return
		end
		pending[target] = player
		Remotes.Event("TradeIncoming"):FireClient(target, { FromUserId = player.UserId, FromName = player.DisplayName })
		DataService.Notify(player, "📨 أُرسل طلب التبادل إلى " .. target.DisplayName, Color3.fromRGB(120, 200, 255))
	end)

	Remotes.Event("TradeRespond").OnServerEvent:Connect(function(player, fromId, accept)
		local requester = pending[player]
		if not requester or requester.UserId ~= tonumber(fromId) then
			return
		end
		pending[player] = nil
		if not accept or requester.Parent ~= Players or trades[requester] or trades[player] then
			if requester.Parent == Players then
				DataService.Notify(requester, player.DisplayName .. " رفض التبادل", Color3.fromRGB(255, 120, 120))
			end
			return
		end
		local t: Trade = { A = requester, B = player, Offers = { [requester] = {}, [player] = {} }, Confirmed = { [requester] = false, [player] = false }, Countdown = nil, Token = 0 }
		trades[requester] = t
		trades[player] = t
		broadcast(t)
	end)

	Remotes.Event("TradeAction").OnServerEvent:Connect(function(player, action, payload)
		local t = trades[player]
		if not t then
			return
		end
		if not RateLimit.Check(player, "TradeAct", 15) then
			return
		end
		payload = type(payload) == "table" and payload or {}
		if action == "Add" then
			local p = DataService.Get(player)
			local uid = tostring(payload.Uid)
			local pet = p and PetService.Find(p, uid)
			if not pet or pet.Locked or table.find(t.Offers[player], uid) or #t.Offers[player] >= Config.TradeMaxPets then
				return
			end
			table.insert(t.Offers[player], uid)
			resetConfirm(t)
		elseif action == "Remove" then
			local idx = table.find(t.Offers[player], tostring(payload.Uid))
			if idx then
				table.remove(t.Offers[player], idx)
				resetConfirm(t)
			end
		elseif action == "Confirm" then
			t.Confirmed[player] = not t.Confirmed[player]
			t.Countdown = nil
			t.Token += 1
			if t.Confirmed[t.A] and t.Confirmed[t.B] then
				startCountdown(t)
				return
			end
		elseif action == "Cancel" then
			cancel(t, "أُلغي التبادل")
			return
		end
		broadcast(t)
	end)

	Players.PlayerRemoving:Connect(function(player)
		local t = trades[player]
		if t then
			cancel(t, "غادر الطرف الآخر")
		end
		pending[player] = nil
	end)
end

return TradeService

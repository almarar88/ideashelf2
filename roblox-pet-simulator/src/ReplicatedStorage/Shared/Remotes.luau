--!strict
-- أسماء الـ Remotes. السيرفر ينشئها، والعميل ينتظرها.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = {}

Remotes.Events = {
	"ProfileUpdate",   -- S->C: الملف الكامل
	"Notify",          -- S->C: {Text, Color}
	"RewardPopup",     -- S->C: {Position, Coins, Diamonds}
	"HatchBroadcast",  -- S->C all: {Player, PetId, Variant}
	"Teleport",        -- C->S: zoneIndex
	"PromptPurchase",  -- C->S: kind, key
	"SetTarget",       -- C->S: breakableId?
	"RequestProfile",  -- C->S: العميل جاهز، أرسل الملف
}

Remotes.Functions = {
	"HatchEgg",       -- (eggId, count) -> {ok, error?, pets?}
	"PetAction",      -- (action, payload) -> {ok, error?}
	"Machine",        -- (kind, payload) -> {ok, error?, result?}
	"UnlockZone",     -- (index) -> {ok, error?}
	"BuyUpgrade",     -- (key) -> {ok, error?}
	"ClaimDaily",     -- () -> {ok, error?, reward?}
	"ClaimPlaytime",  -- (index) -> {ok, error?}
	"RedeemCode",     -- (code) -> {ok, error?}
	"GetServerTime",  -- () -> number
}

local folder: Folder

function Remotes.Init(): Folder
	if RunService:IsServer() then
		folder = Instance.new("Folder")
		folder.Name = "Remotes"
		for _, name in ipairs(Remotes.Events) do
			local ev = Instance.new("RemoteEvent")
			ev.Name = name
			ev.Parent = folder
		end
		for _, name in ipairs(Remotes.Functions) do
			local fn = Instance.new("RemoteFunction")
			fn.Name = name
			fn.Parent = folder
		end
		folder.Parent = ReplicatedStorage
	else
		folder = ReplicatedStorage:WaitForChild("Remotes") :: Folder
	end
	return folder
end

function Remotes.Event(name: string): RemoteEvent
	if not folder then
		Remotes.Init()
	end
	return folder:WaitForChild(name) :: RemoteEvent
end

function Remotes.Function(name: string): RemoteFunction
	if not folder then
		Remotes.Init()
	end
	return folder:WaitForChild(name) :: RemoteFunction
end

return Remotes

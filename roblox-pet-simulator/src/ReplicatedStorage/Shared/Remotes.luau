--!strict
-- أسماء الـ Remotes. السيرفر ينشئها، والعميل ينتظرها.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Remotes = {}

Remotes.Events = {
	"ProfileUpdate",   -- S->C: الملف الكامل
	"Notify",          -- S->C: {Text, Color}
	"RewardPopup",     -- S->C: {Position, Coins, Diamonds}
	"HatchBroadcast",  -- S->C all: {Player, PetId, Variant, Rarity}
	"Teleport",        -- C->S: zoneIndex
	"PromptPurchase",  -- C->S: kind, key
	"SetTarget",       -- C->S: breakableId?
	"RequestProfile",  -- C->S: العميل جاهز، أرسل الملف
	"TradeRequest",    -- C->S: targetUserId
	"TradeIncoming",   -- S->C: {FromUserId, FromName}
	"TradeRespond",    -- C->S: fromUserId, accept
	"TradeAction",     -- C->S: action, payload (Add/Remove/Confirm/Cancel)
	"TradeUpdate",     -- S->C: state أو nil
	"EventEffect",     -- S->C all: {Type, ...} تأثيرات بصرية
	"BossUpdate",      -- S->C all: {Active, Health, MaxHealth, Ends}
	"DungeonUpdate",   -- S->C all: {Active, Wave, Ends, Text}
}

Remotes.Functions = {
	"HatchEgg",       -- (eggId, count, variant) -> {ok, error?, pets?}
	"PetAction",      -- (action, payload) -> {ok, error?}
	"Machine",        -- (kind, payload) -> {ok, error?, result?}
	"UnlockZone",     -- (index) -> {ok, error?}
	"BuyUpgrade",     -- (key) -> {ok, error?}
	"ClaimDaily",     -- () -> {ok, error?, reward?}
	"ClaimPlaytime",  -- (index) -> {ok, error?}
	"RedeemCode",     -- (code) -> {ok, error?}
	"GetServerTime",  -- () -> number
	"Rebirth",        -- () -> {ok, error?}
	"Spin",           -- (paid: boolean) -> {ok, error?, index?, reward?}
	"Merchant",       -- (slotIndex) -> {ok, error?}
	"Hoverboard",     -- (action, id) -> {ok, error?}
	"UsePotion",      -- (key) -> {ok, error?}
	"BuyPotion",      -- (key) -> {ok, error?}
	"ClaimMission",   -- (index) -> {ok, error?}
	"ClaimAchievement", -- (id) -> {ok, error?}
	"ClaimTutorial",  -- () -> {ok, error?}
	"ClaimVIPDaily",  -- () -> {ok, error?}
	"Admin",          -- (command, payload) -> {ok, error?}
	"Market",         -- (action, payload) -> {ok, error?, ...} السوق: Browse/List/Buy/Cancel/SellNPC/Booth
	"Season",         -- (action, payload) -> {ok, error?} Claim tier
	"Craft",          -- (recipeId) -> {ok, error?}
	"Cosmetic",       -- (action, payload) -> {ok, error?, result?} Hatch / Equip / Unequip
	"Dungeon",        -- (action) -> {ok, error?} Start
	"Title",          -- (titleId) -> {ok, error?}
	"RebirthShop",    -- (key) -> {ok, error?}
	"GetLeaderboards", -- () -> {Coins={...}, ...}
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
		local state = Instance.new("Folder")
		state.Name = "GameState"
		state:SetAttribute("EventId", "")
		state:SetAttribute("EventEnds", 0)
		state:SetAttribute("NextEvent", 0)
		state:SetAttribute("DungeonWave", 0)
		state:SetAttribute("DungeonEnds", 0)
		state.Parent = ReplicatedStorage
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

function Remotes.State(): Folder
	return ReplicatedStorage:WaitForChild("GameState") :: Folder
end

return Remotes

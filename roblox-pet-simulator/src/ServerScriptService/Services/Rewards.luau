--!strict
-- منح المكافآت بصيغة موحدة { Coins, Diamonds, Potion, Count, Pet, Variant, Spins, Tokens }
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Modules.Format)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)

local Rewards = {}

function Rewards.Grant(player: Player, reward: any, coinScale: number?)
	if type(reward) ~= "table" then
		return
	end
	if reward.Coins then
		DataService.AddCoins(player, math.floor(reward.Coins * (coinScale or 1)))
	end
	if reward.Diamonds then
		DataService.AddDiamonds(player, reward.Diamonds)
	end
	if reward.Potion then
		DataService.GivePotion(player, reward.Potion, reward.Count or 1)
	end
	if reward.Pet then
		PetService.Add(player, reward.Pet, reward.Variant or "Normal", true)
	end
	if reward.Spins then
		DataService.AddSpins(player, reward.Spins)
	end
	if reward.Tokens then
		DataService.AddTokens(player, reward.Tokens)
	end
	DataService.MarkDirty(player)
end

function Rewards.Describe(reward: any, coinScale: number?): string
	local parts = {}
	if reward.Coins then
		table.insert(parts, "💰 " .. Format.Number(reward.Coins * (coinScale or 1)))
	end
	if reward.Diamonds then
		table.insert(parts, "💎 " .. Format.Number(reward.Diamonds))
	end
	if reward.Potion then
		table.insert(parts, "🧪 " .. reward.Potion .. (reward.Count and (" x" .. reward.Count) or ""))
	end
	if reward.Pet then
		table.insert(parts, "🐾 " .. reward.Pet)
	end
	if reward.Spins then
		table.insert(parts, "🎡 " .. reward.Spins)
	end
	if reward.Tokens then
		table.insert(parts, "🔁 " .. reward.Tokens)
	end
	return table.concat(parts, "  ")
end

return Rewards

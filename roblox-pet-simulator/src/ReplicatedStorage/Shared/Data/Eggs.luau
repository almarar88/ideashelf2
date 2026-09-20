--!strict
-- تعريف البيض: التكلفة، العملة، المنطقة، الحيوانات مع نسبة كل واحد (المجموع 100)
local Eggs = {}

export type EggDef = {
	Id: string,
	Name: string,
	Zone: number,
	Cost: number,
	Currency: string, -- "Coins" | "Diamonds"
	Color: Color3,
	Accent: Color3,
	Pets: { { Pet: string, Chance: number } },
	VIPOnly: boolean?,
	Slot: number, -- مكان البيضة داخل المنطقة
	Huge: string?, -- حيوان عملاق بفرصة نادرة جداً
	HugeChance: number?,
}

local function pets(t: { { any } })
	local out = {}
	for _, p in ipairs(t) do
		table.insert(out, { Pet = p[1], Chance = p[2] })
	end
	return out
end

local SIX = { 45, 30, 15, 7, 2.5, 0.5 }
local FIVE = { 40, 30, 18, 9, 3 }
local FOUR = { 60, 30, 8, 2 }

local function even(ids: { string }, chances: { number })
	local out = {}
	for i, id in ipairs(ids) do
		table.insert(out, { id, chances[i] })
	end
	return pets(out)
end

Eggs.List = {
	{ Id = "StarterEgg", Name = "Starter Egg", Zone = 1, Cost = 100, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(250, 250, 250), Accent = Color3.fromRGB(120, 200, 120),
		Pets = even({ "cat", "dog", "bunny", "bear", "fox", "dragon_hatchling" }, SIX), Huge = "huge_cat", HugeChance = 0.0005 },
	{ Id = "DiamondEgg", Name = "Diamond Egg", Zone = 1, Cost = 250, Currency = "Diamonds", Slot = 2,
		Color = Color3.fromRGB(170, 240, 255), Accent = Color3.fromRGB(255, 255, 255),
		Pets = even({ "crystal_cat", "diamond_dog", "sapphire_bird", "emerald_dragon" }, FOUR) },
	{ Id = "ForestEgg", Name = "Forest Egg", Zone = 2, Cost = 750, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(90, 170, 80), Accent = Color3.fromRGB(120, 80, 40),
		Pets = even({ "squirrel", "owl", "deer", "mushroom_blob", "forest_spirit", "ancient_ent" }, SIX) },
	{ Id = "BeachEgg", Name = "Beach Egg", Zone = 3, Cost = 5000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(255, 220, 130), Accent = Color3.fromRGB(60, 170, 255),
		Pets = even({ "crab", "fish", "turtle", "seagull", "octopus", "kraken" }, SIX) },
	{ Id = "DesertEgg", Name = "Desert Egg", Zone = 4, Cost = 40000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(230, 190, 110), Accent = Color3.fromRGB(200, 60, 40),
		Pets = even({ "scorpion", "camel", "cobra", "sand_golem", "mummy_cat", "pharaoh_dragon" }, SIX) },
	{ Id = "FrozenEgg", Name = "Frozen Egg", Zone = 5, Cost = 300000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(200, 235, 255), Accent = Color3.fromRGB(80, 150, 255),
		Pets = even({ "penguin", "snow_bunny", "seal", "yeti", "ice_golem", "frost_dragon" }, SIX) },
	{ Id = "LavaEgg", Name = "Lava Egg", Zone = 6, Cost = 2000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(60, 30, 30), Accent = Color3.fromRGB(255, 100, 0),
		Pets = even({ "magma_slime", "fire_fox", "lava_bird", "obsidian_golem", "inferno_demon", "phoenix" }, SIX) },
	{ Id = "CloudEgg", Name = "Cloud Egg", Zone = 7, Cost = 15000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(255, 255, 255), Accent = Color3.fromRGB(255, 220, 90),
		Pets = even({ "cloud_cat", "angel_bunny", "storm_bird", "wind_spirit", "thunder_dragon", "celestial_unicorn" }, SIX) },
	{ Id = "GalaxyEgg", Name = "Galaxy Egg", Zone = 8, Cost = 120000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(40, 20, 80), Accent = Color3.fromRGB(255, 0, 255),
		Pets = even({ "alien_blob", "moon_cat", "rocket_dog", "nebula_fox", "void_robot", "cosmic_dragon" }, SIX) },
	{ Id = "RainbowEgg", Name = "Rainbow Egg", Zone = 9, Cost = 1000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(255, 120, 200), Accent = Color3.fromRGB(0, 255, 200),
		Pets = even({ "rainbow_slime", "prism_cat", "spectrum_bird", "aurora_unicorn", "chroma_dragon", "hue_overlord" }, SIX) },
	{ Id = "VoidEgg", Name = "Void Egg", Zone = 10, Cost = 8000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(15, 15, 20), Accent = Color3.fromRGB(150, 0, 255),
		Pets = even({ "shadow_cat", "dark_ghost", "void_demon", "null_golem", "eclipse_dragon", "the_overlord" }, SIX), Huge = "huge_dragon", HugeChance = 0.002 },
	{ Id = "MythicEgg", Name = "Mythic Egg", Zone = 10, Cost = 5000, Currency = "Diamonds", Slot = 2,
		Color = Color3.fromRGB(120, 0, 30), Accent = Color3.fromRGB(255, 215, 0),
		Pets = even({ "titan_dragon", "chaos_unicorn", "omega_robot", "dominus_cat" }, FOUR), Huge = "huge_dominus", HugeChance = 0.01 },
	{ Id = "VIPEgg", Name = "VIP Egg", Zone = 0, Cost = 50000, Currency = "Coins", Slot = 1, VIPOnly = true,
		Color = Color3.fromRGB(255, 215, 0), Accent = Color3.fromRGB(255, 255, 255),
		Pets = even({ "vip_cat", "vip_dog", "royal_fox", "golden_dragon", "emperor_unicorn" }, FIVE) },
	{ Id = "RebirthEgg", Name = "Rebirth Egg", Zone = 1, Cost = 1, Currency = "Tokens", Slot = 3,
		Color = Color3.fromRGB(255, 255, 255), Accent = Color3.fromRGB(255, 80, 0),
		Pets = even({ "reborn_cat", "phoenix_bunny", "eternal_golem", "ascended_dragon", "immortal_overlord" }, { 35, 30, 22, 10, 3 }) },
	-- العالم الثاني
	{ Id = "TechEgg", Name = "Tech Egg", Zone = 11, Cost = 60000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(30, 30, 50), Accent = Color3.fromRGB(0, 255, 255),
		Pets = even({ "cyber_cat", "drone_bee", "mech_dog", "circuit_fox", "laser_golem", "mecha_dragon" }, SIX), Huge = "huge_robot", HugeChance = 0.004 },
	{ Id = "CyberForestEgg", Name = "Cyber Forest Egg", Zone = 12, Cost = 500000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(20, 60, 20), Accent = Color3.fromRGB(57, 255, 20),
		Pets = even({ "pixel_bunny", "glitch_slime", "neon_owl", "data_deer", "virus_demon", "matrix_ent" }, SIX) },
	{ Id = "NeonCityEgg", Name = "Neon City Egg", Zone = 13, Cost = 4000000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(40, 10, 60), Accent = Color3.fromRGB(255, 45, 149),
		Pets = even({ "neon_cat", "taxi_dog", "hologram_ghost", "synth_fox", "skyline_robot", "vapor_dragon" }, SIX), Huge = "huge_cat", HugeChance = 0.004 },
	{ Id = "DataCoreEgg", Name = "Data Core Egg", Zone = 14, Cost = 30000000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(10, 10, 60), Accent = Color3.fromRGB(0, 206, 209),
		Pets = even({ "byte_blob", "cache_cat", "server_golem", "firewall_demon", "quantum_owl", "core_guardian" }, SIX) },
	{ Id = "QuantumEgg", Name = "Quantum Egg", Zone = 15, Cost = 250000000000000, Currency = "Coins", Slot = 1,
		Color = Color3.fromRGB(0, 0, 30), Accent = Color3.fromRGB(255, 0, 255),
		Pets = even({ "quark_slime", "photon_bunny", "entangled_cat", "singularity_ghost", "nova_unicorn", "quantum_dragon", "omniverse_overlord" }, { 40, 28, 16, 9, 4.5, 2, 0.5 }), Huge = "huge_dragon", HugeChance = 0.003 },
}

Eggs.ById = {} :: { [string]: EggDef }
for _, e in ipairs(Eggs.List) do
	if e.Huge and e.HugeChance then
		table.insert(e.Pets, { Pet = e.Huge, Chance = e.HugeChance })
	end
	Eggs.ById[e.Id] = e
end

function Eggs.Get(id: string): EggDef?
	return Eggs.ById[id]
end

function Eggs.ForZone(zone: number): { EggDef }
	local out = {}
	for _, e in ipairs(Eggs.List) do
		if e.Zone == zone then
			table.insert(out, e)
		end
	end
	return out
end

return Eggs

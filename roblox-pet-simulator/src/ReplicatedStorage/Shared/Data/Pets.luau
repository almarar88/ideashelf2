--!strict
-- تعريف كل الحيوانات. القوة تُحسب من مستوى المنطقة × مضاعف الندرة.
local Pets = {}

local function hex(h: string): Color3
	return Color3.fromRGB(
		tonumber(h:sub(1, 2), 16) :: number,
		tonumber(h:sub(3, 4), 16) :: number,
		tonumber(h:sub(5, 6), 16) :: number
	)
end

export type PetDef = {
	Id: string,
	Name: string,
	Rarity: string,
	Power: number,
	Shape: string,
	Primary: Color3,
	Secondary: Color3,
	Egg: string,
	Tier: number,
	Scale: number,
}

local RARITY_MULT = { Common = 1, Uncommon = 1.6, Rare = 2.6, Epic = 4.2, Legendary = 7, Mythical = 12, Exclusive = 20, Huge = 60, Titanic = 400 }

local list: { PetDef } = {}
local byId: { [string]: PetDef } = {}

-- egg: معرف البيضة, tier: مستوى المنطقة, base: القوة الأساسية للمنطقة
local function egg(eggId: string, tier: number, base: number, pets: { { string } })
	for _, p in ipairs(pets) do
		local id, name, rarity, shape, c1, c2 = p[1], p[2], p[3], p[4], p[5], p[6]
		local def: PetDef = {
			Id = id,
			Name = name,
			Rarity = rarity,
			Power = math.floor(base * (RARITY_MULT[rarity] or 1) + 0.5),
			Shape = shape,
			Primary = hex(c1),
			Secondary = hex(c2),
			Egg = eggId,
			Tier = tier,
			Scale = rarity == "Titanic" and 5 or (rarity == "Huge" and 3.2 or 1),
		}
		table.insert(list, def)
		byId[id] = def
	end
end

-- المنطقة 1: البلدة
egg("StarterEgg", 1, 3, {
	{ "cat", "Cat", "Common", "cat", "F2F2F2", "FFB6C1" },
	{ "dog", "Dog", "Common", "dog", "C68642", "8D5524" },
	{ "bunny", "Bunny", "Uncommon", "bunny", "FFFFFF", "FFC0CB" },
	{ "bear", "Bear", "Rare", "bear", "8B5A2B", "D2A679" },
	{ "fox", "Fox", "Epic", "fox", "FF7F27", "FFFFFF" },
	{ "dragon_hatchling", "Dragon Hatchling", "Legendary", "dragon", "3CB371", "F5DEB3" },
})

egg("DiamondEgg", 1, 25, {
	{ "crystal_cat", "Crystal Cat", "Rare", "cat", "9FE2FF", "FFFFFF" },
	{ "diamond_dog", "Diamond Dog", "Epic", "dog", "B9F2FF", "E0FFFF" },
	{ "sapphire_bird", "Sapphire Bird", "Legendary", "bird", "0F52BA", "9FE2FF" },
	{ "emerald_dragon", "Emerald Dragon", "Mythical", "dragon", "50C878", "B9F2FF" },
})

-- المنطقة 2: الغابة
egg("ForestEgg", 2, 15, {
	{ "squirrel", "Squirrel", "Common", "fox", "A0522D", "F4E4C1" },
	{ "owl", "Owl", "Common", "bird", "8B7355", "F5F5DC" },
	{ "deer", "Deer", "Uncommon", "unicorn", "C19A6B", "FFFFFF" },
	{ "mushroom_blob", "Mushroom Blob", "Rare", "blob", "FF4040", "FFFFFF" },
	{ "forest_spirit", "Forest Spirit", "Epic", "ghost", "7CFC00", "228B22" },
	{ "ancient_ent", "Ancient Ent", "Legendary", "golem", "5C4033", "3CB371" },
})

-- المنطقة 3: الشاطئ
egg("BeachEgg", 3, 75, {
	{ "crab", "Crab", "Common", "blob", "FF4500", "FFA07A" },
	{ "fish", "Fish", "Common", "fish", "1E90FF", "FFD700" },
	{ "turtle", "Turtle", "Uncommon", "blob", "2E8B57", "8FBC8F" },
	{ "seagull", "Seagull", "Rare", "bird", "FFFFFF", "FFD700" },
	{ "octopus", "Octopus", "Epic", "alien", "9932CC", "DA70D6" },
	{ "kraken", "Kraken", "Legendary", "demon", "191970", "00CED1" },
})

-- المنطقة 4: الصحراء
egg("DesertEgg", 4, 375, {
	{ "scorpion", "Scorpion", "Common", "robot", "8B0000", "FFD700" },
	{ "camel", "Camel", "Common", "unicorn", "D2B48C", "8B7355" },
	{ "cobra", "Cobra", "Uncommon", "fish", "556B2F", "FFD700" },
	{ "sand_golem", "Sand Golem", "Rare", "golem", "EDC9AF", "C2B280" },
	{ "mummy_cat", "Mummy Cat", "Epic", "cat", "F5F5DC", "DAA520" },
	{ "pharaoh_dragon", "Pharaoh Dragon", "Legendary", "dragon", "FFD700", "1E90FF" },
})

-- المنطقة 5: الجليد
egg("FrozenEgg", 5, 1875, {
	{ "penguin", "Penguin", "Common", "bird", "2F2F2F", "FFFFFF" },
	{ "snow_bunny", "Snow Bunny", "Common", "bunny", "F0FFFF", "B0E0E6" },
	{ "seal", "Seal", "Uncommon", "fish", "C0C0C0", "F8F8FF" },
	{ "yeti", "Yeti", "Rare", "bear", "F8F8FF", "87CEEB" },
	{ "ice_golem", "Ice Golem", "Epic", "golem", "ADD8E6", "FFFFFF" },
	{ "frost_dragon", "Frost Dragon", "Legendary", "dragon", "87CEFA", "FFFFFF" },
})

-- المنطقة 6: البركان
egg("LavaEgg", 6, 9375, {
	{ "magma_slime", "Magma Slime", "Common", "blob", "FF4500", "FFD700" },
	{ "fire_fox", "Fire Fox", "Common", "fox", "FF6347", "FFFF00" },
	{ "lava_bird", "Lava Bird", "Uncommon", "bird", "DC143C", "FF8C00" },
	{ "obsidian_golem", "Obsidian Golem", "Rare", "golem", "1C1C1C", "FF4500" },
	{ "inferno_demon", "Inferno Demon", "Epic", "demon", "B22222", "FFD700" },
	{ "phoenix", "Phoenix", "Legendary", "bird", "FF8C00", "FFD700" },
})

-- المنطقة 7: السماء
egg("CloudEgg", 7, 46875, {
	{ "cloud_cat", "Cloud Cat", "Common", "cat", "FFFFFF", "87CEEB" },
	{ "angel_bunny", "Angel Bunny", "Common", "bunny", "FFFAF0", "FFD700" },
	{ "storm_bird", "Storm Bird", "Uncommon", "bird", "4682B4", "FFFF00" },
	{ "wind_spirit", "Wind Spirit", "Rare", "ghost", "E0FFFF", "AFEEEE" },
	{ "thunder_dragon", "Thunder Dragon", "Epic", "dragon", "4169E1", "FFFF00" },
	{ "celestial_unicorn", "Celestial Unicorn", "Legendary", "unicorn", "FFFFFF", "FFD700" },
})

-- المنطقة 8: الفضاء
egg("GalaxyEgg", 8, 234375, {
	{ "alien_blob", "Alien Blob", "Common", "alien", "7FFF00", "000000" },
	{ "moon_cat", "Moon Cat", "Common", "cat", "C0C0C0", "FFFFE0" },
	{ "rocket_dog", "Rocket Dog", "Uncommon", "dog", "FF4500", "C0C0C0" },
	{ "nebula_fox", "Nebula Fox", "Rare", "fox", "8A2BE2", "FF69B4" },
	{ "void_robot", "Void Robot", "Epic", "robot", "2F2F4F", "00FFFF" },
	{ "cosmic_dragon", "Cosmic Dragon", "Legendary", "dragon", "191970", "FF00FF" },
})

-- المنطقة 9: قوس قزح
egg("RainbowEgg", 9, 1171875, {
	{ "rainbow_slime", "Rainbow Slime", "Common", "blob", "FF69B4", "00FFFF" },
	{ "prism_cat", "Prism Cat", "Common", "cat", "FFFFFF", "FF00FF" },
	{ "spectrum_bird", "Spectrum Bird", "Uncommon", "bird", "FF0000", "0000FF" },
	{ "aurora_unicorn", "Aurora Unicorn", "Rare", "unicorn", "98FB98", "DA70D6" },
	{ "chroma_dragon", "Chroma Dragon", "Epic", "dragon", "FF1493", "00FF7F" },
	{ "hue_overlord", "Hue Overlord", "Legendary", "demon", "FFD700", "FF00FF" },
})

-- المنطقة 10: الفراغ
egg("VoidEgg", 10, 5859375, {
	{ "shadow_cat", "Shadow Cat", "Common", "cat", "1A1A1A", "8A2BE2" },
	{ "dark_ghost", "Dark Ghost", "Common", "ghost", "2F2F2F", "9400D3" },
	{ "void_demon", "Void Demon", "Uncommon", "demon", "0B0B0B", "FF00FF" },
	{ "null_golem", "Null Golem", "Rare", "golem", "111111", "00FFFF" },
	{ "eclipse_dragon", "Eclipse Dragon", "Epic", "dragon", "000000", "FF4500" },
	{ "the_overlord", "The Overlord", "Legendary", "demon", "1C1C1C", "FF0000" },
})

egg("MythicEgg", 10, 25000000, {
	{ "titan_dragon", "Titan Dragon", "Legendary", "dragon", "8B0000", "FFD700" },
	{ "chaos_unicorn", "Chaos Unicorn", "Mythical", "unicorn", "000000", "FF00FF" },
	{ "omega_robot", "Omega Robot", "Mythical", "robot", "FFD700", "00FFFF" },
	{ "dominus_cat", "Dominus Cat", "Exclusive", "cat", "000000", "FFD700" },
})

-- بيضة VIP (متاحة فقط لأصحاب VIP)
egg("VIPEgg", 3, 400, {
	{ "vip_cat", "VIP Cat", "Rare", "cat", "FFD700", "FFFFFF" },
	{ "vip_dog", "VIP Dog", "Rare", "dog", "FFD700", "8B4513" },
	{ "royal_fox", "Royal Fox", "Epic", "fox", "800080", "FFD700" },
	{ "golden_dragon", "Golden Dragon", "Legendary", "dragon", "FFD700", "FF4500" },
	{ "emperor_unicorn", "Emperor Unicorn", "Mythical", "unicorn", "FFFFFF", "FFD700" },
})

-- ===== العالم الثاني: عالم التقنية =====
egg("TechEgg", 11, 29296875, {
	{ "cyber_cat", "Cyber Cat", "Common", "cat", "1E1E2E", "00FFFF" },
	{ "drone_bee", "Drone Bee", "Common", "bird", "FFD700", "1E1E2E" },
	{ "mech_dog", "Mech Dog", "Uncommon", "dog", "8A8A9A", "FF3C3C" },
	{ "circuit_fox", "Circuit Fox", "Rare", "fox", "00D1FF", "0A0A2A" },
	{ "laser_golem", "Laser Golem", "Epic", "golem", "2A2A3A", "FF00AA" },
	{ "mecha_dragon", "Mecha Dragon", "Legendary", "dragon", "C0C0C0", "00FFFF" },
})

egg("CyberForestEgg", 12, 146484375, {
	{ "pixel_bunny", "Pixel Bunny", "Common", "bunny", "7CFC00", "FFFFFF" },
	{ "glitch_slime", "Glitch Slime", "Common", "blob", "FF00FF", "00FF00" },
	{ "neon_owl", "Neon Owl", "Uncommon", "bird", "00FF7F", "FF1493" },
	{ "data_deer", "Data Deer", "Rare", "unicorn", "20B2AA", "E0FFFF" },
	{ "virus_demon", "Virus Demon", "Epic", "demon", "0F0F0F", "39FF14" },
	{ "matrix_ent", "Matrix Ent", "Legendary", "golem", "003300", "39FF14" },
})

egg("NeonCityEgg", 13, 732421875, {
	{ "neon_cat", "Neon Cat", "Common", "cat", "FF6EC7", "00F0FF" },
	{ "taxi_dog", "Taxi Dog", "Common", "dog", "FFD300", "111111" },
	{ "hologram_ghost", "Hologram Ghost", "Uncommon", "ghost", "66CCFF", "FFFFFF" },
	{ "synth_fox", "Synth Fox", "Rare", "fox", "9D00FF", "FF00C8" },
	{ "skyline_robot", "Skyline Robot", "Epic", "robot", "222233", "FF2D95" },
	{ "vapor_dragon", "Vapor Dragon", "Legendary", "dragon", "FF77FF", "77FFFF" },
})

egg("DataCoreEgg", 14, 3662109375, {
	{ "byte_blob", "Byte Blob", "Common", "blob", "3366FF", "FFFFFF" },
	{ "cache_cat", "Cache Cat", "Common", "cat", "6A5ACD", "E6E6FA" },
	{ "server_golem", "Server Golem", "Uncommon", "golem", "2F4F4F", "00CED1" },
	{ "firewall_demon", "Firewall Demon", "Rare", "demon", "8B0000", "FF8C00" },
	{ "quantum_owl", "Quantum Owl", "Epic", "bird", "4B0082", "00FFFF" },
	{ "core_guardian", "Core Guardian", "Legendary", "robot", "0B0B3B", "FFD700" },
})

egg("QuantumEgg", 15, 18310546875, {
	{ "quark_slime", "Quark Slime", "Common", "blob", "FF4500", "1E90FF" },
	{ "photon_bunny", "Photon Bunny", "Common", "bunny", "FFFACD", "FFD700" },
	{ "entangled_cat", "Entangled Cat", "Uncommon", "cat", "9370DB", "00FA9A" },
	{ "singularity_ghost", "Singularity Ghost", "Rare", "ghost", "000000", "FFFFFF" },
	{ "nova_unicorn", "Nova Unicorn", "Epic", "unicorn", "FF69B4", "FFFF00" },
	{ "quantum_dragon", "Quantum Dragon", "Legendary", "dragon", "00008B", "00FFFF" },
	{ "omniverse_overlord", "Omniverse Overlord", "Mythical", "demon", "120024", "FF00FF" },
})

-- ===== العالم الثالث: العالم الأسطوري =====
egg("EnchantedEgg", 16, 91552734375, {
	{ "fairy_bunny", "Fairy Bunny", "Common", "bunny", "FFB7FF", "FFFFFF" },
	{ "pixie_cat", "Pixie Cat", "Common", "cat", "DDA0DD", "FFD700" },
	{ "mushroom_golem", "Mushroom Golem", "Uncommon", "golem", "8B4513", "FF6347" },
	{ "moon_owl", "Moon Owl", "Rare", "bird", "191970", "F0E68C" },
	{ "wisp_ghost", "Wisp Ghost", "Epic", "ghost", "AFEEEE", "7FFFD4" },
	{ "elder_treant", "Elder Treant", "Legendary", "golem", "2F4F2F", "ADFF2F" },
})
egg("CrystalEgg", 17, 457763671875, {
	{ "quartz_slime", "Quartz Slime", "Common", "blob", "FFF0F5", "DA70D6" },
	{ "amethyst_fox", "Amethyst Fox", "Common", "fox", "9966CC", "E6E6FA" },
	{ "topaz_dog", "Topaz Dog", "Uncommon", "dog", "FFC87C", "FFFFFF" },
	{ "ruby_dragon", "Ruby Dragon", "Rare", "dragon", "E0115F", "FFD700" },
	{ "sapphire_golem", "Sapphire Golem", "Epic", "golem", "0F52BA", "B9F2FF" },
	{ "diamond_unicorn", "Diamond Unicorn", "Legendary", "unicorn", "F8F8FF", "B9F2FF" },
})
egg("DragonEgg", 18, 2288818359375, {
	{ "wyrmling", "Wyrmling", "Common", "dragon", "8FBC8F", "F5DEB3" },
	{ "ember_bird", "Ember Bird", "Common", "bird", "FF4500", "FFD700" },
	{ "stone_wyvern", "Stone Wyvern", "Uncommon", "dragon", "708090", "2F4F4F" },
	{ "storm_wyvern", "Storm Wyvern", "Rare", "dragon", "4682B4", "FFFF00" },
	{ "inferno_wyrm", "Inferno Wyrm", "Epic", "dragon", "B22222", "FF8C00" },
	{ "elder_dragon", "Elder Dragon", "Legendary", "dragon", "2F0A0A", "FFD700" },
	{ "dragon_emperor", "Dragon Emperor", "Mythical", "dragon", "FFD700", "8B0000" },
})
egg("CelestialEgg", 19, 11444091796875, {
	{ "cherub_bunny", "Cherub Bunny", "Common", "bunny", "FFFFFF", "FFD700" },
	{ "halo_cat", "Halo Cat", "Common", "cat", "FFFAF0", "FFE4B5" },
	{ "seraph_bird", "Seraph Bird", "Uncommon", "bird", "FFFFFF", "87CEFA" },
	{ "star_fox", "Star Fox", "Rare", "fox", "FFD700", "FFFFFF" },
	{ "archangel_unicorn", "Archangel Unicorn", "Epic", "unicorn", "FFFFFF", "FFD700" },
	{ "celestial_guardian", "Celestial Guardian", "Legendary", "golem", "F5F5F5", "FFD700" },
})
egg("EternalEgg", 20, 57220458984375, {
	{ "void_slime", "Void Slime", "Common", "blob", "0B0B0B", "FFFFFF" },
	{ "abyss_cat", "Abyss Cat", "Common", "cat", "050505", "8A2BE2" },
	{ "phantom_owl", "Phantom Owl", "Uncommon", "bird", "1C1C1C", "E6E6FA" },
	{ "eternity_ghost", "Eternity Ghost", "Rare", "ghost", "FFFFFF", "000000" },
	{ "oblivion_demon", "Oblivion Demon", "Epic", "demon", "000000", "FF0000" },
	{ "eternal_dragon", "Eternal Dragon", "Legendary", "dragon", "000000", "FFFFFF" },
	{ "the_creator", "The Creator", "Mythical", "unicorn", "FFFFFF", "000000" },
	{ "genesis_overlord", "Genesis Overlord", "Exclusive", "demon", "FFFFFF", "FFD700" },
})

-- بيضة البازار (تشترى بالجواهر في السوق)
egg("BazaarEgg", 6, 6000, {
	{ "bazaar_cat", "Bazaar Cat", "Rare", "cat", "D2691E", "FFD700" },
	{ "lantern_ghost", "Lantern Ghost", "Rare", "ghost", "FF8C00", "FFFF99" },
	{ "carpet_fox", "Carpet Fox", "Epic", "fox", "8B0000", "FFD700" },
	{ "genie_blob", "Genie Blob", "Epic", "blob", "1E90FF", "FFD700" },
	{ "sultan_dragon", "Sultan Dragon", "Legendary", "dragon", "4B0082", "FFD700" },
	{ "gem_golem", "Gem Golem", "Mythical", "golem", "7B68EE", "00FFFF" },
})

-- الحيوانات العملاقة الإضافية للعالم الثالث
egg("Huge2", 16, 30000000, {
	{ "huge_unicorn", "HUGE Unicorn", "Huge", "unicorn", "FFFFFF", "FFD700" },
	{ "huge_demon", "HUGE Demon", "Huge", "demon", "0B0B0B", "FF0000" },
	{ "huge_golem", "HUGE Golem", "Huge", "golem", "7B68EE", "00FFFF" },
})

-- التايتانيك: أندر الحيوانات (حجم x5، قوة هائلة)
egg("Titanic", 12, 50000000, {
	{ "titanic_dragon", "TITANIC Dragon", "Titanic", "dragon", "FFFFFF", "FF00FF" },
	{ "titanic_overlord", "TITANIC Overlord", "Titanic", "demon", "FFFFFF", "FF0000" },
	{ "titanic_cat", "TITANIC Cat", "Titanic", "cat", "FFFFFF", "00FFFF" },
	{ "titanic_phoenix", "TITANIC Phoenix", "Titanic", "bird", "FFFFFF", "FFA500" },
})

-- بيضة الريبيرث (تشترى بتوكنات الريبيرث)
egg("RebirthEgg", 8, 500000, {
	{ "reborn_cat", "Reborn Cat", "Epic", "cat", "FFFFFF", "FF4500" },
	{ "phoenix_bunny", "Phoenix Bunny", "Epic", "bunny", "FF8C00", "FFD700" },
	{ "eternal_golem", "Eternal Golem", "Legendary", "golem", "708090", "FF4500" },
	{ "ascended_dragon", "Ascended Dragon", "Mythical", "dragon", "FFD700", "FFFFFF" },
	{ "immortal_overlord", "Immortal Overlord", "Exclusive", "demon", "FFFFFF", "FF0000" },
})

-- الحيوانات العملاقة (Huge): فرصة نادرة جداً في بيض معينة
egg("Huge", 5, 2000, {
	{ "huge_cat", "HUGE Cat", "Huge", "cat", "F2F2F2", "FFB6C1" },
	{ "huge_dragon", "HUGE Dragon", "Huge", "dragon", "3CB371", "F5DEB3" },
	{ "huge_dominus", "HUGE Dominus", "Huge", "cat", "000000", "FFD700" },
	{ "huge_robot", "HUGE Robot", "Huge", "robot", "C0C0C0", "00FFFF" },
})

-- حيوانات المكافآت والتاجر والأحداث (لا تخرج من البيض)
egg("Rewards", 1, 60, {
	{ "gift_bear", "Gift Bear", "Epic", "bear", "FF0000", "00FF00" },
	{ "party_dog", "Party Dog", "Legendary", "dog", "FF69B4", "FFFF00" },
	{ "wheel_wizard", "Wheel Wizard", "Legendary", "ghost", "4B0082", "FFD700" },
})
egg("Merchant", 4, 600, {
	{ "merchant_mole", "Merchant Mole", "Rare", "blob", "8B4513", "FFD700" },
	{ "traveler_owl", "Traveler Owl", "Epic", "bird", "556B2F", "F5DEB3" },
	{ "bazaar_dragon", "Bazaar Dragon", "Legendary", "dragon", "B8860B", "FF4500" },
})
egg("Boss", 6, 20000, {
	{ "slime_king", "Slime King", "Mythical", "blob", "32CD32", "FFD700" },
})

Pets.List = list
Pets.ById = byId

function Pets.Get(id: string): PetDef?
	return byId[id]
end

return Pets

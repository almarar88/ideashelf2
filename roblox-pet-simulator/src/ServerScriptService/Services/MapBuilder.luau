--!strict
-- يبني العالم كاملاً بالكود: الجزر، الجسور، البوابات، البيض، الآلات، الزينة، منطقة VIP، اللوحات.
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Lighting = game:GetService("Lighting")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Eggs = require(Shared.Data.Eggs)
local Breakables = require(Shared.Data.Breakables)
local Format = require(Shared.Modules.Format)

local MapBuilder = {}

export type ZoneLayout = {
	Index: number,
	Center: Vector3,
	Spawn: Vector3,
	Spots: { Vector3 },
	Eggs: { [string]: Vector3 },
	Gate: BasePart?,
	Folder: Folder,
}

MapBuilder.Zones = {} :: { [number]: ZoneLayout }
MapBuilder.Boards = {} :: { [string]: TextLabel }
MapBuilder.Machines = {} :: { [string]: Model }
MapBuilder.Specials = {} :: { [string]: Vector3 }
MapBuilder.VIPPortal = nil :: BasePart?
MapBuilder.VIPReturnPortal = nil :: BasePart?

local SPACING = Config.Map.ZoneSpacing
local ISLAND = Config.Map.IslandSize
local BRIDGE = Config.Map.BridgeLength

local function part(parent: Instance, name: string, size: Vector3, cf: CFrame, color: Color3, material: Enum.Material?, shape: string?): BasePart
	local p: BasePart
	if shape == "wedge" then
		p = Instance.new("WedgePart")
	else
		local pp = Instance.new("Part")
		if shape == "ball" then
			pp.Shape = Enum.PartType.Ball
		elseif shape == "cyl" then
			pp.Shape = Enum.PartType.Cylinder
		end
		p = pp
	end
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Material = material or Enum.Material.SmoothPlastic
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if shape == "cone" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.FileMesh
		mesh.MeshId = "rbxassetid://1033714"
		mesh.Scale = Vector3.new(size.X / 2, size.Y / 2, size.Z / 2)
		mesh.Parent = p
	elseif shape == "egg" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.Sphere
		mesh.Parent = p
	end
	p.Parent = parent
	return p
end

local function billboard(parent: BasePart, text: string, size: UDim2, color: Color3, offset: number, textSize: number?): BillboardGui
	local bb = Instance.new("BillboardGui")
	bb.Size = size
	bb.StudsOffset = Vector3.new(0, offset, 0)
	bb.AlwaysOnTop = false
	bb.MaxDistance = 220
	bb.LightInfluence = 0
	local label = Instance.new("TextLabel")
	label.Size = UDim2.fromScale(1, 1)
	label.BackgroundTransparency = 1
	label.Text = text
	label.TextColor3 = color
	label.TextScaled = textSize == nil
	label.TextSize = textSize or 24
	label.Font = Enum.Font.FredokaOne
	label.TextStrokeTransparency = 0.2
	label.TextStrokeColor3 = Color3.new(0, 0, 0)
	label.Parent = bb
	bb.Parent = parent
	return bb
end

-- ===== الزينة =====
local function tree(parent: Instance, pos: Vector3, scale: number, leaf: Color3, rng: Random)
	local trunkH = 6 * scale
	part(parent, "Trunk", Vector3.new(1.4 * scale, trunkH, 1.4 * scale), CFrame.new(pos + Vector3.new(0, trunkH / 2, 0)), Color3.fromRGB(110, 75, 40), Enum.Material.Wood)
	for i = 1, 3 do
		local s = (5 - i) * 1.4 * scale
		part(parent, "Leaves", Vector3.new(s, s, s), CFrame.new(pos + Vector3.new(rng:NextNumber(-0.5, 0.5), trunkH + i * 1.6 * scale - 1, rng:NextNumber(-0.5, 0.5))), leaf, Enum.Material.Grass, "ball")
	end
end

local function palm(parent: Instance, pos: Vector3, rng: Random)
	local h = 10
	for i = 1, 5 do
		part(parent, "Trunk", Vector3.new(1.2, h / 5 + 0.2, 1.2), CFrame.new(pos + Vector3.new(i * 0.25, (i - 0.5) * h / 5, 0)), Color3.fromRGB(150, 110, 60), Enum.Material.Wood)
	end
	for i = 1, 6 do
		local ang = i / 6 * math.pi * 2
		part(parent, "Leaf", Vector3.new(1.2, 0.2, 6), CFrame.new(pos + Vector3.new(1.25, h, 0)) * CFrame.Angles(0, ang, 0) * CFrame.new(0, 0, -3) * CFrame.Angles(-0.35, 0, 0), Color3.fromRGB(60, 170, 70), Enum.Material.Grass)
	end
	part(parent, "Coconut", Vector3.new(1, 1, 1), CFrame.new(pos + Vector3.new(1.25, h - 0.6, 0)), Color3.fromRGB(90, 60, 30), nil, "ball")
end

local function cactus(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(5, 8)
	local green = Color3.fromRGB(60, 140, 70)
	part(parent, "Cactus", Vector3.new(2, h, 2), CFrame.new(pos + Vector3.new(0, h / 2, 0)) * CFrame.Angles(0, 0, math.pi / 2), green, Enum.Material.Grass, "cyl")
	part(parent, "Arm", Vector3.new(1.4, 3, 1.4), CFrame.new(pos + Vector3.new(1.8, h * 0.6, 0)) * CFrame.Angles(0, 0, math.pi / 2), green, Enum.Material.Grass, "cyl")
	part(parent, "Arm", Vector3.new(1.4, 1.4, 2.2), CFrame.new(pos + Vector3.new(1.2, h * 0.5, 0)) * CFrame.Angles(0, 0, math.pi / 2), green, Enum.Material.Grass, "cyl")
end

local function crystalCluster(parent: Instance, pos: Vector3, color: Color3, rng: Random, glow: boolean)
	for i = 1, 3 do
		local h = rng:NextNumber(4, 9)
		local w = rng:NextNumber(1.5, 2.5)
		local off = Vector3.new(rng:NextNumber(-2, 2), 0, rng:NextNumber(-2, 2))
		local c = part(parent, "Crystal", Vector3.new(w, h, w), CFrame.new(pos + off + Vector3.new(0, h / 2, 0)) * CFrame.Angles(rng:NextNumber(-0.25, 0.25), rng:NextNumber(0, 6), rng:NextNumber(-0.25, 0.25)), color, glow and Enum.Material.Neon or Enum.Material.Glass, "cone")
		c.Transparency = glow and 0 or 0.2
	end
end

local function cloudPuff(parent: Instance, pos: Vector3, rng: Random)
	for i = 1, 4 do
		local s = rng:NextNumber(5, 9)
		local c = part(parent, "Cloud", Vector3.new(s, s * 0.7, s), CFrame.new(pos + Vector3.new(rng:NextNumber(-4, 4), rng:NextNumber(3, 8), rng:NextNumber(-4, 4))), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic, "ball")
		c.CanCollide = false
		c.Transparency = 0.1
	end
end

local function lavaRock(parent: Instance, pos: Vector3, rng: Random)
	local s = rng:NextNumber(4, 8)
	local rock = part(parent, "Rock", Vector3.new(s, s * 0.8, s), CFrame.new(pos + Vector3.new(0, s * 0.3, 0)) * CFrame.Angles(rng:NextNumber(0, 1), rng:NextNumber(0, 6), 0), Color3.fromRGB(45, 35, 35), Enum.Material.Basalt)
	local lava = part(parent, "Lava", Vector3.new(s * 0.6, 0.4, s * 0.6), CFrame.new(pos + Vector3.new(0, s * 0.7, 0)), Color3.fromRGB(255, 110, 0), Enum.Material.Neon)
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 120, 0)
	light.Range = 14
	light.Parent = lava
	rock.CanCollide = true
end

local function goldPillar(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(8, 14)
	part(parent, "Pillar", Vector3.new(2.5, h, 2.5), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(255, 215, 0), Enum.Material.Metal)
	local top = part(parent, "Top", Vector3.new(3, 3, 3), CFrame.new(pos + Vector3.new(0, h + 1, 0)), Color3.fromRGB(255, 255, 255), Enum.Material.Neon, "ball")
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 240, 150)
	light.Range = 18
	light.Parent = top
end

local function iceSpike(parent: Instance, pos: Vector3, rng: Random)
	crystalCluster(parent, pos, Color3.fromRGB(200, 240, 255), rng, false)
end

local DECOR: { [string]: (Instance, Vector3, Random) -> () } = {
	trees = function(parent, pos, rng)
		tree(parent, pos, rng:NextNumber(0.9, 1.5), Color3.fromRGB(40 + rng:NextInteger(0, 40), 140 + rng:NextInteger(0, 50), 50), rng)
	end,
	palms = palm,
	cactus = cactus,
	ice = iceSpike,
	lava = lavaRock,
	clouds = cloudPuff,
	crystals = function(parent, pos, rng)
		crystalCluster(parent, pos, Color3.fromHSV(rng:NextNumber(), 0.7, 1), rng, true)
	end,
	gold = goldPillar,
}

-- ===== البيضة =====
local function buildEgg(parent: Instance, egg: Eggs.EggDef, pos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = egg.Id
	model:SetAttribute("EggId", egg.Id)
	part(model, "Pedestal", Vector3.new(1.2, 9, 9), CFrame.new(pos + Vector3.new(0, 0.6, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(230, 230, 235), Enum.Material.Marble, "cyl")
	part(model, "PedestalRing", Vector3.new(0.5, 10.5, 10.5), CFrame.new(pos + Vector3.new(0, 0.25, 0)) * CFrame.Angles(0, 0, math.pi / 2), egg.Accent, Enum.Material.Neon, "cyl")
	local shell = part(model, "Shell", Vector3.new(5, 6.5, 5), CFrame.new(pos + Vector3.new(0, 4.5, 0)), egg.Color, Enum.Material.SmoothPlastic, "egg")
	shell.CanCollide = false
	local rng = Random.new(#egg.Id * 7)
	for i = 1, 7 do
		local ang = rng:NextNumber(0, math.pi * 2)
		local y = rng:NextNumber(-1.8, 1.8)
		local r = 2.3 * math.sqrt(1 - (y / 3.2) ^ 2)
		local spot = part(model, "Spot", Vector3.new(1, 1, 1) * rng:NextNumber(0.6, 1.1), CFrame.new(pos + Vector3.new(math.cos(ang) * r, 4.5 + y, math.sin(ang) * r)), egg.Accent, Enum.Material.SmoothPlastic, "ball")
		spot.CanCollide = false
	end
	model.PrimaryPart = shell
	local currency = egg.Currency == "Coins" and "💰" or "💎"
	billboard(shell, egg.Name .. "\n" .. currency .. " " .. Format.Number(egg.Cost), UDim2.fromScale(12, 4), Color3.new(1, 1, 1), 5.5)
	if egg.VIPOnly then
		local crown = part(model, "Crown", Vector3.new(2, 2, 2), CFrame.new(pos + Vector3.new(0, 8.6, 0)), Color3.fromRGB(255, 215, 0), Enum.Material.Neon, "cone")
		crown.CanCollide = false
	end
	model.Parent = parent
	return model
end

-- ===== الآلات =====
local MACHINE_INFO = {
	{ Kind = "Golden", Name = "Golden Machine", Arabic = "آلة الذهب", Color = Color3.fromRGB(255, 200, 40) },
	{ Kind = "Rainbow", Name = "Rainbow Machine", Arabic = "آلة قوس قزح", Color = Color3.fromRGB(255, 100, 200) },
	{ Kind = "DarkMatter", Name = "Dark Matter Machine", Arabic = "آلة المادة المظلمة", Color = Color3.fromRGB(120, 40, 200) },
	{ Kind = "Fuse", Name = "Fusion Machine", Arabic = "آلة الدمج", Color = Color3.fromRGB(60, 200, 255) },
}

local function buildMachine(parent: Instance, info: any, pos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = info.Kind .. "Machine"
	model:SetAttribute("Machine", info.Kind)
	part(model, "Base", Vector3.new(1, 10, 10), CFrame.new(pos + Vector3.new(0, 0.5, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(60, 60, 70), Enum.Material.Metal, "cyl")
	local body = part(model, "Body", Vector3.new(6, 7, 6), CFrame.new(pos + Vector3.new(0, 4.5, 0)), Color3.fromRGB(40, 40, 50), Enum.Material.Metal)
	local glass = part(model, "Glass", Vector3.new(4.5, 4.5, 4.5), CFrame.new(pos + Vector3.new(0, 5, 0)), info.Color, Enum.Material.Glass, "ball")
	glass.Transparency = 0.35
	glass.CanCollide = false
	local core = part(model, "Core", Vector3.new(2, 2, 2), CFrame.new(pos + Vector3.new(0, 5, 0)), info.Color, Enum.Material.Neon, "ball")
	core.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = info.Color
	light.Range = 16
	light.Brightness = 1.5
	light.Parent = core
	local ring = part(model, "Ring", Vector3.new(0.6, 7.5, 7.5), CFrame.new(pos + Vector3.new(0, 8.3, 0)) * CFrame.Angles(0, 0, math.pi / 2), info.Color, Enum.Material.Neon, "cyl")
	ring.CanCollide = false
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "فتح"
	prompt.ObjectText = info.Name
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = body
	billboard(body, info.Name .. "\n" .. info.Arabic, UDim2.fromScale(14, 4), info.Color, 8)
	model.PrimaryPart = body
	model.Parent = parent
	return model
end

-- ===== الصناديق القابلة للكسر =====
function MapBuilder.BuildBreakable(typeName: string, pos: Vector3, scale: number?): Model
	local def = Breakables.Get(typeName) :: Breakables.BreakableDef
	local s = scale or 1
	local size = def.Size * s
	local model = Instance.new("Model")
	model.Name = typeName
	local base: BasePart
	if def.Shape == "pile" then
		base = part(model, "Base", Vector3.new(size.Y * 0.35, size.X, size.X), CFrame.new(pos + Vector3.new(0, size.Y * 0.18, 0)) * CFrame.Angles(0, 0, math.pi / 2), def.Color, def.Material, "cyl")
		part(model, "Coin", Vector3.new(size.Y * 0.3, size.X * 0.75, size.X * 0.75), CFrame.new(pos + Vector3.new(size.X * 0.1, size.Y * 0.5, -size.X * 0.08)) * CFrame.Angles(0, 0.4, math.pi / 2), def.Color, def.Material, "cyl").CanCollide = false
		part(model, "Coin", Vector3.new(size.Y * 0.28, size.X * 0.5, size.X * 0.5), CFrame.new(pos + Vector3.new(-size.X * 0.08, size.Y * 0.78, size.X * 0.06)) * CFrame.Angles(0, 0.9, math.pi / 2), Color3.fromRGB(255, 230, 120), def.Material, "cyl").CanCollide = false
	elseif def.Shape == "chest" or def.Shape == "giant" then
		base = part(model, "Base", Vector3.new(size.X, size.Y * 0.6, size.Z), CFrame.new(pos + Vector3.new(0, size.Y * 0.3, 0)), def.Color, def.Material)
		local lid = part(model, "Lid", Vector3.new(size.X, size.Y * 0.4, size.Z), CFrame.new(pos + Vector3.new(0, size.Y * 0.8, 0)), def.Color, def.Material)
		lid.CanCollide = false
		local band = Color3.fromRGB(255, 215, 0)
		if def.Shape == "giant" then
			band = Color3.fromRGB(255, 255, 255)
		end
		part(model, "Band", Vector3.new(size.X * 0.2, size.Y * 1.02, size.Z * 1.04), CFrame.new(pos + Vector3.new(0, size.Y * 0.5, 0)), band, Enum.Material.Metal).CanCollide = false
		part(model, "Lock", Vector3.new(size.X * 0.18, size.Y * 0.22, size.Z * 0.12), CFrame.new(pos + Vector3.new(0, size.Y * 0.55, -size.Z * 0.52)), band, Enum.Material.Metal).CanCollide = false
		if def.Shape == "giant" then
			local glow = part(model, "Glow", Vector3.new(size.X * 0.8, 0.5, size.Z * 0.8), CFrame.new(pos + Vector3.new(0, size.Y * 0.6, 0)), Color3.fromRGB(255, 120, 255), Enum.Material.Neon)
			glow.CanCollide = false
			local light = Instance.new("PointLight")
			light.Color = Color3.fromRGB(255, 120, 255)
			light.Range = 30
			light.Brightness = 2
			light.Parent = glow
		end
	elseif def.Shape == "crystal" then
		base = part(model, "Base", Vector3.new(size.X, size.Y, size.Z), CFrame.new(pos + Vector3.new(0, size.Y / 2, 0)), def.Color, def.Material, "cone")
		base.Transparency = 0.15
		for i = 1, 2 do
			local c = part(model, "Shard", Vector3.new(size.X * 0.6, size.Y * 0.55, size.Z * 0.6), CFrame.new(pos + Vector3.new(i == 1 and size.X * 0.6 or -size.X * 0.6, size.Y * 0.27, 0)) * CFrame.Angles(0, 0, i == 1 and -0.3 or 0.3), def.Color, Enum.Material.Neon, "cone")
			c.CanCollide = false
		end
		local light = Instance.new("PointLight")
		light.Color = def.Color
		light.Range = 12
		light.Parent = base
	else -- gift
		base = part(model, "Base", size, CFrame.new(pos + Vector3.new(0, size.Y / 2, 0)), def.Color, def.Material)
		local ribbon = Color3.fromRGB(255, 220, 60)
		part(model, "Ribbon", Vector3.new(size.X * 1.02, size.Y * 1.02, size.Z * 0.2), CFrame.new(pos + Vector3.new(0, size.Y / 2, 0)), ribbon, Enum.Material.SmoothPlastic).CanCollide = false
		part(model, "Ribbon", Vector3.new(size.X * 0.2, size.Y * 1.02, size.Z * 1.02), CFrame.new(pos + Vector3.new(0, size.Y / 2, 0)), ribbon, Enum.Material.SmoothPlastic).CanCollide = false
		part(model, "Bow", Vector3.new(size.X * 0.35, size.Y * 0.3, size.Z * 0.35), CFrame.new(pos + Vector3.new(0, size.Y * 1.1, 0)), ribbon, Enum.Material.SmoothPlastic, "ball").CanCollide = false
		local light = Instance.new("PointLight")
		light.Color = def.Color
		light.Range = 16
		light.Parent = base
	end
	base.CanCollide = true
	model.PrimaryPart = base
	local cd = Instance.new("ClickDetector")
	cd.MaxActivationDistance = 45
	cd.Parent = model
	return model
end

-- ===== الجزيرة =====
local function buildIsland(zone: Zones.ZoneDef, center: Vector3, size: number, parent: Folder, rng: Random): ZoneLayout
	local half = size / 2
	local folder = Instance.new("Folder")
	folder.Name = "Zone_" .. zone.Id
	folder.Parent = parent

	local ground = part(folder, "Ground", Vector3.new(size, 12, size), CFrame.new(center + Vector3.new(0, -6, 0)), zone.Ground, zone.Material)
	ground:SetAttribute("Zone", zone.Index)
	-- حواف الجزيرة
	local rim = part(folder, "Rim", Vector3.new(size + 6, 6, size + 6), CFrame.new(center + Vector3.new(0, -9, 0)), zone.Accent, Enum.Material.Slate)
	rim.CanCollide = false
	part(folder, "Underside", Vector3.new(size * 0.8, 30, size * 0.8), CFrame.new(center + Vector3.new(0, -27, 0)), Color3.fromRGB(80, 60, 50), Enum.Material.Slate)

	-- الزينة على الأطراف
	local decorFn = DECOR[zone.Decor] or DECOR.trees
	local step = 24
	local function reserved(x: number, z: number): boolean
		return zone.Index == 1 and z < -100 and x < -55 and x > -125
	end
	for x = -half + 14, half - 14, step do
		for _, z in ipairs({ -half + 14, half - 14 }) do
			if math.abs(x) > 24 and not reserved(x, z) then
				decorFn(folder, center + Vector3.new(x + rng:NextNumber(-4, 4), 0, z + rng:NextNumber(-4, 4)), rng)
			end
		end
	end
	for z = -half + 14 + step, half - 14 - step, step do
		for _, x in ipairs({ -half + 14, half - 14 }) do
			decorFn(folder, center + Vector3.new(x + rng:NextNumber(-4, 4), 0, z + rng:NextNumber(-4, 4)), rng)
		end
	end

	-- نقاط الصناديق
	local spots = {}
	local xMin, xMax = -half * 0.4, half * 0.62
	local zMin, zMax = -half * 0.72, half * 0.64
	for x = xMin, xMax, 24 do
		for z = zMin, zMax, 24 do
			table.insert(spots, center + Vector3.new(x + rng:NextNumber(-5, 5), 0, z + rng:NextNumber(-5, 5)))
		end
	end
	for i = #spots, 2, -1 do
		local j = rng:NextInteger(1, i)
		spots[i], spots[j] = spots[j], spots[i]
	end

	-- البيض
	local eggs = {}
	local eggList = Eggs.ForZone(zone.Index)
	for _, egg in ipairs(eggList) do
		local pos = center + Vector3.new(-half * 0.72, 0, -40 + (egg.Slot - 1) * 40)
		buildEgg(folder, egg, pos)
		eggs[egg.Id] = pos
	end

	-- لافتة اسم المنطقة
	part(folder, "SignPost", Vector3.new(1, 8, 1), CFrame.new(center + Vector3.new(24, 4, -half * 0.8)), Color3.fromRGB(120, 80, 40), Enum.Material.Wood)
	local sign = part(folder, "Sign", Vector3.new(12, 5, 0.6), CFrame.new(center + Vector3.new(24, 9, -half * 0.8)), Color3.fromRGB(240, 220, 170), Enum.Material.Wood)
	billboard(sign, zone.Name .. "\n" .. zone.Arabic, UDim2.fromScale(14, 5), Color3.new(1, 1, 1), 1)

	local spawn = center + Vector3.new(0, 0, -half * 0.78)

	return {
		Index = zone.Index,
		Center = center,
		Spawn = spawn,
		Spots = spots,
		Eggs = eggs,
		Gate = nil,
		Folder = folder,
	}
end

local function buildBridgeAndGate(fromLayout: ZoneLayout, toZone: Zones.ZoneDef, parent: Folder)
	local half = ISLAND / 2
	local c = fromLayout.Center
	local bridge = part(parent, "Bridge", Vector3.new(26, 2, BRIDGE + 6), CFrame.new(c + Vector3.new(0, -1, half + BRIDGE / 2)), Color3.fromRGB(170, 130, 90), Enum.Material.WoodPlanks)
	bridge:SetAttribute("Zone", toZone.Index)
	for _, s in ipairs({ -1, 1 }) do
		part(parent, "Rail", Vector3.new(1, 3, BRIDGE + 6), CFrame.new(c + Vector3.new(s * 12.5, 1.5, half + BRIDGE / 2)), Color3.fromRGB(120, 85, 50), Enum.Material.Wood).CanCollide = false
	end
	local gate = part(parent, "Gate", Vector3.new(26, 14, 2), CFrame.new(c + Vector3.new(0, 7, half - 2)), toZone.Accent, Enum.Material.ForceField)
	gate.Transparency = 0.3
	gate:SetAttribute("Zone", toZone.Index)
	gate:SetAttribute("Cost", toZone.Cost)
	for _, s in ipairs({ -1, 1 }) do
		part(parent, "Pillar", Vector3.new(3, 16, 3), CFrame.new(c + Vector3.new(s * 14.5, 8, half - 2)), Color3.fromRGB(90, 90, 100), Enum.Material.Marble)
	end
	part(parent, "Arch", Vector3.new(32, 3, 3), CFrame.new(c + Vector3.new(0, 16.5, half - 2)), Color3.fromRGB(90, 90, 100), Enum.Material.Marble)
	billboard(gate, "🔒 " .. toZone.Name .. "\n💰 " .. Format.Number(toZone.Cost), UDim2.fromScale(16, 5), Color3.new(1, 1, 1), 10)
	return gate
end

local function buildPortal(parent: Instance, pos: Vector3, color: Color3, label: string): BasePart
	local model = Instance.new("Model")
	model.Name = "Portal"
	for _, s in ipairs({ -1, 1 }) do
		part(model, "Pillar", Vector3.new(2, 12, 2), CFrame.new(pos + Vector3.new(s * 5, 6, 0)), color, Enum.Material.Metal)
	end
	part(model, "Top", Vector3.new(12, 2, 2), CFrame.new(pos + Vector3.new(0, 12.5, 0)), color, Enum.Material.Metal)
	local field = part(model, "Field", Vector3.new(8, 11, 0.6), CFrame.new(pos + Vector3.new(0, 5.5, 0)), color, Enum.Material.Neon)
	field.Transparency = 0.45
	field.CanCollide = false
	billboard(field, label, UDim2.fromScale(14, 4), color, 9)
	local light = Instance.new("PointLight")
	light.Color = color
	light.Range = 20
	light.Brightness = 2
	light.Parent = field
	model.Parent = parent
	return field
end

local function buildBoard(parent: Instance, pos: Vector3, title: string, color: Color3): TextLabel
	local rot = CFrame.Angles(0, -math.pi / 2, 0) -- الوجه الأيمن يشير إلى +Z
	local board = part(parent, "Board", Vector3.new(1, 16, 22), CFrame.new(pos + Vector3.new(0, 9, 0)) * rot, Color3.fromRGB(30, 30, 40), Enum.Material.Metal)
	part(parent, "BoardFrame", Vector3.new(1.4, 17, 23), CFrame.new(pos + Vector3.new(0, 9, -0.1)) * rot, color, Enum.Material.Neon).CanCollide = false
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Right
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.LightInfluence = 0
	local titleLabel = Instance.new("TextLabel")
	titleLabel.Size = UDim2.new(1, 0, 0.15, 0)
	titleLabel.BackgroundTransparency = 1
	titleLabel.Text = title
	titleLabel.TextColor3 = color
	titleLabel.Font = Enum.Font.FredokaOne
	titleLabel.TextScaled = true
	titleLabel.Parent = gui
	local list = Instance.new("TextLabel")
	list.Name = "List"
	list.Size = UDim2.new(0.94, 0, 0.83, 0)
	list.Position = UDim2.new(0.03, 0, 0.16, 0)
	list.BackgroundTransparency = 1
	list.Text = "..."
	list.TextColor3 = Color3.new(1, 1, 1)
	list.Font = Enum.Font.FredokaOne
	list.TextScaled = true
	list.TextXAlignment = Enum.TextXAlignment.Left
	list.TextYAlignment = Enum.TextYAlignment.Top
	list.Parent = gui
	gui.Parent = board
	return list
end

local function setupLighting()
	Lighting.Brightness = 2
	Lighting.ClockTime = 14
	Lighting.Ambient = Color3.fromRGB(120, 120, 140)
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 140, 150)
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.6
	if not Lighting:FindFirstChildOfClass("Atmosphere") then
		local atm = Instance.new("Atmosphere")
		atm.Density = 0.32
		atm.Offset = 0.25
		atm.Color = Color3.fromRGB(199, 199, 210)
		atm.Decay = Color3.fromRGB(106, 112, 125)
		atm.Glare = 0.2
		atm.Haze = 1
		atm.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("BloomEffect") then
		local bloom = Instance.new("BloomEffect")
		bloom.Intensity = 0.6
		bloom.Size = 24
		bloom.Threshold = 1.2
		bloom.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("ColorCorrectionEffect") then
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Saturation = 0.15
		cc.Contrast = 0.05
		cc.Parent = Lighting
	end
	if not Lighting:FindFirstChildOfClass("SunRaysEffect") then
		local sun = Instance.new("SunRaysEffect")
		sun.Intensity = 0.08
		sun.Parent = Lighting
	end
end

function MapBuilder.ZoneOfPosition(pos: Vector3): number
	local vipCenter = Config.Map.VIPOffset
	if (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(vipCenter.X, 0, vipCenter.Z)).Magnitude < 220 then
		return 0
	end
	local idx = math.floor(pos.Z / SPACING + 0.5) + 1
	return math.clamp(idx, 1, #Zones.List)
end

function MapBuilder.Build()
	setupLighting()
	local existing = Workspace:FindFirstChild("Map")
	if existing then
		existing:Destroy()
	end
	local map = Instance.new("Folder")
	map.Name = "Map"
	map.Parent = Workspace

	local rng = Random.new(2024)

	-- المناطق
	for i, zone in ipairs(Zones.List) do
		local center = Vector3.new(0, 0, (i - 1) * SPACING)
		local layout = buildIsland(zone, center, ISLAND, map, rng)
		MapBuilder.Zones[i] = layout
		if i > 1 then
			local prev = MapBuilder.Zones[i - 1]
			layout.Gate = buildBridgeAndGate(prev, zone, prev.Folder)
		end
	end

	-- منطقة VIP
	local vipCenter = Config.Map.VIPOffset
	local vipLayout = buildIsland(Zones.VIP, vipCenter, 200, map, rng)
	MapBuilder.Zones[0] = vipLayout
	MapBuilder.VIPReturnPortal = buildPortal(vipLayout.Folder, vipCenter + Vector3.new(0, 0, -70), Color3.fromRGB(120, 200, 255), "🏠 العودة للبلدة")
	MapBuilder.VIPReturnPortal:SetAttribute("Portal", "Return")

	-- البلدة: سبون، آلات، صناديق خاصة، بوابة VIP، لوحات
	local town = MapBuilder.Zones[1]
	local tf = town.Folder
	local spawnLoc = Instance.new("SpawnLocation")
	spawnLoc.Size = Vector3.new(14, 1, 14)
	spawnLoc.CFrame = CFrame.new(town.Spawn + Vector3.new(0, 0.5, 0))
	spawnLoc.Anchored = true
	spawnLoc.Color = Color3.fromRGB(255, 255, 255)
	spawnLoc.Material = Enum.Material.Marble
	spawnLoc.TopSurface = Enum.SurfaceType.Smooth
	spawnLoc.Neutral = true
	spawnLoc.Duration = 0
	spawnLoc.Parent = tf

	for i, info in ipairs(MACHINE_INFO) do
		local pos = town.Center + Vector3.new(118, 0, -105 + (i - 1) * 34)
		MapBuilder.Machines[info.Kind] = buildMachine(tf, info, pos)
	end

	MapBuilder.Specials.GiantChest = town.Center + Vector3.new(60, 0, 118)
	MapBuilder.Specials.MysteryBox = town.Center + Vector3.new(-60, 0, 118)

	MapBuilder.VIPPortal = buildPortal(tf, town.Center + Vector3.new(-118, 0, -112), Color3.fromRGB(255, 215, 0), "👑 VIP Lounge")
	MapBuilder.VIPPortal:SetAttribute("Portal", "VIP")

	MapBuilder.Boards.Coins = buildBoard(tf, town.Center + Vector3.new(-72, 0, -140), "💰 أغنى اللاعبين", Color3.fromRGB(255, 200, 40))
	MapBuilder.Boards.Hatches = buildBoard(tf, town.Center + Vector3.new(-104, 0, -140), "🥚 أكثر فتحاً للبيض", Color3.fromRGB(120, 200, 255))

	-- أرضية الموت تحت الجزر
	local kill = part(map, "KillPlane", Vector3.new(4000, 1, 8000), CFrame.new(300, -120, 2000), Color3.fromRGB(20, 20, 30), Enum.Material.SmoothPlastic)
	kill.Transparency = 1
	kill.CanCollide = false
	kill.Touched:Connect(function(hit)
		local hum = hit.Parent and hit.Parent:FindFirstChildOfClass("Humanoid")
		if hum then
			hum.Health = 0
		end
	end)
end

return MapBuilder

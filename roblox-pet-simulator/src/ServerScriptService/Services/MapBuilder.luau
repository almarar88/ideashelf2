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
MapBuilder.World2Portal = nil :: BasePart?
MapBuilder.World1Portal = nil :: BasePart?
MapBuilder.Portals = {} :: { [string]: BasePart }
MapBuilder.Booths = {} :: { Model }

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

local function techPillar(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(8, 16)
	part(parent, "Pillar", Vector3.new(3, h, 3), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(50, 55, 75), Enum.Material.Metal)
	for i = 1, 3 do
		local strip = part(parent, "Strip", Vector3.new(3.2, 0.4, 3.2), CFrame.new(pos + Vector3.new(0, h * i / 4, 0)), Color3.fromRGB(0, 255, 255), Enum.Material.Neon)
		strip.CanCollide = false
	end
	local top = part(parent, "Top", Vector3.new(2, 2, 2), CFrame.new(pos + Vector3.new(0, h + 1, 0)), Color3.fromRGB(0, 255, 255), Enum.Material.Neon, "ball")
	top.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(0, 255, 255)
	light.Range = 16
	light.Parent = top
end

local function cyberTree(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(6, 10)
	part(parent, "Trunk", Vector3.new(1.4, h, 1.4), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(20, 30, 25), Enum.Material.Metal)
	for i = 1, 3 do
		local s = (5 - i) * 1.6
		local leaves = part(parent, "Leaves", Vector3.new(s, s * 0.6, s), CFrame.new(pos + Vector3.new(0, h + i * 1.4 - 1, 0)), Color3.fromRGB(57, 255, 20), Enum.Material.Neon)
		leaves.Transparency = 0.2
		leaves.CanCollide = false
	end
end

local function neonBuilding(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(14, 30)
	local w = rng:NextNumber(6, 10)
	part(parent, "Building", Vector3.new(w, h, w), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(25, 20, 40), Enum.Material.Concrete)
	local colors = { Color3.fromRGB(255, 45, 149), Color3.fromRGB(0, 240, 255), Color3.fromRGB(255, 230, 0) }
	for y = 3, h - 2, 3 do
		for _, side in ipairs({ -1, 1 }) do
			local win = part(parent, "Window", Vector3.new(w * 0.6, 1.2, 0.3), CFrame.new(pos + Vector3.new(0, y, side * (w / 2 + 0.1))), colors[rng:NextInteger(1, 3)], Enum.Material.Neon)
			win.CanCollide = false
		end
	end
	local sign = part(parent, "Sign", Vector3.new(w * 0.8, 1.5, 0.4), CFrame.new(pos + Vector3.new(0, h + 1, 0)), colors[rng:NextInteger(1, 3)], Enum.Material.Neon)
	sign.CanCollide = false
end

local function serverRack(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(6, 10)
	part(parent, "Rack", Vector3.new(4, h, 3), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(30, 30, 45), Enum.Material.Metal)
	for y = 1, h - 1, 1.2 do
		local led = part(parent, "LED", Vector3.new(3, 0.3, 0.2), CFrame.new(pos + Vector3.new(0, y, -1.6)), rng:NextNumber() < 0.5 and Color3.fromRGB(0, 206, 209) or Color3.fromRGB(0, 255, 120), Enum.Material.Neon)
		led.CanCollide = false
	end
end

local function quantumOrb(parent: Instance, pos: Vector3, rng: Random)
	for i = 1, 3 do
		local s = rng:NextNumber(2, 5)
		local orb = part(parent, "Orb", Vector3.new(s, s, s), CFrame.new(pos + Vector3.new(rng:NextNumber(-4, 4), rng:NextNumber(4, 14), rng:NextNumber(-4, 4))), Color3.fromHSV(rng:NextNumber(), 0.8, 1), Enum.Material.Neon, "ball")
		orb.CanCollide = false
		orb.Transparency = 0.15
	end
	local ring = part(parent, "Ring", Vector3.new(0.5, 8, 8), CFrame.new(pos + Vector3.new(0, 6, 0)) * CFrame.Angles(rng:NextNumber(0, 3), rng:NextNumber(0, 3), 0), Color3.fromRGB(255, 0, 255), Enum.Material.Neon, "cyl")
	ring.CanCollide = false
	ring.Transparency = 0.4
end

local function magicTree(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(7, 12)
	part(parent, "Trunk", Vector3.new(1.6, h, 1.6), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(60, 30, 80), Enum.Material.Wood)
	for i = 1, 3 do
		local sz = (5 - i) * 1.7
		local leaves = part(parent, "Leaves", Vector3.new(sz, sz, sz), CFrame.new(pos + Vector3.new(rng:NextNumber(-0.5, 0.5), h + i * 1.5 - 1, rng:NextNumber(-0.5, 0.5))), Color3.fromHSV(rng:NextNumber(0.75, 0.95), 0.6, 1), Enum.Material.Grass, "ball")
		leaves.CanCollide = false
	end
	local glow = part(parent, "Glow", Vector3.new(1.2, 1.2, 1.2), CFrame.new(pos + Vector3.new(0, h + 2, 0)), Color3.fromRGB(255, 150, 255), Enum.Material.Neon, "ball")
	glow.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 150, 255)
	light.Range = 14
	light.Parent = glow
	local attach = Instance.new("Attachment")
	attach.Parent = glow
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(Color3.fromRGB(255, 180, 255))
	pe.Size = NumberSequence.new(0.3, 0)
	pe.Lifetime = NumberRange.new(1, 2)
	pe.Rate = 4
	pe.Speed = NumberRange.new(0.5, 1.5)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.LightEmission = 1
	pe.Parent = attach
end

local function bigCrystal(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(10, 22)
	local w = rng:NextNumber(3, 5)
	local c = part(parent, "BigCrystal", Vector3.new(w, h, w), CFrame.new(pos + Vector3.new(0, h / 2, 0)) * CFrame.Angles(rng:NextNumber(-0.2, 0.2), rng:NextNumber(0, 6), rng:NextNumber(-0.2, 0.2)), Color3.fromHSV(rng:NextNumber(0.5, 0.7), 0.5, 1), Enum.Material.Glass, "cone")
	c.Transparency = 0.25
	local light = Instance.new("PointLight")
	light.Color = c.Color
	light.Range = 18
	light.Parent = c
	crystalCluster(parent, pos + Vector3.new(rng:NextNumber(-3, 3), 0, rng:NextNumber(-3, 3)), c.Color, rng, true)
end

local function peak(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(14, 26)
	local w = rng:NextNumber(8, 12)
	part(parent, "Peak", Vector3.new(w, h, w), CFrame.new(pos + Vector3.new(0, h / 2, 0)), Color3.fromRGB(90, 60, 60), Enum.Material.Rock, "cone")
	local snow = part(parent, "Snow", Vector3.new(w * 0.35, h * 0.3, w * 0.35), CFrame.new(pos + Vector3.new(0, h * 0.85, 0)), Color3.fromRGB(255, 240, 240), Enum.Material.Snow, "cone")
	snow.CanCollide = false
	local lava = part(parent, "Lava", Vector3.new(w * 0.15, h * 0.12, w * 0.15), CFrame.new(pos + Vector3.new(0, h, 0)), Color3.fromRGB(255, 100, 20), Enum.Material.Neon, "ball")
	lava.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 100, 20)
	light.Range = 20
	light.Parent = lava
end

local function pillar(parent: Instance, pos: Vector3, rng: Random)
	local h = rng:NextNumber(14, 20)
	part(parent, "Pillar", Vector3.new(3, h, 3), CFrame.new(pos + Vector3.new(0, h / 2, 0)) * CFrame.Angles(0, 0, 0), Color3.fromRGB(250, 245, 255), Enum.Material.Marble, "cyl")
	part(parent, "Cap", Vector3.new(4.5, 1, 4.5), CFrame.new(pos + Vector3.new(0, h + 0.5, 0)), Color3.fromRGB(255, 220, 120), Enum.Material.Metal)
	part(parent, "Base", Vector3.new(4.5, 1, 4.5), CFrame.new(pos + Vector3.new(0, 0.5, 0)), Color3.fromRGB(255, 220, 120), Enum.Material.Metal)
	local orb = part(parent, "Orb", Vector3.new(2.5, 2.5, 2.5), CFrame.new(pos + Vector3.new(0, h + 2.5, 0)), Color3.fromRGB(255, 240, 180), Enum.Material.Neon, "ball")
	orb.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 240, 180)
	light.Range = 20
	light.Parent = orb
end

local function voidOrb(parent: Instance, pos: Vector3, rng: Random)
	local s = rng:NextNumber(4, 9)
	local orb = part(parent, "VoidOrb", Vector3.new(s, s, s), CFrame.new(pos + Vector3.new(0, rng:NextNumber(6, 16), 0)), Color3.new(0, 0, 0), Enum.Material.Neon, "ball")
	orb.CanCollide = false
	local ring = part(parent, "Ring", Vector3.new(0.4, s + 4, s + 4), orb.CFrame * CFrame.Angles(rng:NextNumber(0, 3), rng:NextNumber(0, 3), 0), Color3.new(1, 1, 1), Enum.Material.Neon, "cyl")
	ring.CanCollide = false
	ring.Transparency = 0.3
	local attach = Instance.new("Attachment")
	attach.Parent = orb
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(Color3.new(1, 1, 1), Color3.fromRGB(150, 0, 255))
	pe.Size = NumberSequence.new(0.5, 0)
	pe.Lifetime = NumberRange.new(1, 2)
	pe.Rate = 8
	pe.Speed = NumberRange.new(2, 4)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.LightEmission = 1
	pe.Parent = attach
end

local function marketLantern(parent: Instance, pos: Vector3, rng: Random)
	part(parent, "Post", Vector3.new(0.5, 8, 0.5), CFrame.new(pos + Vector3.new(0, 4, 0)), Color3.fromRGB(60, 40, 30), Enum.Material.Wood)
	local lantern = part(parent, "Lantern", Vector3.new(1.4, 2, 1.4), CFrame.new(pos + Vector3.new(0, 8.5, 0)), rng:NextNumber() < 0.5 and Color3.fromRGB(255, 120, 40) or Color3.fromRGB(255, 200, 60), Enum.Material.Neon)
	lantern.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = lantern.Color
	light.Range = 18
	light.Brightness = 1.2
	light.Parent = lantern
	-- سجادة
	local rug = part(parent, "Rug", Vector3.new(6, 0.2, 4), CFrame.new(pos + Vector3.new(rng:NextNumber(-3, 3), 0.1, rng:NextNumber(-3, 3))) * CFrame.Angles(0, rng:NextNumber(0, 3), 0), Color3.fromHSV(rng:NextNumber(), 0.7, 0.8), Enum.Material.Fabric)
	rug.CanCollide = false
end

local DECOR: { [string]: (Instance, Vector3, Random) -> () } = {
	magictrees = magicTree,
	bigcrystals = bigCrystal,
	peaks = peak,
	pillars = pillar,
	voidorbs = voidOrb,
	market = marketLantern,
	tech = techPillar,
	cybertrees = cyberTree,
	city = neonBuilding,
	servers = serverRack,
	quantum = quantumOrb,
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
	local currency = egg.Currency == "Coins" and "💰" or (egg.Currency == "Diamonds" and "💎" or (egg.Currency == "Gems" and "💠" or "🔁"))
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
	{ Kind = "Enchant", Name = "Enchant Machine", Arabic = "آلة الإنشانت", Color = Color3.fromRGB(0, 255, 140) },
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
	elseif def.Shape == "orb" then
		base = part(model, "Base", size, CFrame.new(pos + Vector3.new(0, size.Y * 0.7, 0)), def.Color, def.Material, "ball")
		base.Transparency = 0.15
		local ring = part(model, "Ring", Vector3.new(0.3, size.X * 1.5, size.X * 1.5), CFrame.new(pos + Vector3.new(0, size.Y * 0.7, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.new(1, 1, 1), Enum.Material.Neon, "cyl")
		ring.CanCollide = false
		ring.Transparency = 0.4
		local light = Instance.new("PointLight")
		light.Color = def.Color
		light.Range = 14
		light.Parent = base
	elseif def.Shape == "boss" then
		base = part(model, "Base", Vector3.new(size.X, size.Y * 0.8, size.Z), CFrame.new(pos + Vector3.new(0, size.Y * 0.4, 0)), def.Color, def.Material, "ball")
		base.Transparency = 0.1
		for _, side in ipairs({ -1, 1 }) do
			local eye = part(model, "Eye", Vector3.new(2.6, 2.6, 2.6), CFrame.new(pos + Vector3.new(side * size.X * 0.2, size.Y * 0.5, -size.Z * 0.42)), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic, "ball")
			eye.CanCollide = false
			local pupil = part(model, "Pupil", Vector3.new(1.2, 1.2, 1.2), CFrame.new(pos + Vector3.new(side * size.X * 0.2, size.Y * 0.5, -size.Z * 0.52)), Color3.fromRGB(120, 0, 0), Enum.Material.Neon, "ball")
			pupil.CanCollide = false
		end
		local mouthPart = part(model, "Mouth", Vector3.new(size.X * 0.4, 1, 0.6), CFrame.new(pos + Vector3.new(0, size.Y * 0.28, -size.Z * 0.48)), Color3.fromRGB(20, 20, 20), Enum.Material.SmoothPlastic)
		mouthPart.CanCollide = false
		local crown = part(model, "Crown", Vector3.new(size.X * 0.45, 3, size.Z * 0.45), CFrame.new(pos + Vector3.new(0, size.Y * 0.85, 0)), Color3.fromRGB(255, 215, 0), Enum.Material.Metal, "cone")
		crown.CanCollide = false
		local light = Instance.new("PointLight")
		light.Color = def.Color
		light.Range = 40
		light.Brightness = 2
		light.Parent = base
		billboard(base, "👹 " .. def.Name, UDim2.fromScale(20, 5), Color3.fromRGB(255, 80, 80), size.Y * 0.7)
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
	local market = Config.Map.MarketOffset
	if (Vector3.new(pos.X, 0, pos.Z) - Vector3.new(market.X, 0, market.Z)).Magnitude < 260 then
		return -1
	end
	local w3 = Config.Map.World3Offset
	if pos.X > w3.X - 500 then
		local idx = Zones.WorldStart[3] + math.floor((pos.Z - w3.Z) / SPACING + 0.5)
		return math.clamp(idx, Zones.WorldStart[3], #Zones.List)
	end
	local w2 = Config.Map.World2Offset
	if pos.X > w2.X - 500 then
		local idx = Zones.WorldStart[2] + math.floor((pos.Z - w2.Z) / SPACING + 0.5)
		return math.clamp(idx, Zones.WorldStart[2], Zones.WorldStart[3] - 1)
	end
	local idx = math.floor(pos.Z / SPACING + 0.5) + 1
	return math.clamp(idx, 1, Zones.WorldStart[2] - 1)
end

local function buildStall(parent: Instance, pos: Vector3, kind: string, title: string, color: Color3): Model
	local model = Instance.new("Model")
	model.Name = kind .. "Stall"
	model:SetAttribute("Machine", kind)
	local base = part(model, "Base", Vector3.new(10, 1, 8), CFrame.new(pos + Vector3.new(0, 0.5, 0)), Color3.fromRGB(120, 80, 50), Enum.Material.WoodPlanks)
	part(model, "Counter", Vector3.new(8, 3, 2), CFrame.new(pos + Vector3.new(0, 2.5, -2.5)), Color3.fromRGB(150, 100, 60), Enum.Material.Wood)
	for _, s in ipairs({ -1, 1 }) do
		part(model, "Pole", Vector3.new(0.6, 9, 0.6), CFrame.new(pos + Vector3.new(s * 4.5, 5, 3)), Color3.fromRGB(90, 60, 40), Enum.Material.Wood)
	end
	local roof = part(model, "Roof", Vector3.new(11, 0.6, 9), CFrame.new(pos + Vector3.new(0, 9.5, 0)) * CFrame.Angles(0.12, 0, 0), color, Enum.Material.Fabric)
	roof.CanCollide = false
	for i = 0, 4 do
		local stripe = part(model, "Stripe", Vector3.new(1.4, 0.7, 9.2), CFrame.new(pos + Vector3.new(-4.4 + i * 2.2, 9.55, 0)) * CFrame.Angles(0.12, 0, 0), Color3.new(1, 1, 1), Enum.Material.Fabric)
		stripe.CanCollide = false
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "فتح"
	prompt.ObjectText = title
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = base
	billboard(base, title, UDim2.fromScale(14, 4), color, 12)
	model.PrimaryPart = base
	model.Parent = parent
	return model
end

local function buildWheel(parent: Instance, pos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = "SpinWheel"
	model:SetAttribute("Machine", "Spin")
	local stand = part(model, "Stand", Vector3.new(2, 8, 2), CFrame.new(pos + Vector3.new(0, 4, 0)), Color3.fromRGB(80, 80, 90), Enum.Material.Metal)
	local wheel = part(model, "Wheel", Vector3.new(1, 12, 12), CFrame.new(pos + Vector3.new(0, 9, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(255, 255, 255), Enum.Material.SmoothPlastic, "cyl")
	wheel.CanCollide = false
	local colors = { Color3.fromRGB(255, 80, 80), Color3.fromRGB(80, 200, 255), Color3.fromRGB(255, 220, 60), Color3.fromRGB(120, 255, 120), Color3.fromRGB(200, 100, 255), Color3.fromRGB(255, 150, 60), Color3.fromRGB(80, 255, 220), Color3.fromRGB(255, 120, 200) }
	for i = 1, 8 do
		local ang = (i / 8) * math.pi * 2
		local seg = part(model, "Segment", Vector3.new(1.2, 3, 3), CFrame.new(pos + Vector3.new(0, 9 + math.sin(ang) * 4, math.cos(ang) * 4)), colors[i], Enum.Material.Neon, "ball")
		seg.CanCollide = false
	end
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "لف"
	prompt.ObjectText = "عجلة الحظ"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = stand
	billboard(wheel, "🎡 عجلة الحظ\nلفة مجانية كل يوم", UDim2.fromScale(14, 4), Color3.fromRGB(255, 220, 60), 8)
	model.PrimaryPart = stand
	model.Parent = parent
	return model
end

local function buildAltar(parent: Instance, pos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = "RebirthAltar"
	model:SetAttribute("Machine", "Rebirth")
	local base = part(model, "Base", Vector3.new(1.5, 14, 14), CFrame.new(pos + Vector3.new(0, 0.75, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(60, 40, 40), Enum.Material.Marble, "cyl")
	for i = 1, 6 do
		local ang = i / 6 * math.pi * 2
		part(model, "Pillar", Vector3.new(1.5, 9, 1.5), CFrame.new(pos + Vector3.new(math.cos(ang) * 6, 5, math.sin(ang) * 6)), Color3.fromRGB(90, 70, 70), Enum.Material.Marble)
	end
	local core = part(model, "Core", Vector3.new(4, 4, 4), CFrame.new(pos + Vector3.new(0, 6, 0)), Color3.fromRGB(255, 120, 40), Enum.Material.Neon, "ball")
	core.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 120, 40)
	light.Range = 24
	light.Brightness = 2
	light.Parent = core
	local fire = Instance.new("Fire")
	fire.Size = 8
	fire.Heat = 12
	fire.Parent = core
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "فتح"
	prompt.ObjectText = "مذبح الريبيرث"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 14
	prompt.RequiresLineOfSight = false
	prompt.Parent = base
	billboard(core, "🔁 Rebirth\nمذبح الريبيرث", UDim2.fromScale(14, 4), Color3.fromRGB(255, 140, 60), 6)
	model.PrimaryPart = base
	model.Parent = parent
	return model
end

local function buildLamp(parent: Instance, pos: Vector3)
	part(parent, "LampPost", Vector3.new(0.6, 9, 0.6), CFrame.new(pos + Vector3.new(0, 4.5, 0)), Color3.fromRGB(40, 40, 45), Enum.Material.Metal)
	local bulb = part(parent, "Bulb", Vector3.new(1.6, 1.6, 1.6), CFrame.new(pos + Vector3.new(0, 9.5, 0)), Color3.fromRGB(255, 240, 180), Enum.Material.Neon, "ball")
	bulb.CanCollide = false
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 240, 180)
	light.Range = 22
	light.Brightness = 1.2
	light.Parent = bulb
end

local function buildFountain(parent: Instance, pos: Vector3)
	local basin = part(parent, "Basin", Vector3.new(2, 16, 16), CFrame.new(pos + Vector3.new(0, 1, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(200, 200, 210), Enum.Material.Marble, "cyl")
	local water = part(parent, "Water", Vector3.new(0.6, 14, 14), CFrame.new(pos + Vector3.new(0, 1.8, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(80, 170, 255), Enum.Material.Glass, "cyl")
	water.Transparency = 0.4
	water.CanCollide = false
	part(parent, "Column", Vector3.new(2, 6, 2), CFrame.new(pos + Vector3.new(0, 4, 0)), Color3.fromRGB(200, 200, 210), Enum.Material.Marble)
	local top = part(parent, "Top", Vector3.new(0.8, 6, 6), CFrame.new(pos + Vector3.new(0, 7, 0)) * CFrame.Angles(0, 0, math.pi / 2), Color3.fromRGB(200, 200, 210), Enum.Material.Marble, "cyl")
	local attach = Instance.new("Attachment")
	attach.Position = Vector3.new(0, 0.5, 0)
	attach.Parent = top
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(Color3.fromRGB(150, 210, 255))
	pe.Size = NumberSequence.new(0.6, 0.2)
	pe.Transparency = NumberSequence.new(0.3, 1)
	pe.Lifetime = NumberRange.new(0.8, 1.4)
	pe.Rate = 40
	pe.Speed = NumberRange.new(10, 14)
	pe.SpreadAngle = Vector2.new(25, 25)
	pe.Acceleration = Vector3.new(0, -30, 0)
	pe.Parent = attach
	basin.CanCollide = true
end

local function buildBench(parent: Instance, pos: Vector3, rot: number)
	local cf = CFrame.new(pos) * CFrame.Angles(0, rot, 0)
	part(parent, "Seat", Vector3.new(6, 0.5, 2), cf * CFrame.new(0, 1.5, 0), Color3.fromRGB(150, 100, 60), Enum.Material.Wood)
	part(parent, "Back", Vector3.new(6, 2, 0.4), cf * CFrame.new(0, 2.7, 0.9), Color3.fromRGB(150, 100, 60), Enum.Material.Wood)
	for _, s in ipairs({ -1, 1 }) do
		part(parent, "Leg", Vector3.new(0.5, 1.4, 1.8), cf * CFrame.new(s * 2.5, 0.7, 0), Color3.fromRGB(60, 60, 65), Enum.Material.Metal)
	end
end

-- جزيئات جوية لكل منطقة
local AMBIENT = {
	trees = { Color = Color3.fromRGB(120, 220, 90), Size = 0.6, Speed = 3, Rate = 14, Acc = Vector3.new(2, -4, 1) },
	palms = { Color = Color3.fromRGB(255, 255, 255), Size = 0.4, Speed = 2, Rate = 8, Acc = Vector3.new(3, -1, 0) },
	cactus = { Color = Color3.fromRGB(230, 200, 140), Size = 0.5, Speed = 6, Rate = 16, Acc = Vector3.new(8, -1, 0) },
	ice = { Color = Color3.fromRGB(255, 255, 255), Size = 0.5, Speed = 2, Rate = 30, Acc = Vector3.new(1, -5, 0) },
	lava = { Color = Color3.fromRGB(255, 120, 20), Size = 0.4, Speed = 4, Rate = 18, Acc = Vector3.new(0, 6, 0), Up = true },
	clouds = { Color = Color3.fromRGB(255, 255, 255), Size = 0.8, Speed = 1, Rate = 6, Acc = Vector3.new(2, 0, 0) },
	crystals = { Color = Color3.fromRGB(200, 120, 255), Size = 0.4, Speed = 1, Rate = 14, Acc = Vector3.new(0, 1, 0), Up = true },
	gold = { Color = Color3.fromRGB(255, 220, 100), Size = 0.4, Speed = 1, Rate = 14, Acc = Vector3.new(0, 2, 0), Up = true },
	tech = { Color = Color3.fromRGB(0, 255, 255), Size = 0.3, Speed = 3, Rate = 20, Acc = Vector3.new(0, 3, 0), Up = true },
	cybertrees = { Color = Color3.fromRGB(57, 255, 20), Size = 0.3, Speed = 2, Rate = 20, Acc = Vector3.new(0, -3, 0) },
	city = { Color = Color3.fromRGB(255, 45, 149), Size = 0.3, Speed = 2, Rate = 12, Acc = Vector3.new(0, -3, 0) },
	servers = { Color = Color3.fromRGB(0, 206, 209), Size = 0.25, Speed = 4, Rate = 24, Acc = Vector3.new(0, 4, 0), Up = true },
	quantum = { Color = Color3.fromRGB(255, 0, 255), Size = 0.5, Speed = 1, Rate = 16, Acc = Vector3.new(0, 0, 0), Up = true },
	magictrees = { Color = Color3.fromRGB(255, 160, 255), Size = 0.4, Speed = 1, Rate = 22, Acc = Vector3.new(0, 1, 0), Up = true },
	bigcrystals = { Color = Color3.fromRGB(150, 230, 255), Size = 0.4, Speed = 1, Rate = 18, Acc = Vector3.new(0, 1, 0), Up = true },
	peaks = { Color = Color3.fromRGB(255, 90, 40), Size = 0.4, Speed = 5, Rate = 22, Acc = Vector3.new(3, 5, 0), Up = true },
	pillars = { Color = Color3.fromRGB(255, 240, 180), Size = 0.5, Speed = 1, Rate = 20, Acc = Vector3.new(0, -1, 0) },
	voidorbs = { Color = Color3.fromRGB(255, 255, 255), Size = 0.3, Speed = 2, Rate = 26, Acc = Vector3.new(0, 2, 0), Up = true },
	market = { Color = Color3.fromRGB(255, 220, 120), Size = 0.35, Speed = 1, Rate = 12, Acc = Vector3.new(1, 1, 0), Up = true },
}

local function ambient(folder: Folder, center: Vector3, size: number, decor: string)
	local cfg = AMBIENT[decor]
	if not cfg then
		return
	end
	local emitterPart = part(folder, "Ambient", Vector3.new(size * 0.9, 1, size * 0.9), CFrame.new(center + Vector3.new(0, cfg.Up and 2 or 45, 0)), Color3.new(1, 1, 1), Enum.Material.SmoothPlastic)
	emitterPart.Transparency = 1
	emitterPart.CanCollide = false
	emitterPart.CanQuery = false
	local pe = Instance.new("ParticleEmitter")
	pe.Shape = Enum.ParticleEmitterShape.Box
	pe.ShapeStyle = Enum.ParticleEmitterShapeStyle.Volume
	pe.Color = ColorSequence.new(cfg.Color)
	pe.Size = NumberSequence.new(cfg.Size)
	pe.Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1), NumberSequenceKeypoint.new(0.2, 0.2), NumberSequenceKeypoint.new(0.8, 0.2), NumberSequenceKeypoint.new(1, 1) })
	pe.Lifetime = NumberRange.new(6, 10)
	pe.Rate = cfg.Rate
	pe.Speed = NumberRange.new(cfg.Speed * 0.5, cfg.Speed)
	pe.Acceleration = cfg.Acc
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.RotSpeed = NumberRange.new(-60, 60)
	pe.LightEmission = 0.6
	pe.Parent = emitterPart
end

local function portalParticles(field: BasePart, color: Color3)
	local attach = Instance.new("Attachment")
	attach.Parent = field
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(color, Color3.new(1, 1, 1))
	pe.Size = NumberSequence.new(0.5, 0)
	pe.Transparency = NumberSequence.new(0.2, 1)
	pe.Lifetime = NumberRange.new(1, 2)
	pe.Rate = 25
	pe.Speed = NumberRange.new(2, 5)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.LightEmission = 1
	pe.Parent = attach
end

-- كشك سوق للاعب
local function buildBooth(parent: Instance, pos: Vector3, rot: number, index: number): Model
	local model = Instance.new("Model")
	model.Name = "Booth" .. index
	model:SetAttribute("BoothId", index)
	model:SetAttribute("Owner", 0)
	model:SetAttribute("OwnerName", "")
	model:SetAttribute("Listings", 0)
	local cf = CFrame.new(pos) * CFrame.Angles(0, rot, 0)
	local base = part(model, "Base", Vector3.new(12, 1, 10), cf * CFrame.new(0, 0.5, 0), Color3.fromRGB(130, 90, 55), Enum.Material.WoodPlanks)
	part(model, "Counter", Vector3.new(10, 3, 2.2), cf * CFrame.new(0, 2.5, -3), Color3.fromRGB(160, 110, 65), Enum.Material.Wood)
	for _, sx in ipairs({ -1, 1 }) do
		part(model, "Pole", Vector3.new(0.6, 10, 0.6), cf * CFrame.new(sx * 5.5, 5.5, 3.5), Color3.fromRGB(90, 60, 40), Enum.Material.Wood)
		part(model, "Pole", Vector3.new(0.6, 10, 0.6), cf * CFrame.new(sx * 5.5, 5.5, -4), Color3.fromRGB(90, 60, 40), Enum.Material.Wood)
	end
	local hue = (index * 0.13) % 1
	local roof = part(model, "Roof", Vector3.new(13, 0.6, 11), cf * CFrame.new(0, 10.6, 0) * CFrame.Angles(0.1, 0, 0), Color3.fromHSV(hue, 0.7, 0.95), Enum.Material.Fabric)
	roof.CanCollide = false
	for i = 0, 5 do
		local stripe = part(model, "Stripe", Vector3.new(1.3, 0.7, 11.2), cf * CFrame.new(-5.4 + i * 2.2, 10.65, 0) * CFrame.Angles(0.1, 0, 0), Color3.new(1, 1, 1), Enum.Material.Fabric)
		stripe.CanCollide = false
	end
	local sign = part(model, "Sign", Vector3.new(9, 2.4, 0.4), cf * CFrame.new(0, 8.2, -5.5), Color3.fromRGB(245, 230, 200), Enum.Material.Wood)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "فتح"
	prompt.ObjectText = "كشك " .. index
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = base
	local bb = billboard(sign, "كشك فارغ\nاضغط للحجز", UDim2.fromScale(12, 4), Color3.new(1, 1, 1), 3)
	bb.Name = "BoothSign"
	model.PrimaryPart = base
	model.Parent = parent
	return model
end

local function buildAuctionHouse(parent: Instance, pos: Vector3): Model
	local model = Instance.new("Model")
	model.Name = "AuctionHouse"
	model:SetAttribute("Machine", "Market")
	local base = part(model, "Floor", Vector3.new(30, 1, 24), CFrame.new(pos + Vector3.new(0, 0.5, 0)), Color3.fromRGB(230, 220, 200), Enum.Material.Marble)
	part(model, "Back", Vector3.new(30, 14, 1.5), CFrame.new(pos + Vector3.new(0, 7.5, 11)), Color3.fromRGB(200, 90, 70), Enum.Material.Brick)
	for _, sx in ipairs({ -1, 1 }) do
		part(model, "Wall", Vector3.new(1.5, 14, 24), CFrame.new(pos + Vector3.new(sx * 14.5, 7.5, 0)), Color3.fromRGB(200, 90, 70), Enum.Material.Brick)
		part(model, "Column", Vector3.new(2.5, 14, 2.5), CFrame.new(pos + Vector3.new(sx * 12, 7.5, -11)), Color3.fromRGB(245, 235, 220), Enum.Material.Marble, "cyl").CFrame = CFrame.new(pos + Vector3.new(sx * 12, 7, -11)) * CFrame.Angles(0, 0, math.pi / 2)
	end
	local dome = part(model, "Dome", Vector3.new(30, 14, 26), CFrame.new(pos + Vector3.new(0, 14, 0)), Color3.fromRGB(60, 140, 200), Enum.Material.Metal, "ball")
	dome.CanCollide = false
	local spire = part(model, "Spire", Vector3.new(2, 8, 2), CFrame.new(pos + Vector3.new(0, 24, 0)), Color3.fromRGB(255, 215, 0), Enum.Material.Neon, "cone")
	spire.CanCollide = false
	local desk = part(model, "Desk", Vector3.new(14, 3.5, 3), CFrame.new(pos + Vector3.new(0, 2.5, 4)), Color3.fromRGB(120, 80, 50), Enum.Material.Wood)
	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "فتح السوق"
	prompt.ObjectText = "السوق العالمي"
	prompt.HoldDuration = 0
	prompt.MaxActivationDistance = 16
	prompt.RequiresLineOfSight = false
	prompt.Parent = desk
	billboard(spire, "🏪 السوق العالمي\nبيع واشترِ الحيوانات بالجواهر 💠", UDim2.fromScale(20, 5), Color3.fromRGB(255, 220, 120), 6)
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(255, 220, 120)
	light.Range = 40
	light.Brightness = 1.5
	light.Parent = base
	model.PrimaryPart = base
	model.Parent = parent
	return model
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

	-- المناطق (3 عوالم)
	local offsets = { [1] = Vector3.new(0, 0, 0), [2] = Config.Map.World2Offset, [3] = Config.Map.World3Offset }
	for i, zone in ipairs(Zones.List) do
		local start = Zones.WorldStart[zone.World] or 1
		local center = offsets[zone.World] + Vector3.new(0, 0, (i - start) * SPACING)
		local layout = buildIsland(zone, center, ISLAND, map, rng)
		ambient(layout.Folder, center, ISLAND, zone.Decor)
		MapBuilder.Zones[i] = layout
		local prevZone = Zones.List[i - 1]
		if prevZone and prevZone.World == zone.World then
			local prev = MapBuilder.Zones[i - 1]
			layout.Gate = buildBridgeAndGate(prev, zone, prev.Folder)
		end
	end

	-- بوابات العوالم
	local w2s, w3s = Zones.WorldStart[2], Zones.WorldStart[3]
	local void = MapBuilder.Zones[w2s - 1]
	local hub = MapBuilder.Zones[w2s]
	MapBuilder.World2Portal = buildPortal(void.Folder, void.Center + Vector3.new(0, 0, ISLAND / 2 - 8), Color3.fromRGB(0, 255, 255), "🌐 Tech World\nيتطلب ريبيرث + 💰 " .. Format.Number(Zones.List[w2s].Cost))
	MapBuilder.World2Portal:SetAttribute("Portal", "World2")
	portalParticles(MapBuilder.World2Portal, Color3.fromRGB(0, 255, 255))
	MapBuilder.World1Portal = buildPortal(hub.Folder, hub.Center + Vector3.new(0, 0, -ISLAND / 2 + 30), Color3.fromRGB(120, 200, 255), "🏠 العودة للعالم الأول")
	MapBuilder.World1Portal:SetAttribute("Portal", "World1")
	portalParticles(MapBuilder.World1Portal, Color3.fromRGB(120, 200, 255))
	local quantum = MapBuilder.Zones[w3s - 1]
	local enchanted = MapBuilder.Zones[w3s]
	MapBuilder.Portals.World3 = buildPortal(quantum.Folder, quantum.Center + Vector3.new(0, 0, ISLAND / 2 - 8), Color3.fromRGB(255, 120, 255), "✨ Mythic Realm\nيتطلب 3 ريبيرث + 💰 " .. Format.Number(Zones.List[w3s].Cost))
	portalParticles(MapBuilder.Portals.World3, Color3.fromRGB(255, 120, 255))
	MapBuilder.Portals.BackWorld2 = buildPortal(enchanted.Folder, enchanted.Center + Vector3.new(0, 0, -ISLAND / 2 + 30), Color3.fromRGB(0, 255, 255), "🌐 العودة للعالم الثاني")
	portalParticles(MapBuilder.Portals.BackWorld2, Color3.fromRGB(0, 255, 255))

	-- جزيرة السوق الكبير
	local marketCenter = Config.Map.MarketOffset
	local marketLayout = buildIsland(Zones.Market, marketCenter, 260, map, rng)
	ambient(marketLayout.Folder, marketCenter, 260, "market")
	MapBuilder.Zones[-1] = marketLayout
	local mf = marketLayout.Folder
	-- نقاط الصناديق في حلقة خارج الأكشاك
	marketLayout.Spots = {}
	for i = 1, 16 do
		local ang = (i - 1) / 16 * math.pi * 2
		local sp = marketCenter + Vector3.new(math.cos(ang) * 100, 0, math.sin(ang) * 100)
		if not (sp.Z < -80 and math.abs(sp.X) < 30) and not (sp.X < -50 and sp.Z > 70) then
			table.insert(marketLayout.Spots, sp)
		end
	end
	buildAuctionHouse(mf, marketCenter + Vector3.new(0, 0, 80))
	buildFountain(mf, marketCenter + Vector3.new(0, 0, 0))
	-- الأكشاك في حلقة حول النافورة
	for i = 1, Config.Market.Booths do
		local ang = (i - 1) / Config.Market.Booths * math.pi * 2
		local r = 62
		local pos = marketCenter + Vector3.new(math.cos(ang) * r, 0, math.sin(ang) * r)
		-- الكشك يواجه النافورة
		local rot = -ang + math.pi / 2
		table.insert(MapBuilder.Booths, buildBooth(mf, pos, rot, i))
	end
	MapBuilder.Machines.PetShop = buildStall(mf, marketCenter + Vector3.new(-70, 0, 90), "PetShop", "🐾 متجر الحيوانات\nبيع حيواناتك بالجواهر", Color3.fromRGB(60, 160, 90))
	MapBuilder.Portals.MarketReturn = buildPortal(mf, marketCenter + Vector3.new(0, 0, -100), Color3.fromRGB(120, 200, 255), "🏠 العودة للبلدة")
	portalParticles(MapBuilder.Portals.MarketReturn, Color3.fromRGB(120, 200, 255))
	for _, off in ipairs({ Vector3.new(-30, 0, 40), Vector3.new(30, 0, 40), Vector3.new(-30, 0, -40), Vector3.new(30, 0, -40) }) do
		buildLamp(mf, marketCenter + off)
	end

	-- منطقة VIP
	local vipCenter = Config.Map.VIPOffset
	local vipLayout = buildIsland(Zones.VIP, vipCenter, 200, map, rng)
	MapBuilder.Zones[0] = vipLayout
	MapBuilder.VIPReturnPortal = buildPortal(vipLayout.Folder, vipCenter + Vector3.new(0, 0, -70), Color3.fromRGB(120, 200, 255), "🏠 العودة للبلدة")
	MapBuilder.VIPReturnPortal:SetAttribute("Portal", "Return")
	portalParticles(MapBuilder.VIPReturnPortal, Color3.fromRGB(120, 200, 255))
	ambient(vipLayout.Folder, vipCenter, 200, "gold")

	-- البلدة
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
		local pos = town.Center + Vector3.new(118, 0, -118 + (i - 1) * 32)
		MapBuilder.Machines[info.Kind] = buildMachine(tf, info, pos)
	end

	MapBuilder.Specials.GiantChest = town.Center + Vector3.new(60, 0, 118)
	MapBuilder.Specials.MysteryBox = town.Center + Vector3.new(-60, 0, 118)
	MapBuilder.Specials.BossArena = town.Center + Vector3.new(-100, 0, 96)

	MapBuilder.VIPPortal = buildPortal(tf, town.Center + Vector3.new(-118, 0, -112), Color3.fromRGB(255, 215, 0), "👑 VIP Lounge")
	MapBuilder.VIPPortal:SetAttribute("Portal", "VIP")
	portalParticles(MapBuilder.VIPPortal, Color3.fromRGB(255, 215, 0))
	MapBuilder.Portals.Market = buildPortal(tf, town.Center + Vector3.new(-118, 0, -80), Color3.fromRGB(255, 140, 60), "🏪 السوق الكبير\nبيع واشترِ الحيوانات")
	portalParticles(MapBuilder.Portals.Market, Color3.fromRGB(255, 140, 60))

	-- الأكشاك والعجلة والمذبح والنافورة
	MapBuilder.Machines.Merchant = buildStall(tf, town.Center + Vector3.new(-62, 0, -116), "Merchant", "🧳 التاجر المتجول", Color3.fromRGB(200, 60, 60))
	MapBuilder.Machines.Trade = buildStall(tf, town.Center + Vector3.new(62, 0, -116), "Trade", "🤝 ساحة التبادل", Color3.fromRGB(60, 120, 220))
	MapBuilder.Machines.Spin = buildWheel(tf, town.Center + Vector3.new(-30, 0, -124))
	MapBuilder.Machines.Rebirth = buildAltar(tf, town.Center + Vector3.new(118, 0, 60))
	buildFountain(tf, town.Center + Vector3.new(0, 0, -60))
	for _, off in ipairs({ Vector3.new(-16, 0, -80), Vector3.new(16, 0, -80), Vector3.new(-16, 0, -40), Vector3.new(16, 0, -40), Vector3.new(-40, 0, -100), Vector3.new(40, 0, -100) }) do
		buildLamp(tf, town.Center + off)
	end
	buildBench(tf, town.Center + Vector3.new(-14, 0, -60), math.pi / 2)
	buildBench(tf, town.Center + Vector3.new(14, 0, -60), -math.pi / 2)

	MapBuilder.Boards.Coins = buildBoard(tf, town.Center + Vector3.new(-72, 0, -142), "💰 أغنى اللاعبين", Color3.fromRGB(255, 200, 40))
	MapBuilder.Boards.Hatches = buildBoard(tf, town.Center + Vector3.new(-104, 0, -142), "🥚 أكثر فتحاً للبيض", Color3.fromRGB(120, 200, 255))
	MapBuilder.Boards.Rebirths = buildBoard(vipLayout.Folder, vipCenter + Vector3.new(-40, 0, -95), "🔁 أكثر ريبيرث", Color3.fromRGB(255, 140, 60))
	MapBuilder.Boards.Damage = buildBoard(vipLayout.Folder, vipCenter + Vector3.new(40, 0, -95), "⚔️ أعلى ضرر", Color3.fromRGB(255, 90, 120))

	-- أرضية الموت تحت الجزر
	local kill = part(map, "KillPlane", Vector3.new(9000, 1, 9000), CFrame.new(1200, -120, 2000), Color3.fromRGB(20, 20, 30), Enum.Material.SmoothPlastic)
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

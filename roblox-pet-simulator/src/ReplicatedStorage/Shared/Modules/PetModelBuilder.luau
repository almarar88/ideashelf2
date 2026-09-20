--!strict
-- يبني نموذج حيوان ثلاثي الأبعاد من أجزاء بسيطة (بدون أي أصول خارجية).
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Pets = require(Shared.Data.Pets)

local Builder = {}

local GOLD = Color3.fromRGB(255, 200, 40)
local GOLD2 = Color3.fromRGB(255, 240, 150)
local DARK = Color3.fromRGB(25, 10, 40)
local DARK2 = Color3.fromRGB(170, 60, 255)

local function part(model: Model, name: string, size: Vector3, cf: CFrame, color: Color3, shape: string?, material: Enum.Material?): BasePart
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = cf
	p.Color = color
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CanTouch = false
	p.CastShadow = true
	p.Material = material or Enum.Material.SmoothPlastic
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	if shape == "ball" then
		p.Shape = Enum.PartType.Ball
	elseif shape == "cyl" then
		p.Shape = Enum.PartType.Cylinder
	elseif shape == "wedge" then
		local w = Instance.new("WedgePart")
		w.Name = name
		w.Size = size
		w.CFrame = cf
		w.Color = color
		w.Anchored = true
		w.CanCollide = false
		w.CanQuery = false
		w.CanTouch = false
		w.Material = material or Enum.Material.SmoothPlastic
		w.Parent = model
		p:Destroy()
		return w
	elseif shape == "cone" then
		local mesh = Instance.new("SpecialMesh")
		mesh.MeshType = Enum.MeshType.FileMesh
		mesh.MeshId = "rbxassetid://1033714"
		mesh.Scale = Vector3.new(size.X / 2, size.Y / 2, size.Z / 2)
		mesh.Parent = p
	end
	p.Parent = model
	return p
end

local function eyes(model: Model, body: BasePart, offset: CFrame, spread: number, size: number, color: Color3?)
	for _, side in ipairs({ -1, 1 }) do
		local eye = part(model, "Eye", Vector3.new(size, size, size), body.CFrame * offset * CFrame.new(side * spread, 0, 0), Color3.new(0, 0, 0), "ball")
		eye.Material = Enum.Material.Glass
		local shine = part(model, "Shine", Vector3.new(size * 0.35, size * 0.35, size * 0.35), eye.CFrame * CFrame.new(-side * size * 0.15, size * 0.2, -size * 0.35), Color3.new(1, 1, 1), "ball")
		shine.Material = Enum.Material.Neon
		if color then
			eye.Color = color
		end
	end
end

local function mouth(model: Model, body: BasePart, offset: CFrame, color: Color3)
	part(model, "Mouth", Vector3.new(0.5, 0.15, 0.15), body.CFrame * offset, color, "ball")
end

local function ears(model: Model, body: BasePart, kind: string, color: Color3, color2: Color3)
	local cf = body.CFrame
	local h = body.Size.Y / 2
	if kind == "cat" or kind == "fox" then
		for _, s in ipairs({ -1, 1 }) do
			part(model, "Ear", Vector3.new(0.6, 0.7, 0.3), cf * CFrame.new(s * 0.65, h + 0.25, 0) * CFrame.Angles(0, 0, -s * 0.2), color, "wedge")
			part(model, "EarIn", Vector3.new(0.3, 0.4, 0.2), cf * CFrame.new(s * 0.65, h + 0.2, -0.08) * CFrame.Angles(0, 0, -s * 0.2), color2, "wedge")
		end
	elseif kind == "dog" then
		for _, s in ipairs({ -1, 1 }) do
			part(model, "Ear", Vector3.new(0.35, 1.1, 0.6), cf * CFrame.new(s * 1.05, h - 0.2, 0) * CFrame.Angles(0, 0, s * 0.35), color2)
		end
	elseif kind == "bunny" then
		for _, s in ipairs({ -1, 1 }) do
			part(model, "Ear", Vector3.new(0.4, 1.5, 0.3), cf * CFrame.new(s * 0.45, h + 0.7, 0) * CFrame.Angles(0, 0, -s * 0.15), color)
			part(model, "EarIn", Vector3.new(0.2, 1.1, 0.1), cf * CFrame.new(s * 0.45, h + 0.7, -0.15) * CFrame.Angles(0, 0, -s * 0.15), color2)
		end
	elseif kind == "bear" then
		for _, s in ipairs({ -1, 1 }) do
			part(model, "Ear", Vector3.new(0.6, 0.6, 0.6), cf * CFrame.new(s * 0.8, h, 0), color, "ball")
			part(model, "EarIn", Vector3.new(0.35, 0.35, 0.35), cf * CFrame.new(s * 0.8, h, -0.2), color2, "ball")
		end
	end
end

local function wings(model: Model, body: BasePart, color: Color3, size: number)
	local cf = body.CFrame
	for _, s in ipairs({ -1, 1 }) do
		local w = part(model, "Wing", Vector3.new(size, size * 0.9, 0.15), cf * CFrame.new(s * (body.Size.X / 2 + size * 0.45), 0.2, 0.3) * CFrame.Angles(0, 0, s * 0.35), color, "wedge")
		w.CFrame = w.CFrame * CFrame.Angles(0, s * math.pi / 2, 0)
	end
end

local function horns(model: Model, body: BasePart, color: Color3, count: number)
	local cf = body.CFrame
	local h = body.Size.Y / 2
	if count == 1 then
		part(model, "Horn", Vector3.new(0.35, 1.2, 0.35), cf * CFrame.new(0, h + 0.4, -0.3) * CFrame.Angles(0.3, 0, 0), color, "cone")
	else
		for _, s in ipairs({ -1, 1 }) do
			part(model, "Horn", Vector3.new(0.35, 0.9, 0.35), cf * CFrame.new(s * 0.55, h + 0.25, 0) * CFrame.Angles(0, 0, -s * 0.5), color, "cone")
		end
	end
end

local function tail(model: Model, body: BasePart, color: Color3, kind: string)
	local cf = body.CFrame
	if kind == "fluffy" then
		part(model, "Tail", Vector3.new(0.7, 0.7, 1.2), cf * CFrame.new(0, -0.2, body.Size.Z / 2 + 0.4) * CFrame.Angles(0.5, 0, 0), color, "ball")
	elseif kind == "long" then
		part(model, "Tail", Vector3.new(0.3, 0.3, 1.4), cf * CFrame.new(0, -0.3, body.Size.Z / 2 + 0.6) * CFrame.Angles(0.6, 0, 0), color, "ball")
	elseif kind == "fin" then
		part(model, "Tail", Vector3.new(0.15, 1.1, 0.9), cf * CFrame.new(0, 0, body.Size.Z / 2 + 0.4), color, "wedge")
	end
end

local function feet(model: Model, body: BasePart, color: Color3)
	local cf = body.CFrame
	local h = body.Size.Y / 2
	for _, s in ipairs({ -1, 1 }) do
		part(model, "Foot", Vector3.new(0.6, 0.35, 0.7), cf * CFrame.new(s * 0.5, -h + 0.1, -0.2), color, "ball")
	end
end

local SHAPES: { [string]: (Model, Color3, Color3) -> BasePart } = {}

SHAPES.blob = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.2, 1.8, 2.2), CFrame.new(), c1, "ball")
	eyes(m, body, CFrame.new(0, 0.2, -0.85), 0.42, 0.34)
	mouth(m, body, CFrame.new(0, -0.25, -1.05), c2)
	return body
end

SHAPES.cat = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2, 1.9, 2), CFrame.new(), c1)
	eyes(m, body, CFrame.new(0, 0.25, -0.95), 0.45, 0.36)
	part(m, "Nose", Vector3.new(0.25, 0.18, 0.2), body.CFrame * CFrame.new(0, -0.15, -1.05), c2, "ball")
	ears(m, body, "cat", c1, c2)
	tail(m, body, c1, "long")
	feet(m, body, c2)
	return body
end

SHAPES.dog = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.1, 1.9, 2.1), CFrame.new(), c1)
	part(m, "Snout", Vector3.new(1, 0.7, 0.7), body.CFrame * CFrame.new(0, -0.3, -1.1), c2)
	part(m, "Nose", Vector3.new(0.35, 0.3, 0.3), body.CFrame * CFrame.new(0, -0.15, -1.5), Color3.new(0, 0, 0), "ball")
	eyes(m, body, CFrame.new(0, 0.35, -0.95), 0.45, 0.36)
	ears(m, body, "dog", c1, c2)
	tail(m, body, c1, "long")
	feet(m, body, c2)
	return body
end

SHAPES.bunny = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(1.9, 1.9, 1.9), CFrame.new(), c1, "ball")
	eyes(m, body, CFrame.new(0, 0.2, -0.8), 0.4, 0.34)
	part(m, "Nose", Vector3.new(0.22, 0.18, 0.2), body.CFrame * CFrame.new(0, -0.15, -0.95), c2, "ball")
	ears(m, body, "bunny", c1, c2)
	tail(m, body, Color3.new(1, 1, 1), "fluffy")
	feet(m, body, c1)
	return body
end

SHAPES.bear = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.3, 2.1, 2.1), CFrame.new(), c1)
	part(m, "Snout", Vector3.new(0.9, 0.6, 0.5), body.CFrame * CFrame.new(0, -0.3, -1.1), c2, "ball")
	part(m, "Nose", Vector3.new(0.3, 0.25, 0.25), body.CFrame * CFrame.new(0, -0.15, -1.35), Color3.new(0, 0, 0), "ball")
	eyes(m, body, CFrame.new(0, 0.35, -1.0), 0.5, 0.36)
	ears(m, body, "bear", c1, c2)
	feet(m, body, c2)
	return body
end

SHAPES.fox = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2, 1.8, 2.2), CFrame.new(), c1)
	part(m, "Snout", Vector3.new(0.8, 0.5, 0.8), body.CFrame * CFrame.new(0, -0.35, -1.2) * CFrame.Angles(math.pi / 2, 0, 0), c2, "cone")
	part(m, "Nose", Vector3.new(0.25, 0.22, 0.22), body.CFrame * CFrame.new(0, -0.3, -1.6), Color3.new(0, 0, 0), "ball")
	eyes(m, body, CFrame.new(0, 0.3, -0.95), 0.45, 0.34)
	ears(m, body, "fox", c1, c2)
	tail(m, body, c2, "fluffy")
	feet(m, body, Color3.new(0.1, 0.1, 0.1))
	return body
end

SHAPES.dragon = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.2, 2, 2.4), CFrame.new(), c1, "ball")
	part(m, "Belly", Vector3.new(1.3, 1.3, 0.6), body.CFrame * CFrame.new(0, -0.3, -0.9), c2, "ball")
	eyes(m, body, CFrame.new(0, 0.35, -0.95), 0.5, 0.36, Color3.fromRGB(255, 230, 0))
	horns(m, body, c2, 2)
	wings(m, body, c2, 1.6)
	tail(m, body, c1, "long")
	feet(m, body, c2)
	return body
end

SHAPES.bird = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(1.9, 2, 1.9), CFrame.new(), c1, "ball")
	part(m, "Beak", Vector3.new(0.5, 0.5, 0.8), body.CFrame * CFrame.new(0, -0.05, -1.2) * CFrame.Angles(-math.pi / 2, 0, 0), c2, "cone")
	eyes(m, body, CFrame.new(0, 0.35, -0.8), 0.42, 0.34)
	wings(m, body, c2, 1.2)
	part(m, "Crest", Vector3.new(0.3, 0.7, 0.3), body.CFrame * CFrame.new(0, 1.2, 0.1) * CFrame.Angles(0.3, 0, 0), c2, "cone")
	feet(m, body, Color3.fromRGB(255, 150, 0))
	return body
end

SHAPES.robot = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2, 2, 1.8), CFrame.new(), c1, nil, Enum.Material.Metal)
	local screen = part(m, "Screen", Vector3.new(1.5, 1, 0.1), body.CFrame * CFrame.new(0, 0.2, -0.92), Color3.new(0, 0, 0), nil, Enum.Material.Glass)
	eyes(m, screen, CFrame.new(0, 0, -0.1), 0.4, 0.3, c2)
	local ant = part(m, "Antenna", Vector3.new(0.15, 0.9, 0.15), body.CFrame * CFrame.new(0, 1.4, 0), Color3.fromRGB(120, 120, 120), nil, Enum.Material.Metal)
	local bulb = part(m, "Bulb", Vector3.new(0.4, 0.4, 0.4), ant.CFrame * CFrame.new(0, 0.55, 0), c2, "ball", Enum.Material.Neon)
	bulb.Name = "Glow"
	for _, s in ipairs({ -1, 1 }) do
		part(m, "Arm", Vector3.new(0.35, 1.2, 0.35), body.CFrame * CFrame.new(s * 1.2, -0.1, 0), Color3.fromRGB(120, 120, 120), nil, Enum.Material.Metal)
	end
	feet(m, body, Color3.fromRGB(90, 90, 90))
	return body
end

SHAPES.ghost = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2, 2, 2), CFrame.new(), c1, "ball")
	body.Transparency = 0.15
	local bottom = part(m, "Bottom", Vector3.new(2, 1.2, 2), body.CFrame * CFrame.new(0, -0.9, 0), c1, "cyl")
	bottom.CFrame = bottom.CFrame * CFrame.Angles(0, 0, math.pi / 2)
	bottom.Transparency = 0.35
	for i = 1, 3 do
		local x = (i - 2) * 0.6
		part(m, "Wisp", Vector3.new(0.5, 0.5, 0.5), body.CFrame * CFrame.new(x, -1.6, 0), c1, "ball").Transparency = 0.35
	end
	eyes(m, body, CFrame.new(0, 0.2, -0.85), 0.45, 0.4, c2)
	mouth(m, body, CFrame.new(0, -0.35, -0.95), Color3.new(0, 0, 0))
	return body
end

SHAPES.fish = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(1.6, 1.6, 2.6), CFrame.new(), c1, "ball")
	eyes(m, body, CFrame.new(0, 0.25, -1.0), 0.45, 0.34)
	tail(m, body, c2, "fin")
	part(m, "Fin", Vector3.new(0.12, 0.8, 1), body.CFrame * CFrame.new(0, 0.9, 0.2), c2, "wedge")
	for _, s in ipairs({ -1, 1 }) do
		part(m, "SideFin", Vector3.new(0.6, 0.12, 0.7), body.CFrame * CFrame.new(s * 0.9, -0.2, 0) * CFrame.Angles(0, 0, s * 0.6), c2, "wedge")
	end
	mouth(m, body, CFrame.new(0, -0.3, -1.25), c2)
	return body
end

SHAPES.golem = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.4, 2.2, 2), CFrame.new(), c1, nil, Enum.Material.Slate)
	local screen = part(m, "Face", Vector3.new(1.6, 0.9, 0.2), body.CFrame * CFrame.new(0, 0.3, -0.95), c2, nil, Enum.Material.Neon)
	screen.Transparency = 0.5
	eyes(m, body, CFrame.new(0, 0.35, -1.0), 0.5, 0.35, c2)
	for _, s in ipairs({ -1, 1 }) do
		part(m, "Arm", Vector3.new(0.8, 1.4, 0.8), body.CFrame * CFrame.new(s * 1.5, -0.2, 0), c1, nil, Enum.Material.Slate)
		part(m, "Shoulder", Vector3.new(0.6, 0.6, 0.6), body.CFrame * CFrame.new(s * 1.5, 0.7, 0), c2, "ball", Enum.Material.Neon)
	end
	feet(m, body, c1)
	return body
end

SHAPES.unicorn = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(1.9, 2, 2.4), CFrame.new(), c1)
	part(m, "Snout", Vector3.new(1, 0.8, 0.9), body.CFrame * CFrame.new(0, -0.35, -1.3), c1)
	eyes(m, body, CFrame.new(0, 0.35, -0.95), 0.45, 0.34)
	horns(m, body, c2, 1)
	ears(m, body, "cat", c1, c2)
	local mane = part(m, "Mane", Vector3.new(0.5, 0.9, 1.6), body.CFrame * CFrame.new(0, 0.9, 0.4), c2, "ball")
	mane.Material = Enum.Material.Neon
	tail(m, body, c2, "fluffy")
	feet(m, body, c2)
	return body
end

SHAPES.alien = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2, 2.2, 2), CFrame.new(), c1, "ball")
	eyes(m, body, CFrame.new(0, 0.3, -0.75), 0.5, 0.6, c2)
	for i = 1, 4 do
		local ang = (i / 4) * math.pi * 2
		local t = part(m, "Tentacle", Vector3.new(0.4, 1.2, 0.4), body.CFrame * CFrame.new(math.cos(ang) * 0.8, -1.2, math.sin(ang) * 0.8) * CFrame.Angles(math.sin(ang) * 0.3, 0, -math.cos(ang) * 0.3), c1, "ball")
		t.Name = "Tentacle"
	end
	mouth(m, body, CFrame.new(0, -0.4, -0.95), c2)
	return body
end

SHAPES.demon = function(m, c1, c2)
	local body = part(m, "Body", Vector3.new(2.1, 2.1, 2.1), CFrame.new(), c1, "ball")
	eyes(m, body, CFrame.new(0, 0.3, -0.85), 0.45, 0.36, c2)
	horns(m, body, c2, 2)
	wings(m, body, Color3.fromRGB(40, 0, 60), 1.5)
	tail(m, body, c1, "long")
	local mouthPart = part(m, "Mouth", Vector3.new(0.9, 0.25, 0.2), body.CFrame * CFrame.new(0, -0.35, -1.0), Color3.new(0, 0, 0))
	mouthPart.Material = Enum.Material.Neon
	mouthPart.Color = c2
	feet(m, body, c2)
	return body
end

-- يبني النموذج. variant: Normal/Golden/Rainbow/DarkMatter
function Builder.Build(petId: string, variant: string?): Model?
	local def = Pets.Get(petId)
	if not def then
		return nil
	end
	variant = variant or "Normal"
	local c1, c2 = def.Primary, def.Secondary
	if variant == "Golden" then
		c1, c2 = GOLD, GOLD2
	elseif variant == "DarkMatter" then
		c1, c2 = DARK, DARK2
	end

	local model = Instance.new("Model")
	model.Name = petId
	local builder = SHAPES[def.Shape] or SHAPES.blob
	local body = builder(model, c1, c2)
	model.PrimaryPart = body
	model:SetAttribute("PetId", petId)
	model:SetAttribute("Variant", variant)
	model:SetAttribute("Scale", def.Scale or 1)
	if (def.Scale or 1) ~= 1 then
		model:ScaleTo(def.Scale)
	end

	for _, p in ipairs(model:GetDescendants()) do
		if p:IsA("BasePart") then
			if variant == "Golden" and p.Name ~= "Eye" and p.Name ~= "Shine" then
				p.Material = Enum.Material.Metal
				p.Reflectance = 0.25
			elseif variant == "DarkMatter" then
				if p.Name == "Body" or p.Name == "Ear" or p.Name == "Arm" or p.Name == "Wing" then
					p.Material = Enum.Material.Slate
				elseif p.Name ~= "Eye" and p.Name ~= "Shine" then
					p.Material = Enum.Material.Neon
				end
			elseif variant == "Rainbow" and p.Name ~= "Eye" and p.Name ~= "Shine" then
				p:SetAttribute("Rainbow", true)
			end
		end
	end

	if variant == "DarkMatter" then
		local attach = Instance.new("Attachment")
		attach.Parent = body
		local pe = Instance.new("ParticleEmitter")
		pe.Color = ColorSequence.new(DARK2, Color3.fromRGB(60, 0, 120))
		pe.Size = NumberSequence.new(0.35, 0)
		pe.Transparency = NumberSequence.new(0.2, 1)
		pe.Lifetime = NumberRange.new(0.6, 1.2)
		pe.Rate = 12
		pe.Speed = NumberRange.new(1, 2)
		pe.SpreadAngle = Vector2.new(180, 180)
		pe.LightEmission = 1
		pe.Parent = attach
	elseif variant == "Rainbow" then
		local attach = Instance.new("Attachment")
		attach.Parent = body
		local pe = Instance.new("ParticleEmitter")
		pe.Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 0, 0)),
			ColorSequenceKeypoint.new(0.5, Color3.fromRGB(0, 255, 0)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 0, 255)),
		})
		pe.Size = NumberSequence.new(0.3, 0)
		pe.Lifetime = NumberRange.new(0.5, 1)
		pe.Rate = 8
		pe.Speed = NumberRange.new(1, 2)
		pe.SpreadAngle = Vector2.new(180, 180)
		pe.LightEmission = 1
		pe.Parent = attach
	elseif variant == "Golden" then
		local light = Instance.new("PointLight")
		light.Color = GOLD
		light.Range = 6
		light.Brightness = 0.6
		light.Parent = body
	end

	return model
end

-- يحرك النموذج كله بحيث يكون الجسم عند CFrame المعطى
function Builder.SetCFrame(model: Model, cf: CFrame)
	model:PivotTo(cf)
end

return Builder

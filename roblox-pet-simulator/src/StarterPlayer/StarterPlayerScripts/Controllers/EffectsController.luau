--!strict
-- تأثيرات: ألوان قوس قزح للحيوانات، الموسيقى، الأصوات
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local DataController = require(script.Parent.DataController)

local EffectsController = {}

local sounds: { [string]: Sound } = {}
local music: Sound?

function EffectsController.Play(name: string)
	local s = sounds[name]
	if s then
		s:Play()
	end
end

local function screenFlash(color: Color3, text: string)
	local Players = game:GetService("Players")
	local gui = Instance.new("ScreenGui")
	gui.IgnoreGuiInset = true
	gui.DisplayOrder = 50
	gui.Parent = Players.LocalPlayer:WaitForChild("PlayerGui")
	local flash = Instance.new("Frame")
	flash.Size = UDim2.fromScale(1, 1)
	flash.BackgroundColor3 = color
	flash.BackgroundTransparency = 0.4
	flash.BorderSizePixel = 0
	flash.Parent = gui
	local label = Instance.new("TextLabel")
	label.Size = UDim2.new(1, 0, 0, 80)
	label.Position = UDim2.new(0, 0, 0.2, 0)
	label.BackgroundTransparency = 1
	label.Text = text
	label.Font = Enum.Font.FredokaOne
	label.TextScaled = true
	label.TextColor3 = Color3.new(1, 1, 1)
	label.TextStrokeTransparency = 0
	label.Parent = gui
	local tw = game:GetService("TweenService"):Create(flash, TweenInfo.new(1.5), { BackgroundTransparency = 1 })
	tw:Play()
	game:GetService("TweenService"):Create(label, TweenInfo.new(1.5, Enum.EasingStyle.Quad, Enum.EasingDirection.In), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	task.delay(1.6, function()
		gui:Destroy()
	end)
	-- كونفيتي
	local cam = Workspace.CurrentCamera
	if cam then
		local attach = Instance.new("Attachment")
		attach.Parent = Workspace.Terrain
		attach.WorldPosition = cam.CFrame.Position + cam.CFrame.LookVector * 10 + Vector3.new(0, 6, 0)
		local pe = Instance.new("ParticleEmitter")
		pe.Color = ColorSequence.new({ ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 0, 80)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(255, 220, 0)), ColorSequenceKeypoint.new(1, Color3.fromRGB(0, 200, 255)) })
		pe.Size = NumberSequence.new(0.5)
		pe.Lifetime = NumberRange.new(1.5, 2.5)
		pe.Rate = 0
		pe.Speed = NumberRange.new(20, 35)
		pe.SpreadAngle = Vector2.new(180, 180)
		pe.Acceleration = Vector3.new(0, -25, 0)
		pe.LightEmission = 1
		pe.Parent = attach
		pe:Emit(200)
		task.delay(3, function()
			attach:Destroy()
		end)
	end
end

-- انفجار جزيئات عند نقطة
function EffectsController.Burst(pos: Vector3, color: Color3, count: number, size: number?)
	local attach = Instance.new("Attachment")
	attach.Parent = Workspace.Terrain
	attach.WorldPosition = pos
	local pe = Instance.new("ParticleEmitter")
	pe.Color = ColorSequence.new(color, Color3.new(1, 1, 1))
	pe.Size = NumberSequence.new(size or 0.5, 0)
	pe.Transparency = NumberSequence.new(0, 1)
	pe.Lifetime = NumberRange.new(0.5, 1)
	pe.Rate = 0
	pe.Speed = NumberRange.new(8, 16)
	pe.SpreadAngle = Vector2.new(180, 180)
	pe.Acceleration = Vector3.new(0, -20, 0)
	pe.LightEmission = 1
	pe.Parent = attach
	pe:Emit(count)
	task.delay(1.5, function()
		attach:Destroy()
	end)
end

-- موجة صدمة (حلقة تتوسع)
function EffectsController.Shockwave(pos: Vector3, color: Color3)
	local ring = Instance.new("Part")
	ring.Shape = Enum.PartType.Cylinder
	ring.Anchored = true
	ring.CanCollide = false
	ring.CanQuery = false
	ring.Material = Enum.Material.Neon
	ring.Color = color
	ring.Transparency = 0.2
	ring.Size = Vector3.new(0.3, 2, 2)
	ring.CFrame = CFrame.new(pos + Vector3.new(0, 0.5, 0)) * CFrame.Angles(0, 0, math.pi / 2)
	ring.Parent = Workspace
	local TweenService = game:GetService("TweenService")
	TweenService:Create(ring, TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { Size = Vector3.new(0.3, 18, 18), Transparency = 1 }):Play()
	task.delay(0.6, function()
		ring:Destroy()
	end)
end

-- ألعاب نارية فوق اللاعب
function EffectsController.Fireworks(origin: Vector3, count: number?)
	task.spawn(function()
		for i = 1, count or 6 do
			local pos = origin + Vector3.new(math.random(-20, 20), 20 + math.random(0, 15), math.random(-20, 20))
			local color = Color3.fromHSV(math.random(), 0.8, 1)
			EffectsController.Burst(pos, color, 60, 0.8)
			local light = Instance.new("PointLight")
			local holder = Instance.new("Part")
			holder.Anchored = true
			holder.CanCollide = false
			holder.Transparency = 1
			holder.Position = pos
			holder.Parent = Workspace
			light.Color = color
			light.Range = 40
			light.Brightness = 3
			light.Parent = holder
			EffectsController.Play("Firework")
			task.delay(0.4, function()
				holder:Destroy()
			end)
			task.wait(0.25)
		end
	end)
end

-- وضع الرسومات المنخفضة: إيقاف الجزيئات الجوية والآثار
local lowApplied = false
function EffectsController.ApplyLowGraphics(on: boolean)
	if on == lowApplied then
		return
	end
	lowApplied = on
	local map = Workspace:FindFirstChild("Map")
	if map then
		for _, d in ipairs(map:GetDescendants()) do
			if d:IsA("ParticleEmitter") then
				d.Enabled = not on
			end
		end
	end
	local Lighting = game:GetService("Lighting")
	for _, e in ipairs(Lighting:GetChildren()) do
		if e:IsA("BloomEffect") or e:IsA("SunRaysEffect") then
			e.Enabled = not on
		end
	end
end

function EffectsController.Init()
	local ReplicatedStorage2 = game:GetService("ReplicatedStorage")
	local Remotes = require(ReplicatedStorage2:WaitForChild("Shared").Remotes)
	Remotes.Event("EventEffect").OnClientEvent:Connect(function(data)
		local Players = game:GetService("Players")
		local char = Players.LocalPlayer.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		if data.Type == "Huge" then
			screenFlash(Color3.fromRGB(255, 0, 80), "🎉 " .. tostring(data.Player) .. " حصل على حيوان عملاق!")
		elseif data.Type == "Titanic" then
			screenFlash(Color3.new(1, 1, 1), "🌟 " .. tostring(data.Player) .. " حصل على TITANIC!!! 🌟")
			if hrp then
				EffectsController.Fireworks(hrp.Position, 10)
			end
		elseif data.Type == "EventStart" then
			EffectsController.Play(data.Id == "BossRaid" and "Boss" or "Unlock")
			screenFlash(Color3.fromRGB(120, 60, 200), "🎉 بدأ حدث عالمي!")
		elseif data.Type == "ZoneUnlock" then
			EffectsController.Play("Unlock")
			if hrp then
				EffectsController.Fireworks(hrp.Position, 8)
			end
		elseif data.Type == "HatchRare" and hrp then
			local rank = ({ Legendary = 1, Mythical = 2, Exclusive = 3, Huge = 4, Titanic = 5 })[data.Rarity] or 0
			if rank > 0 then
				EffectsController.Burst(hrp.Position + Vector3.new(0, 3, 0), rank >= 4 and Color3.fromRGB(255, 0, 80) or Color3.fromRGB(255, 200, 40), 40 * rank, 0.7)
				EffectsController.Shockwave(hrp.Position, rank >= 4 and Color3.fromRGB(255, 0, 80) or Color3.fromRGB(255, 200, 40))
			end
		elseif data.Type == "DungeonWave" then
			EffectsController.Play("Wave")
			screenFlash(Color3.fromRGB(80, 0, 140), "🌀 الموجة " .. tostring(data.Wave))
		elseif data.Type == "DungeonBoss" then
			EffectsController.Play("Boss")
			screenFlash(Color3.fromRGB(120, 0, 60), "👹 حارس الشق!")
		elseif data.Type == "DungeonClear" and hrp then
			EffectsController.Fireworks(hrp.Position, 8)
		elseif data.Type == "Treasure" then
			screenFlash(Color3.fromRGB(120, 100, 0), "🗺️ ظهر كنز! اذهب قبل اختفائه")
		elseif data.Type == "Purchase" and hrp then
			EffectsController.Burst(hrp.Position + Vector3.new(0, 3, 0), Color3.fromRGB(200, 140, 255), 40, 0.6)
			EffectsController.Play("Sell")
		end
	end)
	for name, id in pairs(Config.Sounds) do
		if id and id > 0 then
			local s = Instance.new("Sound")
			s.SoundId = "rbxassetid://" .. id
			s.Volume = name == "Music" and 0.35 or 0.6
			s.Looped = name == "Music"
			s.Parent = SoundService
			sounds[name] = s
			if name == "Music" then
				music = s
			end
		end
	end
	DataController.Changed:Connect(function(p)
		EffectsController.ApplyLowGraphics(p.Settings and p.Settings.LowGraphics == true)
	end)
	task.delay(3, function()
		local p = DataController.Profile
		if p then
			EffectsController.ApplyLowGraphics(p.Settings and p.Settings.LowGraphics == true)
		end
	end)
	if music then
		music:Play()
		DataController.Changed:Connect(function(p)
			if p.Settings and p.Settings.Music == false then
				music:Pause()
			elseif not music.IsPlaying then
				music:Play()
			end
		end)
	end

	-- دورة ألوان قوس قزح
	local hue = 0
	RunService.Heartbeat:Connect(function(dt)
		hue = (hue + dt * 0.25) % 1
		local color = Color3.fromHSV(hue, 0.85, 1)
		local folder = Workspace:FindFirstChild("ClientPets")
		if folder then
			for _, model in ipairs(folder:GetChildren()) do
				if model:GetAttribute("Variant") == "Rainbow" then
					for _, part in ipairs(model:GetChildren()) do
						if part:IsA("BasePart") and part:GetAttribute("Rainbow") then
							part.Color = color
						end
					end
				end
			end
		end
	end)
end

return EffectsController

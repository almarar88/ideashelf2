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

function EffectsController.Init()
	local ReplicatedStorage2 = game:GetService("ReplicatedStorage")
	local Remotes = require(ReplicatedStorage2:WaitForChild("Shared").Remotes)
	Remotes.Event("EventEffect").OnClientEvent:Connect(function(data)
		if data.Type == "Huge" then
			screenFlash(Color3.fromRGB(255, 0, 80), "🎉 " .. tostring(data.Player) .. " حصل على حيوان عملاق!")
		elseif data.Type == "EventStart" then
			EffectsController.Play(data.Id == "BossRaid" and "Boss" or "Unlock")
			screenFlash(Color3.fromRGB(120, 60, 200), "🎉 بدأ حدث عالمي!")
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

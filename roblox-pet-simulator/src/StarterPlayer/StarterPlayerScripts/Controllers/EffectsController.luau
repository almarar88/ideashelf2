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

function EffectsController.Init()
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

--!strict
-- نسخة العميل من بيانات اللاعب
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Remotes = require(Shared.Remotes)

local DataController = {}

local changed = Instance.new("BindableEvent")
DataController.Changed = changed.Event
DataController.Profile = nil :: any
local serverOffset = 0

function DataController.Init()
	Remotes.Event("ProfileUpdate").OnClientEvent:Connect(function(profile)
		DataController.Profile = profile
		if profile.ServerTime then
			serverOffset = profile.ServerTime - os.time()
		end
		changed:Fire(profile)
	end)
end

function DataController.Wait(): any
	local t = 0
	while not DataController.Profile do
		if t % 2 == 0 then
			Remotes.Event("RequestProfile"):FireServer()
		end
		task.wait(0.5)
		t += 1
	end
	return DataController.Profile
end

function DataController.ServerTime(): number
	return os.time() + serverOffset
end

function DataController.Owns(pass: string): boolean
	local p = DataController.Profile
	return p ~= nil and p.OwnedPasses ~= nil and p.OwnedPasses[pass] == true
end

function DataController.FindPet(uid: string): any
	local p = DataController.Profile
	if not p then
		return nil
	end
	for _, pet in ipairs(p.Pets) do
		if pet.Uid == uid then
			return pet
		end
	end
	return nil
end

return DataController

--!strict
-- عرض حيوان داخل ViewportFrame (للمخزن، البيض، الفتح)
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local PetModelBuilder = require(Shared.Modules.PetModelBuilder)

local PetViewport = {}

function PetViewport.Create(parent: Instance, petId: string, variant: string?, spin: boolean?): ViewportFrame
	local vp = Instance.new("ViewportFrame")
	vp.Size = UDim2.fromScale(1, 1)
	vp.BackgroundTransparency = 1
	vp.Ambient = Color3.fromRGB(200, 200, 200)
	vp.LightColor = Color3.fromRGB(255, 255, 255)
	vp.LightDirection = Vector3.new(-1, -1, -1)
	local model = PetModelBuilder.Build(petId, variant)
	if model then
		model:PivotTo(CFrame.new())
		model.Parent = vp
	end
	local cam = Instance.new("Camera")
	cam.FieldOfView = 40
	cam.CFrame = CFrame.new(Vector3.new(2.2, 1.6, -4.6), Vector3.new(0, 0.1, 0))
	cam.Parent = vp
	vp.CurrentCamera = cam
	vp.Parent = parent
	if spin and model then
		local angle = 0
		local conn
		conn = RunService.RenderStepped:Connect(function(dt)
			if not vp.Parent then
				conn:Disconnect()
				return
			end
			angle += dt * 1.2
			model:PivotTo(CFrame.Angles(0, angle, 0))
		end)
	end
	return vp
end

return PetViewport

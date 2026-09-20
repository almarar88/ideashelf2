--!strict
-- البوابات: تسمح بالمرور محلياً للمناطق المفتوحة، وتحديث لافتاتها
local Workspace = game:GetService("Workspace")
local DataController = require(script.Parent.DataController)

local ZoneController = {}

local gates: { BasePart } = {}

local function refresh()
	local p = DataController.Profile
	if not p then
		return
	end
	for _, gate in ipairs(gates) do
		local zone = gate:GetAttribute("Zone")
		local unlocked = p.UnlockedZones[tostring(zone)] == true
		gate.CanCollide = not unlocked
		gate.Transparency = unlocked and 0.85 or 0.3
		local bb = gate:FindFirstChildOfClass("BillboardGui")
		local label = bb and bb:FindFirstChildOfClass("TextLabel")
		if label and unlocked then
			label.Text = (label.Text:gsub("🔒", "🔓"))
		end
	end
end

function ZoneController.Init()
	local map = Workspace:WaitForChild("Map")
	for _, inst in ipairs(map:GetDescendants()) do
		if inst:IsA("BasePart") and inst.Name == "Gate" then
			table.insert(gates, inst)
		end
	end
	map.DescendantAdded:Connect(function(inst)
		if inst:IsA("BasePart") and inst.Name == "Gate" then
			table.insert(gates, inst)
			refresh()
		end
	end)
	DataController.Changed:Connect(refresh)
	refresh()
end

return ZoneController

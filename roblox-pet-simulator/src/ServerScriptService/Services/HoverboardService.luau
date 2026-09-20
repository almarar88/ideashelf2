--!strict
-- الهوفربورد: شراء، تجهيز، ركوب (لوح ملحوم تحت اللاعب + سرعة)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local ZoneService = require(script.Parent.ZoneService)

local HoverboardService = {}

local function boardDef(id: string): any?
	for _, b in ipairs(Config.Hoverboards) do
		if b.Id == id then
			return b
		end
	end
	return nil
end

local function removeBoard(player: Player)
	local char = player.Character
	local board = char and char:FindFirstChild("Hoverboard")
	if board then
		board:Destroy()
	end
	player:SetAttribute("BoardSpeed", 0)
	player:SetAttribute("Riding", false)
	ZoneService.RefreshSpeed(player)
end

local function mountBoard(player: Player, def: any)
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp then
		return
	end
	removeBoard(player)
	local board = Instance.new("Part")
	board.Name = "Hoverboard"
	board.Size = Vector3.new(4.5, 0.4, 2.2)
	board.Color = def.Color
	board.Material = def.Neon and Enum.Material.Neon or Enum.Material.Metal
	board.CanCollide = false
	board.Massless = true
	board.CFrame = hrp.CFrame * CFrame.new(0, -3.1, 0)
	local weld = Instance.new("Weld")
	weld.Part0 = hrp
	weld.Part1 = board
	weld.C0 = CFrame.new(0, -3.1, 0)
	weld.Parent = board
	local a0 = Instance.new("Attachment")
	a0.Position = Vector3.new(-2, 0, 0)
	a0.Parent = board
	local a1 = Instance.new("Attachment")
	a1.Position = Vector3.new(2, 0, 0)
	a1.Parent = board
	local trail = Instance.new("Trail")
	trail.Attachment0 = a0
	trail.Attachment1 = a1
	trail.Color = ColorSequence.new(def.Color)
	trail.Lifetime = 0.5
	trail.Transparency = NumberSequence.new(0.3, 1)
	trail.LightEmission = 1
	trail.Parent = board
	if def.Neon then
		local light = Instance.new("PointLight")
		light.Color = def.Color
		light.Range = 8
		light.Parent = board
	end
	board.Parent = char
	player:SetAttribute("BoardSpeed", def.Speed)
	player:SetAttribute("Riding", true)
	ZoneService.RefreshSpeed(player)
end

function HoverboardService.Action(player: Player, action: string, id: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if action == "Buy" then
		local def = boardDef(id)
		if not def then
			return { ok = false, error = "لوح غير موجود" }
		end
		if p.Hoverboards.Owned[id] then
			return { ok = false, error = "تملكه بالفعل" }
		end
		if not DataService.Spend(player, "Diamonds", def.Cost) then
			return { ok = false, error = "تحتاج 💎 " .. def.Cost }
		end
		p.Hoverboards.Owned[id] = true
		p.Hoverboards.Equipped = id
		DataService.Notify(player, "🛹 اشتريت " .. def.Name .. "! اضغط Q للركوب", Color3.fromRGB(120, 255, 140))
	elseif action == "Equip" then
		if not p.Hoverboards.Owned[id] then
			return { ok = false, error = "لا تملك هذا اللوح" }
		end
		p.Hoverboards.Equipped = id
		if player:GetAttribute("Riding") then
			mountBoard(player, boardDef(id))
		end
	elseif action == "Toggle" then
		local eq = p.Hoverboards.Equipped
		local def = eq ~= "" and boardDef(eq) or nil
		if not def then
			return { ok = false, error = "اشترِ لوحاً من المتجر أولاً" }
		end
		if player:GetAttribute("Riding") then
			removeBoard(player)
		else
			mountBoard(player, def)
		end
		return { ok = true }
	else
		return { ok = false, error = "إجراء غير معروف" }
	end
	DataService.MarkDirty(player)
	return { ok = true }
end

function HoverboardService.Init()
	Remotes.Function("Hoverboard").OnServerInvoke = function(player, action, id)
		return HoverboardService.Action(player, tostring(action), tostring(id))
	end
	Players.PlayerAdded:Connect(function(player)
		player.CharacterAdded:Connect(function()
			player:SetAttribute("Riding", false)
			player:SetAttribute("BoardSpeed", 0)
		end)
	end)
end

return HoverboardService

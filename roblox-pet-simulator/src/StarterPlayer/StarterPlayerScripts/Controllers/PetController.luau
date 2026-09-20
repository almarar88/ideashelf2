--!strict
-- يعرض حيوانات كل اللاعبين ويحركها خلفهم، وتهاجم الهدف عند الضرب
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local PetModelBuilder = require(Shared.Modules.PetModelBuilder)
local DataController = require(script.Parent.DataController)

local PetController = {}

type Rendered = { Uid: string, Model: Model, Pos: Vector3, Seed: number }
local rendered: { [Player]: { Rendered } } = {}
local folder: Folder
local localPlayer = Players.LocalPlayer

local function rebuild(player: Player)
	local list = rendered[player] or {}
	local raw = player:GetAttribute("EquippedPets")
	local wanted = {}
	if type(raw) == "string" and raw ~= "" then
		local ok, decoded = pcall(HttpService.JSONDecode, HttpService, raw)
		if ok and type(decoded) == "table" then
			wanted = decoded
		end
	end
	-- إزالة غير الموجود
	local keep = {}
	for _, r in ipairs(list) do
		local found = false
		for _, w in ipairs(wanted) do
			if w.Uid == r.Uid then
				found = true
			end
		end
		if found then
			table.insert(keep, r)
		else
			r.Model:Destroy()
		end
	end
	-- إضافة الجديد
	for _, w in ipairs(wanted) do
		local exists = false
		for _, r in ipairs(keep) do
			if r.Uid == w.Uid then
				exists = true
			end
		end
		if not exists then
			local model = PetModelBuilder.Build(w.Id, w.Variant)
			if model then
				model.Name = player.Name .. "_" .. w.Uid
				local char = player.Character
				local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
				local start = hrp and hrp.Position or Vector3.new()
				model:PivotTo(CFrame.new(start))
				model.Parent = folder
				table.insert(keep, { Uid = w.Uid, Model = model, Pos = start, Seed = math.random() * 10 })
			end
		end
	end
	rendered[player] = keep
end

local function hookPlayer(player: Player)
	rendered[player] = {}
	rebuild(player)
	player:GetAttributeChangedSignal("EquippedPets"):Connect(function()
		rebuild(player)
	end)
end

local function unhookPlayer(player: Player)
	local list = rendered[player]
	if list then
		for _, r in ipairs(list) do
			r.Model:Destroy()
		end
	end
	rendered[player] = nil
end

local function findBreakable(id: string): Model?
	local bf = Workspace:FindFirstChild("Breakables")
	return bf and bf:FindFirstChild(id) :: Model?
end

local function step(dt: number)
	local now = os.clock()
	local hideOthers = DataController.Profile and DataController.Profile.Settings and DataController.Profile.Settings.HideOthersPets
	for player, list in pairs(rendered) do
		local char = player.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		local hide = hideOthers and player ~= localPlayer
		if not hrp then
			for _, r in ipairs(list) do
				r.Model:PivotTo(CFrame.new(0, -500, 0))
			end
			continue
		end
		local targetId = player:GetAttribute("Target")
		local targetModel = (type(targetId) == "string" and targetId ~= "") and findBreakable(targetId) or nil
		local targetPart = targetModel and targetModel.PrimaryPart
		local n = #list
		for i, r in ipairs(list) do
			if hide then
				r.Model:PivotTo(CFrame.new(0, -500, 0))
				continue
			end
			local goal: Vector3
			local look: Vector3
			if targetPart then
				-- دائرة حول الهدف
				local ang = (i / n) * math.pi * 2 + now * 0.3
				local radius = math.max(targetPart.Size.X, targetPart.Size.Z) * 0.5 + 3.5
				local center = targetPart.Position
				goal = center + Vector3.new(math.cos(ang) * radius, 1.5, math.sin(ang) * radius)
				-- اندفاع نحو الهدف كل ثانية
				local phase = (now + r.Seed) % 1
				local lunge = phase < 0.25 and math.sin(phase / 0.25 * math.pi) * 2 or 0
				goal = goal + (center - goal).Unit * lunge
				look = center
			else
				local row = (i - 1) // 3
				local col = (i - 1) % 3
				local offset = Vector3.new((col - 1) * 3.4, 0, 3.5 + row * 3.4)
				goal = (hrp.CFrame * CFrame.new(offset)).Position
				goal = Vector3.new(goal.X, hrp.Position.Y - 1.6, goal.Z)
				look = goal + hrp.CFrame.LookVector
			end
			local bob = math.sin(now * 4 + r.Seed) * 0.35
			r.Pos = r.Pos:Lerp(goal, math.min(1, dt * 7))
			local pos = r.Pos + Vector3.new(0, bob + 1.2, 0)
			local flatLook = Vector3.new(look.X, pos.Y, look.Z)
			if (flatLook - pos).Magnitude < 0.1 then
				flatLook = pos + hrp.CFrame.LookVector
			end
			r.Model:PivotTo(CFrame.lookAt(pos, flatLook))
		end
	end
end

function PetController.Init()
	folder = Instance.new("Folder")
	folder.Name = "ClientPets"
	folder.Parent = Workspace
	for _, p in ipairs(Players:GetPlayers()) do
		hookPlayer(p)
	end
	Players.PlayerAdded:Connect(hookPlayer)
	Players.PlayerRemoving:Connect(unhookPlayer)
	RunService.Heartbeat:Connect(step)
end

return PetController

--!strict
-- لوحة البيضة عند الاقتراب + شاشة الفتح (أنيميشن) + الفتح التلقائي
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Eggs = require(Shared.Data.Eggs)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local Luck = require(Shared.Modules.Luck)
local PetUtil = require(Shared.Modules.PetUtil)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local PetViewport = require(script.Parent.PetViewport)
local EffectsController = require(script.Parent.EffectsController)

local EggController = {}

local player = Players.LocalPlayer
local panel: Frame
local panelTitle: TextLabel
local panelList: Frame
local tripleBtn: TextButton
local octBtn: TextButton
local autoBtn: TextButton
local variantBtns: { [string]: TextButton } = {}
local currentVariant = "Normal"
local overlay: Frame
local overlayContent: Frame
local panelEgg: string? = nil
local hatching = false
local autoHatch = false
local eggModels: { Model } = {}
local refreshPanel: () -> ()

local function buildPanel(gui: ScreenGui)
	panel = UIKit.Frame({ Name = "EggPanel", Size = UDim2.fromOffset(640, 270), Position = UDim2.new(0.5, -320, 1, -290), BackgroundColor3 = UIKit.Colors.Panel, BackgroundTransparency = 0.05, Visible = false, Parent = gui })
	UIKit.Corner(panel, 18)
	UIKit.Stroke(panel, UIKit.Colors.Gold, 3)
	panelTitle = UIKit.Label({ Text = "", Size = UDim2.new(1, -230, 0, 34), Position = UDim2.fromOffset(8, 6), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 22, Parent = panel })
	local variants = UIKit.Frame({ Size = UDim2.fromOffset(220, 30), Position = UDim2.new(1, -228, 0, 8), BackgroundTransparency = 1, Parent = panel })
	UIKit.List(variants, 4, true)
	for _, v in ipairs({ { "Normal", "عادي", UIKit.Colors.Panel3 }, { "Golden", "ذهبي x5", UIKit.Colors.Gold }, { "Rainbow", "قوس قزح x25", UIKit.Colors.Pink } }) do
		variantBtns[v[1]] = UIKit.Button({ Text = v[2], Color = v[3], Size = UDim2.fromOffset(70, 30), MaxTextSize = 12, Parent = variants }, function()
			currentVariant = v[1]
			refreshPanel()
		end)
	end
	panelList = UIKit.Frame({ Size = UDim2.new(1, -16, 0, 120), Position = UDim2.fromOffset(8, 44), BackgroundTransparency = 1, Parent = panel })
	UIKit.List(panelList, 6, true, true)
	local buttons = UIKit.Frame({ Size = UDim2.new(1, -16, 0, 44), Position = UDim2.new(0, 8, 1, -52), BackgroundTransparency = 1, Parent = panel })
	UIKit.List(buttons, 8, true, true)
	UIKit.Button({ Text = "فتح (E)", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(145, 44), MaxTextSize = 18, Parent = buttons }, function()
		EggController.Hatch(1)
	end)
	tripleBtn = UIKit.Button({ Text = "فتح 3 (R)", Color = UIKit.Colors.Gold, Size = UDim2.fromOffset(145, 44), MaxTextSize = 18, Parent = buttons }, function()
		EggController.Hatch(3)
	end)
	octBtn = UIKit.Button({ Text = "فتح 8 (F)", Color = UIKit.Colors.Cyan, Size = UDim2.fromOffset(145, 44), MaxTextSize = 18, Parent = buttons }, function()
		EggController.Hatch(8)
	end)
	autoBtn = UIKit.Button({ Text = "تلقائي (T)", Color = UIKit.Colors.Purple, Size = UDim2.fromOffset(145, 44), MaxTextSize = 18, Parent = buttons }, function()
		EggController.ToggleAuto()
	end)
end

function refreshPanel()
	if not panelEgg then
		return
	end
	local egg = Eggs.Get(panelEgg) :: Eggs.EggDef
	local p = DataController.Profile
	local luck = p and p.Luck or 1
	if egg.Currency ~= "Coins" then
		currentVariant = "Normal"
	end
	for v, btn in pairs(variantBtns) do
		btn.Visible = egg.Currency == "Coins"
		local stroke = btn:FindFirstChildOfClass("UIStroke")
		if stroke then
			stroke.Color = v == currentVariant and Color3.new(1, 1, 1) or Color3.new(0, 0, 0)
			stroke.Thickness = v == currentVariant and 3 or 2
		end
	end
	local currencyIcon = egg.Currency == "Coins" and "💰 " or (egg.Currency == "Diamonds" and "💎 " or "🔁 ")
	local cost = egg.Cost * (Config.EggVariantCost[currentVariant] or 1)
	panelTitle.Text = egg.Name .. (currentVariant ~= "Normal" and (" (" .. currentVariant .. ")") or "") .. "   " .. currencyIcon .. Format.Number(cost) .. (luck > 1 and ("   🍀 x" .. string.format("%.2f", luck)) or "")
	for _, c in ipairs(panelList:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	for _, entry in ipairs(Luck.ApplyLuck(panelEgg, luck)) do
		local def = Pets.Get(entry.Pet) :: Pets.PetDef
		local card = UIKit.Frame({ Size = UDim2.fromOffset(84, 118), BackgroundColor3 = UIKit.Colors.Panel2, Parent = panelList })
		UIKit.Corner(card, 10)
		UIKit.Stroke(card, Rarities.Color(def.Rarity), 2)
		local vp = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 70), BackgroundTransparency = 1, Parent = card })
		PetViewport.Create(vp, def.Id, currentVariant)
		UIKit.Label({ Text = def.Name, Size = UDim2.new(1, -4, 0, 20), Position = UDim2.fromOffset(2, 72), MaxTextSize = 12, Parent = card })
		UIKit.Label({ Text = Format.Percent(entry.Chance), Size = UDim2.new(1, 0, 0, 20), Position = UDim2.fromOffset(0, 94), TextColor3 = Rarities.Color(def.Rarity), MaxTextSize = 14, Parent = card })
	end
	tripleBtn.BackgroundColor3 = DataController.Owns("TripleHatch") and UIKit.Colors.Gold or UIKit.Colors.Panel3
	octBtn.BackgroundColor3 = DataController.Owns("OctupleHatch") and UIKit.Colors.Cyan or UIKit.Colors.Panel3
	autoBtn.BackgroundColor3 = autoHatch and UIKit.Colors.Green or (DataController.Owns("AutoHatch") and UIKit.Colors.Purple or UIKit.Colors.Panel3)
	autoBtn.Text = autoHatch and "إيقاف (T)" or "تلقائي (T)"
end

-- ===== شاشة الفتح =====
local function buildOverlay(gui: ScreenGui)
	overlay = UIKit.Frame({ Name = "HatchOverlay", Size = UDim2.fromScale(1, 1), BackgroundColor3 = Color3.new(0, 0, 0), BackgroundTransparency = 0.45, Visible = false, ZIndex = 10, Parent = gui })
	overlayContent = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, ZIndex = 11, Parent = overlay })
	UIKit.List(overlayContent, 24, true, true)
	local skip = UIKit.Label({ Text = "اضغط في أي مكان للتخطي", Size = UDim2.new(1, 0, 0, 30), Position = UDim2.new(0, 0, 1, -60), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 20, ZIndex = 12, Parent = overlay })
	skip.Name = "Skip"
end

local function eggViewport(parent: Instance, egg: Eggs.EggDef): (ViewportFrame, Model)
	local vp = Instance.new("ViewportFrame")
	vp.Size = UDim2.fromScale(1, 0.85)
	vp.BackgroundTransparency = 1
	vp.Ambient = Color3.fromRGB(200, 200, 200)
	vp.LightDirection = Vector3.new(-1, -1, -1)
	vp.ZIndex = 12
	local model = Instance.new("Model")
	local shell = Instance.new("Part")
	shell.Size = Vector3.new(4, 5.2, 4)
	shell.Color = egg.Color
	shell.Anchored = true
	shell.Material = Enum.Material.SmoothPlastic
	local mesh = Instance.new("SpecialMesh")
	mesh.MeshType = Enum.MeshType.Sphere
	mesh.Parent = shell
	shell.Parent = model
	local rng = Random.new(#egg.Id)
	for _ = 1, 6 do
		local ang = rng:NextNumber(0, math.pi * 2)
		local y = rng:NextNumber(-1.4, 1.4)
		local r = 1.85 * math.sqrt(math.max(0, 1 - (y / 2.6) ^ 2))
		local spot = Instance.new("Part")
		spot.Shape = Enum.PartType.Ball
		spot.Size = Vector3.new(0.8, 0.8, 0.8)
		spot.Color = egg.Accent
		spot.Anchored = true
		spot.CFrame = CFrame.new(math.cos(ang) * r, y, math.sin(ang) * r)
		spot.Parent = model
	end
	model.PrimaryPart = shell
	model.Parent = vp
	local cam = Instance.new("Camera")
	cam.FieldOfView = 45
	cam.CFrame = CFrame.new(Vector3.new(0, 0.5, -9), Vector3.new(0, 0, 0))
	cam.Parent = vp
	vp.CurrentCamera = cam
	vp.Parent = parent
	return vp, model
end

local function playHatch(eggId: string, results: { any })
	local egg = Eggs.Get(eggId) :: Eggs.EggDef
	hatching = true
	overlay.Visible = true
	for _, c in ipairs(overlayContent:GetChildren()) do
		if not c:IsA("UIListLayout") then
			c:Destroy()
		end
	end
	local slots = {}
	local many = #results > 3
	for _, res in ipairs(results) do
		local holder = UIKit.Frame({ Size = many and UDim2.fromOffset(150, 240) or UDim2.fromOffset(260, 360), BackgroundTransparency = 1, ZIndex = 11, Parent = overlayContent })
		local vp, model = eggViewport(holder, egg)
		table.insert(slots, { Holder = holder, Vp = vp, Model = model, Result = res })
	end
	EffectsController.Play("Hatch")
	-- اهتزاز
	local t0 = os.clock()
	local skipped = false
	local conn
	conn = UserInputService.InputBegan:Connect(function(input)
		if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch or input.KeyCode == Enum.KeyCode.Space then
			skipped = true
		end
	end)
	local fast = DataController.Owns("FastHatch")
	while os.clock() - t0 < (fast and 0.8 or 1.6) and not skipped do
		local dt = os.clock() - t0
		for _, s in ipairs(slots) do
			local ang = math.sin(dt * 28) * 0.28 * math.min(1, dt * 2)
			local scale = 1 + math.sin(dt * 10) * 0.04
			s.Model:PivotTo(CFrame.new(0, math.abs(math.sin(dt * 14)) * 0.4, 0) * CFrame.Angles(0, 0, ang))
			s.Vp.Size = UDim2.fromScale(scale, 0.85 * scale)
		end
		RunService.RenderStepped:Wait()
	end
	-- كشف الحيوان
	for _, s in ipairs(slots) do
		s.Vp:Destroy()
		local def = Pets.Get(s.Result.Id) :: Pets.PetDef
		local card = UIKit.Frame({ Size = UDim2.fromScale(1, 1), BackgroundColor3 = UIKit.Colors.Panel, ZIndex = 12, Parent = s.Holder })
		UIKit.Corner(card, 18)
		UIKit.Stroke(card, Rarities.Color(def.Rarity), 4)
		local vpHolder = UIKit.Frame({ Size = UDim2.new(1, 0, 0.66, 0), BackgroundTransparency = 1, ZIndex = 12, Parent = card })
		local vp = PetViewport.Create(vpHolder, s.Result.Id, s.Result.Variant, true)
		vp.ZIndex = 12
		local inst = { Uid = s.Result.Uid, Id = s.Result.Id, Variant = s.Result.Variant, Locked = false, Equipped = false, Time = 0, Level = 1, XP = 0, Enchants = {} }
		UIKit.Label({ Text = PetUtil.DisplayName(inst), Size = UDim2.new(1, -8, 0.1, 0), Position = UDim2.new(0, 4, 0.67, 0), MaxTextSize = 22, ZIndex = 13, Parent = card })
		UIKit.Label({ Text = def.Rarity .. " • " .. (Rarities.Info[def.Rarity] and Rarities.Info[def.Rarity].Arabic or ""), Size = UDim2.new(1, 0, 0.08, 0), Position = UDim2.new(0, 0, 0.78, 0), TextColor3 = Rarities.Color(def.Rarity), MaxTextSize = 18, ZIndex = 13, Parent = card })
		UIKit.Label({ Text = s.Result.Deleted and "🗑️ حُذف تلقائياً" or ("⚔️ " .. Format.Number(PetUtil.BasePower(inst))), Size = UDim2.new(1, 0, 0.08, 0), Position = UDim2.new(0, 0, 0.87, 0), TextColor3 = s.Result.Deleted and UIKit.Colors.Muted or UIKit.Colors.Pink, MaxTextSize = 18, ZIndex = 13, Parent = card })
		UIKit.Pop(card)
		if Rarities.Rank(def.Rarity) >= 5 then
			UIController.Notify("🌟 حصلت على " .. def.Name .. " (" .. def.Rarity .. ")!", Rarities.Color(def.Rarity))
		end
	end
	local t1 = os.clock()
	skipped = false
	while os.clock() - t1 < ((autoHatch or fast) and 1.2 or 2.6) and not skipped do
		task.wait(0.05)
	end
	conn:Disconnect()
	overlay.Visible = false
	hatching = false
end

function EggController.Hatch(count: number)
	if hatching or not panelEgg then
		return
	end
	if count >= 3 and not DataController.Owns("TripleHatch") then
		Remotes.Event("PromptPurchase"):FireServer("Gamepass", "TripleHatch")
		return
	end
	if count == 8 and not DataController.Owns("OctupleHatch") then
		Remotes.Event("PromptPurchase"):FireServer("Gamepass", "OctupleHatch")
		return
	end
	local eggId = panelEgg
	local res = Remotes.Function("HatchEgg"):InvokeServer(eggId, count, currentVariant)
	if res.ok and res.pets and #res.pets > 0 then
		playHatch(eggId, res.pets)
	elseif res.error then
		UIController.Notify(res.error, UIKit.Colors.Red)
		if res.error:find("ممتلئ") then
			autoHatch = false
			refreshPanel()
		end
	end
end

function EggController.ToggleAuto()
	if not DataController.Owns("AutoHatch") then
		Remotes.Event("PromptPurchase"):FireServer("Gamepass", "AutoHatch")
		return
	end
	autoHatch = not autoHatch
	refreshPanel()
end

local function nearestEgg(): string?
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp then
		return nil
	end
	local best, bestDist = nil, 16
	for _, m in ipairs(eggModels) do
		local pp = m.PrimaryPart
		if pp then
			local d = (pp.Position - hrp.Position).Magnitude
			if d < bestDist then
				best, bestDist = m:GetAttribute("EggId") :: string, d
			end
		end
	end
	return best
end

function EggController.Init()
	local gui = UIController.Gui :: ScreenGui
	buildPanel(gui)
	buildOverlay(gui)

	local map = Workspace:WaitForChild("Map")
	for _, inst in ipairs(map:GetDescendants()) do
		if inst:IsA("Model") and inst:GetAttribute("EggId") then
			table.insert(eggModels, inst)
		end
	end
	map.DescendantAdded:Connect(function(inst)
		if inst:IsA("Model") and inst:GetAttribute("EggId") then
			table.insert(eggModels, inst)
		end
	end)

	-- تحديث اللوحة حسب أقرب بيضة
	task.spawn(function()
		while true do
			task.wait(0.2)
			local id = nearestEgg()
			if id ~= panelEgg then
				panelEgg = id
				if id then
					refreshPanel()
					panel.Visible = true
					UIKit.Pop(panel)
				else
					panel.Visible = false
					autoHatch = false
				end
			end
		end
	end)

	-- الفتح التلقائي
	task.spawn(function()
		while true do
			task.wait(0.3)
			if autoHatch and panelEgg and not hatching then
				EggController.Hatch(DataController.Owns("OctupleHatch") and 8 or (DataController.Owns("TripleHatch") and 3 or 1))
			end
		end
	end)

	-- دوران البيض في العالم (القشرة مع النقاط)
	local spinCache: { [Model]: { Base: Vector3, Spots: { { Part: BasePart, Offset: CFrame } } } } = {}
	RunService.Heartbeat:Connect(function()
		local t = os.clock()
		for _, m in ipairs(eggModels) do
			local shell = m.PrimaryPart
			if shell and shell:IsDescendantOf(Workspace) then
				local cache = spinCache[m]
				if not cache then
					cache = { Base = shell.Position, Spots = {} }
					for _, c in ipairs(m:GetChildren()) do
						if c:IsA("BasePart") and (c.Name == "Spot" or c.Name == "Crown") then
							table.insert(cache.Spots, { Part = c, Offset = shell.CFrame:ToObjectSpace(c.CFrame) })
						end
					end
					spinCache[m] = cache
				end
				local cf = CFrame.new(cache.Base + Vector3.new(0, math.sin(t * 2) * 0.3, 0)) * CFrame.Angles(0, t * 0.6, 0)
				shell.CFrame = cf
				for _, s in ipairs(cache.Spots) do
					s.Part.CFrame = cf * s.Offset
				end
			end
		end
	end)

	DataController.Changed:Connect(function()
		if panel.Visible then
			refreshPanel()
		end
	end)

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed or not panel.Visible then
			return
		end
		if input.KeyCode == Enum.KeyCode.E then
			EggController.Hatch(1)
		elseif input.KeyCode == Enum.KeyCode.R then
			EggController.Hatch(3)
		elseif input.KeyCode == Enum.KeyCode.F then
			EggController.Hatch(8)
		elseif input.KeyCode == Enum.KeyCode.T then
			EggController.ToggleAuto()
		end
	end)
end

return EggController

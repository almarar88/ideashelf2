--!strict
-- نوافذ الآلات: الذهب، قوس قزح، المادة المظلمة، الدمج
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ProximityPromptService = game:GetService("ProximityPromptService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local PetUtil = require(Shared.Modules.PetUtil)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local InventoryUI = require(script.Parent.InventoryUI)
local PetViewport = require(script.Parent.PetViewport)

local MachineUI = {}

local INFO = {
	Golden = { Title = "✨ آلة الذهب", Desc = "ضع 3 حيوانات متطابقة (عادية) لتحصل على نسخة ذهبية بقوة x2", Color = UIKit.Colors.Gold, Max = 3 },
	Rainbow = { Title = "🌈 آلة قوس قزح", Desc = "ضع 3 حيوانات ذهبية متطابقة لتحصل على نسخة قوس قزح بقوة x4", Color = UIKit.Colors.Pink, Max = 3 },
	Fuse = { Title = "🔮 آلة الدمج", Desc = "ادمج 3 إلى 10 حيوانات لتحصل على حيوان عشوائي من نفس المنطقة أو أعلى (كلما زاد العدد زادت فرصة الترقية)", Color = UIKit.Colors.Cyan, Max = 10 },
	DarkMatter = { Title = "🌑 آلة المادة المظلمة", Desc = "ضع حيوان قوس قزح + " .. Config.Machines.DarkMatter.CostDiamonds .. " ألماسة، وبعد ساعة يتحول إلى مادة مظلمة بقوة x8", Color = UIKit.Colors.Purple, Max = 1 },
}

local currentKind = "Golden"
local selected: { [string]: boolean } = {}
local window: UIKit.Window
local grid: ScrollingFrame
local descLabel: TextLabel
local selectedLabel: TextLabel
local confirmBtn: TextButton
local resultFrame: Frame
local dmList: Frame

local function eligible(kind: string, pet: any): boolean
	if pet.Locked then
		return false
	end
	if kind == "Golden" then
		return pet.Variant == "Normal"
	elseif kind == "Rainbow" then
		return pet.Variant == "Golden"
	elseif kind == "DarkMatter" then
		return pet.Variant == "Rainbow"
	end
	return true
end

local function refresh()
	local p = DataController.Profile
	if not p then
		return
	end
	local info = INFO[currentKind]
	window.Title.Text = info.Title
	descLabel.Text = info.Desc
	for _, c in ipairs(grid:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	local sorted = table.clone(p.Pets)
	PetUtil.SortByPower(sorted)
	local count = 0
	for i, pet in ipairs(sorted) do
		if eligible(currentKind, pet) then
			-- في آلات الذهب/قوس قزح: عند اختيار أول حيوان نعرض فقط المتطابق معه
			local firstId
			for uid in pairs(selected) do
				local sp = DataController.FindPet(uid)
				if sp then
					firstId = sp.Id
				end
			end
			if (currentKind == "Golden" or currentKind == "Rainbow") and firstId and pet.Id ~= firstId then
				continue
			end
			local card = InventoryUI.PetCard(grid, pet, function()
				if selected[pet.Uid] then
					selected[pet.Uid] = nil
				else
					local n = 0
					for _ in pairs(selected) do
						n += 1
					end
					if n >= info.Max then
						UIController.Notify("الحد الأقصى " .. info.Max, UIKit.Colors.Red)
						return
					end
					selected[pet.Uid] = true
				end
				refresh()
			end)
			card.LayoutOrder = i
			if selected[pet.Uid] then
				local stroke = card:FindFirstChildOfClass("UIStroke")
				if stroke then
					stroke.Color = UIKit.Colors.Green
					stroke.Thickness = 4
				end
				local badge = card:FindFirstChild("Badge") :: TextLabel
				badge.Text = "☑️"
			end
			count += 1
		end
	end
	local n = 0
	for _ in pairs(selected) do
		n += 1
	end
	selectedLabel.Text = "المختار: " .. n .. " / " .. info.Max .. "   (المتاح: " .. count .. ")"
	local minNeeded = currentKind == "Fuse" and Config.Machines.Fuse.Min or info.Max
	confirmBtn.BackgroundColor3 = n >= minNeeded and UIKit.Colors.Green or UIKit.Colors.Panel3
	confirmBtn.Text = currentKind == "DarkMatter" and ("بدء التحويل (💎 " .. Config.Machines.DarkMatter.CostDiamonds .. ")") or "تنفيذ"

	-- قائمة المادة المظلمة
	for _, c in ipairs(dmList:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
	dmList.Visible = currentKind == "DarkMatter"
	if currentKind == "DarkMatter" then
		local now = DataController.ServerTime()
		for i, entry in ipairs(p.DarkMatter) do
			local def = Pets.Get(entry.PetId)
			local row = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 40), BackgroundColor3 = UIKit.Colors.Panel3, Parent = dmList })
			UIKit.Corner(row, 8)
			local remain = entry.Ready - now
			UIKit.Label({ Text = (def and def.Name or entry.PetId) .. "  " .. (remain > 0 and Format.Time(remain) or "جاهز!"), Size = UDim2.new(1, -110, 1, 0), Position = UDim2.fromOffset(8, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 16, Parent = row })
			UIKit.Button({ Text = "استلام", Color = remain > 0 and UIKit.Colors.Panel2 or UIKit.Colors.Green, Size = UDim2.fromOffset(90, 30), Position = UDim2.new(1, -96, 0, 5), MaxTextSize = 16, Parent = row }, function()
				local res = Remotes.Function("Machine"):InvokeServer("DarkMatterClaim", { Index = i })
				if not res.ok and res.error then
					UIController.Notify(res.error, UIKit.Colors.Red)
				end
			end)
		end
	end
end

local function showResult(pet: any)
	for _, c in ipairs(resultFrame:GetChildren()) do
		if not c:IsA("UICorner") and not c:IsA("UIStroke") then
			c:Destroy()
		end
	end
	resultFrame.Visible = true
	local vp = UIKit.Frame({ Size = UDim2.new(1, 0, 1, -40), BackgroundTransparency = 1, Parent = resultFrame })
	PetViewport.Create(vp, pet.Id, pet.Variant, true)
	UIKit.Label({ Text = "🎉 " .. PetUtil.DisplayName(pet) .. "  ⚔️ " .. Format.Number(PetUtil.BasePower(pet)), Size = UDim2.new(1, 0, 0, 36), Position = UDim2.new(0, 0, 1, -40), MaxTextSize = 22, Parent = resultFrame })
	UIKit.Pop(resultFrame)
	task.delay(3, function()
		resultFrame.Visible = false
	end)
end

function MachineUI.Open(kind: string)
	currentKind = kind
	selected = {}
	resultFrame.Visible = false
	UIController.Open("Machine")
	local info = INFO[kind]
	local stroke = window.Root:FindFirstChildOfClass("UIStroke")
	if stroke then
		stroke.Color = info.Color
	end
end

function MachineUI.Init()
	local gui = UIController.Gui :: ScreenGui
	window = UIKit.Window(gui, "Machine", "آلة", UDim2.fromOffset(860, 600), UIKit.Colors.Gold)
	descLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 40), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 17, Parent = window.Content })
	grid = UIKit.Scroll(window.Content, { Size = UDim2.new(1, -260, 1, -100), Position = UDim2.fromOffset(0, 46) })
	UIKit.Grid(grid, UDim2.fromOffset(118, 126), 8)
	local side = UIKit.Frame({ Size = UDim2.fromOffset(250, 0), Position = UDim2.new(1, -250, 0, 46), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = UIKit.Colors.Panel2, Parent = window.Content })
	UIKit.Corner(side, 14)
	UIKit.Padding(side, 10)
	UIKit.List(side, 8)
	selectedLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 40), MaxTextSize = 16, Parent = side })
	confirmBtn = UIKit.Button({ Text = "تنفيذ", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 44), MaxTextSize = 20, Parent = side }, function()
		local uids = {}
		for uid in pairs(selected) do
			table.insert(uids, uid)
		end
		local kind = currentKind
		local payload: any = { Uids = uids }
		if kind == "DarkMatter" then
			kind = "DarkMatterStart"
			payload = { Uid = uids[1] }
		end
		local res = Remotes.Function("Machine"):InvokeServer(kind, payload)
		if res.ok then
			selected = {}
			if res.result then
				showResult(res.result)
			else
				UIController.Notify("✅ تم!", UIKit.Colors.Green)
			end
			task.delay(0.2, refresh)
		elseif res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
	end)
	UIKit.Button({ Text = "إلغاء الاختيار", Color = UIKit.Colors.Panel3, Size = UDim2.new(1, 0, 0, 36), MaxTextSize = 18, Parent = side }, function()
		selected = {}
		refresh()
	end)
	dmList = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 0), AutomaticSize = Enum.AutomaticSize.Y, BackgroundTransparency = 1, Parent = side })
	UIKit.List(dmList, 6)

	resultFrame = UIKit.Frame({ Size = UDim2.fromOffset(260, 260), Position = UDim2.new(0.5, -130, 0.5, -130), BackgroundColor3 = UIKit.Colors.Panel, Visible = false, ZIndex = 5, Parent = window.Root })
	UIKit.Corner(resultFrame, 16)
	UIKit.Stroke(resultFrame, UIKit.Colors.Gold, 3)

	UIController.Register("Machine", window, refresh)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Machine") then
			refresh()
		end
	end)
	task.spawn(function()
		while true do
			task.wait(1)
			if UIController.IsOpen("Machine") and currentKind == "DarkMatter" then
				refresh()
			end
		end
	end)

	-- فتح النافذة من الـ ProximityPrompt الخاص بالآلة
	ProximityPromptService.PromptTriggered:Connect(function(prompt)
		local model = prompt:FindFirstAncestorOfClass("Model")
		local kind = model and model:GetAttribute("Machine")
		if type(kind) == "string" and INFO[kind] then
			MachineUI.Open(kind)
		end
	end)
end

return MachineUI

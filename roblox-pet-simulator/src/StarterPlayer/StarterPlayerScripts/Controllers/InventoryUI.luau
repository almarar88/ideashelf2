--!strict
-- نافذة الحيوانات: الشبكة، التفاصيل، التجهيز، القفل، الحذف، تجهيز الأفضل
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local PetUtil = require(Shared.Modules.PetUtil)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local PetViewport = require(script.Parent.PetViewport)
local UIController = require(script.Parent.UIController)

local InventoryUI = {}

local cards: { [string]: Frame } = {}
local selectedUid: string? = nil

-- بطاقة حيوان قابلة لإعادة الاستخدام (تستخدمها الآلات أيضاً)
function InventoryUI.PetCard(parent: Instance, pet: any, onClick: (() -> ())?): Frame
	local def = Pets.Get(pet.Id)
	local color = def and Rarities.Color(def.Rarity) or Color3.new(1, 1, 1)
	local card = UIKit.Frame({ Name = pet.Uid, BackgroundColor3 = UIKit.Colors.Panel2, Parent = parent })
	UIKit.Corner(card, 12)
	UIKit.Stroke(card, color, 2.5)
	local vpHolder = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 84), BackgroundTransparency = 1, Parent = card })
	PetViewport.Create(vpHolder, pet.Id, pet.Variant)
	UIKit.Label({ Text = PetUtil.DisplayName(pet), Size = UDim2.new(1, -6, 0, 20), Position = UDim2.fromOffset(3, 84), MaxTextSize = 14, Parent = card })
	UIKit.Label({ Text = "⚔️ " .. Format.Number(PetUtil.BasePower(pet)), Size = UDim2.new(1, 0, 0, 18), Position = UDim2.fromOffset(0, 104), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 14, Parent = card })
	local badge = UIKit.Label({ Name = "Badge", Text = "", Size = UDim2.fromOffset(26, 22), Position = UDim2.fromOffset(4, 4), MaxTextSize = 18, Parent = card })
	local lock = UIKit.Label({ Name = "Lock", Text = "", Size = UDim2.fromOffset(26, 22), Position = UDim2.new(1, -30, 0, 4), MaxTextSize = 18, Parent = card })
	badge.Text = pet.Equipped and "✅" or ""
	lock.Text = pet.Locked and "🔒" or ""
	if pet.Variant == "Golden" then
		UIKit.Gradient(card, Color3.fromRGB(80, 70, 30), UIKit.Colors.Panel)
	elseif pet.Variant == "Rainbow" then
		UIKit.Gradient(card, Color3.fromRGB(90, 40, 90), UIKit.Colors.Panel)
	elseif pet.Variant == "DarkMatter" then
		UIKit.Gradient(card, Color3.fromRGB(40, 10, 70), Color3.fromRGB(10, 5, 20))
	end
	local btn = UIKit.New("TextButton", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Text = "", Parent = card }) :: TextButton
	if onClick then
		btn.Activated:Connect(onClick)
	end
	return card
end

function InventoryUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Inventory", "🐾 حيواناتي", UDim2.fromOffset(860, 600), UIKit.Colors.Green)

	local header = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	local countLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(240, 44), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = header })
	local equipLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(200, 44), Position = UDim2.fromOffset(240, 0), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 20, Parent = header })
	UIKit.Button({ Text = "⭐ تجهيز الأفضل", Color = UIKit.Colors.Gold, Size = UDim2.fromOffset(170, 40), Position = UDim2.new(1, -350, 0, 2), MaxTextSize = 18, Parent = header }, function()
		Remotes.Function("PetAction"):InvokeServer("EquipBest", {})
	end)
	UIKit.Button({ Text = "إزالة الكل", Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(120, 40), Position = UDim2.new(1, -170, 0, 2), MaxTextSize = 18, Parent = header }, function()
		Remotes.Function("PetAction"):InvokeServer("UnequipAll", {})
	end)
	UIKit.Button({ Text = "🗑️", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(44, 40), Position = UDim2.new(1, -44, 0, 2), MaxTextSize = 18, Parent = header }, function()
		-- حذف كل الحيوانات العادية غير المقفولة وغير المجهزة (Common/Uncommon)
		local p = DataController.Profile
		if not p then
			return
		end
		local uids = {}
		for _, pet in ipairs(p.Pets) do
			local def = Pets.Get(pet.Id)
			if def and not pet.Locked and not pet.Equipped and pet.Variant == "Normal" and Rarities.Rank(def.Rarity) <= 2 then
				table.insert(uids, pet.Uid)
			end
		end
		if #uids == 0 then
			UIController.Notify("لا يوجد حيوانات عادية للحذف", UIKit.Colors.Muted)
			return
		end
		local res = Remotes.Function("PetAction"):InvokeServer("Delete", { Uids = uids })
		if res.ok then
			UIController.Notify("🗑️ تم حذف " .. #uids .. " حيوان عادي", UIKit.Colors.Red)
		end
	end)

	local grid = UIKit.Scroll(w.Content, { Size = UDim2.new(1, -250, 1, -50), Position = UDim2.fromOffset(0, 50) })
	UIKit.Grid(grid, UDim2.fromOffset(118, 126), 8)

	-- لوحة التفاصيل
	local details = UIKit.Frame({ Size = UDim2.fromOffset(240, 0), Position = UDim2.new(1, -240, 0, 50), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = UIKit.Colors.Panel2, Visible = false, Parent = w.Content })
	UIKit.Corner(details, 14)
	UIKit.Padding(details, 10)
	UIKit.List(details, 8, false, true)
	local dVp = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 150), BackgroundTransparency = 1, Parent = details })
	local dName = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 30), MaxTextSize = 22, Parent = details })
	local dRarity = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 22), MaxTextSize = 18, Parent = details })
	local dPower = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 24), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 20, Parent = details })
	local equipBtn = UIKit.Button({ Text = "تجهيز", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 40), MaxTextSize = 20, Parent = details })
	local lockBtn = UIKit.Button({ Text = "🔒 قفل", Color = UIKit.Colors.Blue, Size = UDim2.new(1, 0, 0, 40), MaxTextSize = 20, Parent = details })
	local deleteBtn = UIKit.Button({ Text = "🗑️ حذف", Color = UIKit.Colors.Red, Size = UDim2.new(1, 0, 0, 40), MaxTextSize = 20, Parent = details })

	local function showDetails(uid: string?)
		selectedUid = uid
		local pet = uid and DataController.FindPet(uid)
		if not pet then
			details.Visible = false
			return
		end
		local def = Pets.Get(pet.Id) :: Pets.PetDef
		details.Visible = true
		for _, c in ipairs(dVp:GetChildren()) do
			c:Destroy()
		end
		PetViewport.Create(dVp, pet.Id, pet.Variant, true)
		dName.Text = PetUtil.DisplayName(pet)
		dRarity.Text = def.Rarity .. " • " .. (Rarities.Info[def.Rarity] and Rarities.Info[def.Rarity].Arabic or "")
		dRarity.TextColor3 = Rarities.Color(def.Rarity)
		dPower.Text = "⚔️ القوة: " .. Format.Number(PetUtil.BasePower(pet))
		equipBtn.Text = pet.Equipped and "إزالة التجهيز" or "تجهيز"
		equipBtn.BackgroundColor3 = pet.Equipped and UIKit.Colors.Panel3 or UIKit.Colors.Green
		lockBtn.Text = pet.Locked and "🔓 فك القفل" or "🔒 قفل"
		deleteBtn.Visible = not pet.Locked
	end

	equipBtn.Activated:Connect(function()
		local pet = selectedUid and DataController.FindPet(selectedUid)
		if pet then
			local res = Remotes.Function("PetAction"):InvokeServer(pet.Equipped and "Unequip" or "Equip", { Uid = pet.Uid })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end
	end)
	lockBtn.Activated:Connect(function()
		if selectedUid then
			Remotes.Function("PetAction"):InvokeServer("Lock", { Uid = selectedUid })
		end
	end)
	deleteBtn.Activated:Connect(function()
		if selectedUid then
			local res = Remotes.Function("PetAction"):InvokeServer("Delete", { Uid = selectedUid })
			if res.ok then
				showDetails(nil)
			elseif res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end
	end)

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local sorted = table.clone(p.Pets)
		PetUtil.SortByPower(sorted)
		local seen = {}
		for i, pet in ipairs(sorted) do
			seen[pet.Uid] = true
			local card = cards[pet.Uid]
			local needsRebuild = card and (card:GetAttribute("Variant") ~= pet.Variant)
			if card and needsRebuild then
				card:Destroy()
				card = nil
				cards[pet.Uid] = nil
			end
			if not card then
				card = InventoryUI.PetCard(grid, pet, function()
					showDetails(pet.Uid)
				end)
				card:SetAttribute("Variant", pet.Variant)
				cards[pet.Uid] = card
			end
			card.LayoutOrder = i
			local badge = card:FindFirstChild("Badge") :: TextLabel
			local lock = card:FindFirstChild("Lock") :: TextLabel
			badge.Text = pet.Equipped and "✅" or ""
			lock.Text = pet.Locked and "🔒" or ""
		end
		for uid, card in pairs(cards) do
			if not seen[uid] then
				card:Destroy()
				cards[uid] = nil
			end
		end
		local equipped = 0
		for _, pet in ipairs(p.Pets) do
			if pet.Equipped then
				equipped += 1
			end
		end
		countLabel.Text = "📦 " .. #p.Pets .. " / " .. (p.StorageCap or 0)
		equipLabel.Text = "مجهز " .. equipped .. " / " .. (p.EquipCap or 0)
		if selectedUid then
			showDetails(selectedUid)
		end
	end

	UIController.Register("Inventory", w, refresh)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Inventory") then
			refresh()
		end
	end)
end

return InventoryUI

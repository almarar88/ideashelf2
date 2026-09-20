--!strict
-- نافذة الحيوانات: الشبكة، الفرز، البحث، التفاصيل (مستوى، خبرة، إنشانتات)، التجهيز، القفل، الحذف
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
local sortMode = "Power"
local search = ""
InventoryUI.OnEnchant = nil :: ((string) -> ())?

function InventoryUI.PetCard(parent: Instance, pet: any, onClick: (() -> ())?): Frame
	local def = Pets.Get(pet.Id)
	local color = def and Rarities.Color(def.Rarity) or Color3.new(1, 1, 1)
	local card = UIKit.Frame({ Name = pet.Uid, BackgroundColor3 = UIKit.Colors.Panel2, Parent = parent })
	UIKit.Corner(card, 12)
	UIKit.Stroke(card, color, 2.5)
	local vpHolder = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 80), BackgroundTransparency = 1, Parent = card })
	PetViewport.Create(vpHolder, pet.Id, pet.Variant)
	UIKit.Label({ Text = PetUtil.DisplayName(pet), Size = UDim2.new(1, -6, 0, 20), Position = UDim2.fromOffset(3, 80), MaxTextSize = 13, Parent = card })
	UIKit.Label({ Text = "⚔️ " .. Format.Number(PetUtil.BasePower(pet)), Size = UDim2.new(1, 0, 0, 18), Position = UDim2.fromOffset(0, 100), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 13, Parent = card })
	UIKit.Label({ Name = "Badge", Text = pet.Equipped and "✅" or "", Size = UDim2.fromOffset(26, 22), Position = UDim2.fromOffset(4, 4), MaxTextSize = 18, Parent = card })
	UIKit.Label({ Name = "Lock", Text = pet.Locked and "🔒" or "", Size = UDim2.fromOffset(26, 22), Position = UDim2.new(1, -30, 0, 4), MaxTextSize = 18, Parent = card })
	UIKit.Label({ Name = "Level", Text = "Lv." .. (pet.Level or 1), Size = UDim2.fromOffset(44, 18), Position = UDim2.new(1, -46, 0, 60), TextColor3 = UIKit.Colors.Cyan, MaxTextSize = 12, Parent = card })
	if pet.Enchants and #pet.Enchants > 0 then
		UIKit.Label({ Name = "Ench", Text = "🔧" .. #pet.Enchants, Size = UDim2.fromOffset(34, 18), Position = UDim2.fromOffset(4, 60), TextColor3 = UIKit.Colors.Green, MaxTextSize = 12, Parent = card })
	end
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

local function sortPets(list: { any })
	if sortMode == "Power" then
		PetUtil.SortByPower(list)
	elseif sortMode == "Rarity" then
		table.sort(list, function(a, b)
			local da, db = Pets.Get(a.Id), Pets.Get(b.Id)
			local ra, rb = da and Rarities.Rank(da.Rarity) or 0, db and Rarities.Rank(db.Rarity) or 0
			if ra ~= rb then
				return ra > rb
			end
			return PetUtil.BasePower(a) > PetUtil.BasePower(b)
		end)
	elseif sortMode == "Level" then
		table.sort(list, function(a, b)
			if (a.Level or 1) ~= (b.Level or 1) then
				return (a.Level or 1) > (b.Level or 1)
			end
			return PetUtil.BasePower(a) > PetUtil.BasePower(b)
		end)
	elseif sortMode == "Newest" then
		table.sort(list, function(a, b)
			return (a.Time or 0) > (b.Time or 0)
		end)
	end
end

function InventoryUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Inventory", "🐾 حيواناتي", UDim2.fromOffset(920, 640), UIKit.Colors.Green)

	local header = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	local countLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(150, 44), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 18, Parent = header })
	local equipLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(120, 44), Position = UDim2.fromOffset(150, 0), TextXAlignment = Enum.TextXAlignment.Left, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = header })
	local searchBox = UIKit.New("TextBox", { Size = UDim2.fromOffset(150, 36), Position = UDim2.fromOffset(276, 4), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = "🔍 بحث", Text = "", Font = UIKit.Font, TextColor3 = UIKit.Colors.Text, TextSize = 16, ClearTextOnFocus = false, Parent = header }) :: TextBox
	UIKit.Corner(searchBox, 8)
	local sortBtn = UIKit.Button({ Text = "⇅ القوة", Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(110, 36), Position = UDim2.fromOffset(432, 4), MaxTextSize = 15, Parent = header })
	UIKit.Button({ Text = "⭐ الأفضل", Color = UIKit.Colors.Gold, Size = UDim2.fromOffset(110, 36), Position = UDim2.new(1, -350, 0, 4), MaxTextSize = 15, Parent = header }, function()
		Remotes.Function("PetAction"):InvokeServer("EquipBest", {})
	end)
	UIKit.Button({ Text = "إزالة الكل", Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(110, 36), Position = UDim2.new(1, -234, 0, 4), MaxTextSize = 15, Parent = header }, function()
		Remotes.Function("PetAction"):InvokeServer("UnequipAll", {})
	end)
	UIKit.Button({ Text = "🗑️ عاديات", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(110, 36), Position = UDim2.new(1, -118, 0, 4), MaxTextSize = 15, Parent = header }, function()
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

	local grid = UIKit.Scroll(w.Content, { Size = UDim2.new(1, -270, 1, -50), Position = UDim2.fromOffset(0, 50) })
	UIKit.Grid(grid, UDim2.fromOffset(112, 122), 8)

	-- لوحة التفاصيل
	local details = UIKit.Frame({ Size = UDim2.fromOffset(260, 0), Position = UDim2.new(1, -260, 0, 50), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = UIKit.Colors.Panel2, Visible = false, Parent = w.Content })
	UIKit.Corner(details, 14)
	UIKit.Padding(details, 10)
	UIKit.List(details, 6, false, true)
	local dVp = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 130), BackgroundTransparency = 1, Parent = details })
	local dName = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 28), MaxTextSize = 20, Parent = details })
	local dRarity = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 20), MaxTextSize = 16, Parent = details })
	local dPower = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 22), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 18, Parent = details })
	local dLevel = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 18), TextColor3 = UIKit.Colors.Cyan, MaxTextSize = 15, Parent = details })
	local _, xpFill, xpLabel = UIKit.ProgressBar(details, UIKit.Colors.Cyan, UDim2.new(1, 0, 0, 14))
	local dEnch = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 60), TextColor3 = UIKit.Colors.Green, TextYAlignment = Enum.TextYAlignment.Top, MaxTextSize = 14, Parent = details })
	local equipBtn = UIKit.Button({ Text = "تجهيز", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 38), MaxTextSize = 18, Parent = details })
	local enchantBtn = UIKit.Button({ Text = "🔧 إنشانت", Color = UIKit.Colors.Purple, Size = UDim2.new(1, 0, 0, 38), MaxTextSize = 18, Parent = details })
	local lockBtn = UIKit.Button({ Text = "🔒 قفل", Color = UIKit.Colors.Blue, Size = UDim2.new(1, 0, 0, 38), MaxTextSize = 18, Parent = details })
	local deleteBtn = UIKit.Button({ Text = "🗑️ حذف", Color = UIKit.Colors.Red, Size = UDim2.new(1, 0, 0, 38), MaxTextSize = 18, Parent = details })

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
		local level = pet.Level or 1
		dLevel.Text = "المستوى " .. level .. " / 50   (+" .. math.floor((level - 1) * 2) .. "% قوة)"
		local needed = PetUtil.XPToNext(level)
		if level >= 50 then
			xpFill.Size = UDim2.fromScale(1, 1)
			xpLabel.Text = "MAX"
		else
			xpFill.Size = UDim2.fromScale(math.clamp((pet.XP or 0) / needed, 0, 1), 1)
			xpLabel.Text = Format.Number(pet.XP or 0) .. " / " .. Format.Number(needed) .. " XP"
		end
		local lines = {}
		local slots = PetUtil.EnchantSlots(pet)
		for i = 1, slots do
			local e = pet.Enchants and pet.Enchants[i]
			table.insert(lines, e and PetUtil.EnchantLabel(e) or ("خانة " .. i .. ": فارغة"))
		end
		dEnch.Text = table.concat(lines, "\n")
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
	enchantBtn.Activated:Connect(function()
		if selectedUid and InventoryUI.OnEnchant then
			InventoryUI.OnEnchant(selectedUid)
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
		sortPets(sorted)
		local seen = {}
		local q = string.lower(search)
		for i, pet in ipairs(sorted) do
			local name = string.lower(PetUtil.DisplayName(pet))
			local visible = q == "" or name:find(q, 1, true) ~= nil
			seen[pet.Uid] = true
			local card = cards[pet.Uid]
			local sig = pet.Variant .. "|" .. (pet.Level or 1) .. "|" .. (pet.Enchants and #pet.Enchants or 0)
			if card and card:GetAttribute("Sig") ~= sig then
				card:Destroy()
				card = nil
				cards[pet.Uid] = nil
			end
			if not card then
				card = InventoryUI.PetCard(grid, pet, function()
					showDetails(pet.Uid)
				end)
				card:SetAttribute("Sig", sig)
				cards[pet.Uid] = card
			end
			card.LayoutOrder = i
			card.Visible = visible
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

	local MODES = { "Power", "Rarity", "Level", "Newest" }
	local LABELS = { Power = "⇅ القوة", Rarity = "⇅ الندرة", Level = "⇅ المستوى", Newest = "⇅ الأحدث" }
	sortBtn.Activated:Connect(function()
		local idx = table.find(MODES, sortMode) or 1
		sortMode = MODES[idx % #MODES + 1]
		sortBtn.Text = LABELS[sortMode]
		refresh()
	end)
	searchBox:GetPropertyChangedSignal("Text"):Connect(function()
		search = searchBox.Text
		refresh()
	end)

	UIController.Register("Inventory", w, refresh)
end

return InventoryUI

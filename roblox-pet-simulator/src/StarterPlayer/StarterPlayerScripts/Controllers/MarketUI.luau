--!strict
-- السوق العالمي: تصفح، عروضي، بيع، متجر الحيوانات (بيع للتاجر) + الأكشاك
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local ProximityPromptService = game:GetService("ProximityPromptService")
local Workspace = game:GetService("Workspace")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Rarities = require(Shared.Data.Rarities)
local PetUtil = require(Shared.Modules.PetUtil)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local InventoryUI = require(script.Parent.InventoryUI)
local MachineUI = require(script.Parent.MachineUI)
local PetViewport = require(script.Parent.PetViewport)

local MarketUI = {}

local pages: { [string]: ScrollingFrame } = {}
local tabButtons: { [string]: TextButton } = {}
local currentTab = "Browse"
local sellerFilter: number? = nil
local browseSort = "Newest"
local browseSearch = ""
local sellUid: string? = nil
local npcSelected: { [string]: boolean } = {}
local cachedListings: { any } = {}
local renderExchange: () -> () = function() end

local function npcValue(pet: any): number
	local def = Pets.Get(pet.Id)
	if not def then
		return 0
	end
	return math.floor((Config.Market.NPCValue[def.Rarity] or 1) * (Config.VariantMultipliers[pet.Variant] or 1) * (1 + (pet.Level or 1) / 50))
end

local function clear(parent: Instance)
	for _, c in ipairs(parent:GetChildren()) do
		if c:IsA("Frame") or c:IsA("TextLabel") or c:IsA("TextButton") or c:IsA("TextBox") then
			c:Destroy()
		end
	end
end

local function showTab(name: string)
	currentTab = name
	for n, page in pairs(pages) do
		page.Visible = n == name
		tabButtons[n].BackgroundColor3 = n == name and Color3.fromRGB(255, 140, 60) or UIKit.Colors.Panel3
	end
end

-- ===== تصفح =====
local browseHeader: Frame
local function renderBrowse()
	local page = pages.Browse
	clear(page)
	local p = DataController.Profile
	local list = table.clone(cachedListings)
	local q = string.lower(browseSearch)
	if q ~= "" then
		local filtered = {}
		for _, l in ipairs(list) do
			if string.lower(l.Name or ""):find(q, 1, true) or string.lower(l.SellerName or ""):find(q, 1, true) then
				table.insert(filtered, l)
			end
		end
		list = filtered
	end
	if browseSort == "Newest" then
		table.sort(list, function(a, b)
			return (a.Time or 0) > (b.Time or 0)
		end)
	elseif browseSort == "Cheapest" then
		table.sort(list, function(a, b)
			return a.Price < b.Price
		end)
	elseif browseSort == "Power" then
		table.sort(list, function(a, b)
			return (a.Power or 0) > (b.Power or 0)
		end)
	elseif browseSort == "Rarity" then
		table.sort(list, function(a, b)
			return Rarities.Rank(a.Rarity or "Common") > Rarities.Rank(b.Rarity or "Common")
		end)
	end
	if #list == 0 then
		UIKit.Label({ Text = sellerFilter and "هذا الكشك لا يعرض شيئاً حالياً" or "لا توجد عروض حالياً. كن أول بائع!", Size = UDim2.new(1, 0, 0, 60), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 20, Parent = page })
		return
	end
	for i, l in ipairs(list) do
		local card = UIKit.Frame({ LayoutOrder = i, BackgroundColor3 = UIKit.Colors.Panel2, Parent = page })
		UIKit.Corner(card, 12)
		UIKit.Stroke(card, Rarities.Color(l.Rarity or "Common"), 2)
		local vp = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 90), BackgroundTransparency = 1, Parent = card })
		PetViewport.Create(vp, l.PetId, l.Variant)
		UIKit.Label({ Text = l.Name, Size = UDim2.new(1, -6, 0, 22), Position = UDim2.fromOffset(3, 90), MaxTextSize = 14, Parent = card })
		UIKit.Label({ Text = "⚔️ " .. Format.Number(l.Power or 0) .. "  Lv." .. (l.Level or 1), Size = UDim2.new(1, -6, 0, 18), Position = UDim2.fromOffset(3, 112), TextColor3 = UIKit.Colors.Pink, MaxTextSize = 13, Parent = card })
		UIKit.Label({ Text = "👤 " .. (l.SellerName or "?"), Size = UDim2.new(1, -6, 0, 18), Position = UDim2.fromOffset(3, 130), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 12, Parent = card })
		local mine = p and l.Seller == Players.LocalPlayer.UserId
		UIKit.Button({ Text = mine and "عرضك" or ("💠 " .. Format.Number(l.Price)), Color = mine and UIKit.Colors.Panel3 or ((p and p.Gems >= l.Price) and UIKit.Colors.Green or UIKit.Colors.Panel3), Size = UDim2.new(1, -12, 0, 34), Position = UDim2.new(0, 6, 1, -40), MaxTextSize = 16, Parent = card }, function()
			if mine then
				return
			end
			local res = Remotes.Function("Market"):InvokeServer("Buy", { Id = l.Id })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
			MarketUI.Refresh(true)
		end)
	end
end

local function fetchBrowse(force: boolean?)
	local res = Remotes.Function("Market"):InvokeServer("Browse", { Force = force == true, Seller = sellerFilter })
	if res.ok then
		cachedListings = res.listings or {}
	end
	renderBrowse()
end

-- ===== عروضي =====
local function renderMine()
	local page = pages.Mine
	clear(page)
	local p = DataController.Profile
	if not p then
		return
	end
	local now = DataController.ServerTime()
	local count = 0
	for id, l in pairs(p.MyListings or {}) do
		count += 1
		local card = UIKit.Frame({ LayoutOrder = count, BackgroundColor3 = UIKit.Colors.Panel2, Parent = page })
		UIKit.Corner(card, 12)
		UIKit.Stroke(card, UIKit.Colors.Gold, 2)
		local vp = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 90), BackgroundTransparency = 1, Parent = card })
		PetViewport.Create(vp, l.PetId, l.Variant)
		UIKit.Label({ Text = l.Name, Size = UDim2.new(1, -6, 0, 22), Position = UDim2.fromOffset(3, 90), MaxTextSize = 14, Parent = card })
		UIKit.Label({ Text = "💠 " .. Format.Number(l.Price), Size = UDim2.new(1, -6, 0, 18), Position = UDim2.fromOffset(3, 112), TextColor3 = Color3.fromRGB(200, 140, 255), MaxTextSize = 14, Parent = card })
		UIKit.Label({ Text = "⏳ " .. Format.Time(math.max(0, (l.Expires or now) - now)), Size = UDim2.new(1, -6, 0, 18), Position = UDim2.fromOffset(3, 130), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 12, Parent = card })
		UIKit.Button({ Text = "إلغاء العرض", Color = UIKit.Colors.Red, Size = UDim2.new(1, -12, 0, 34), Position = UDim2.new(0, 6, 1, -40), MaxTextSize = 15, Parent = card }, function()
			local res = Remotes.Function("Market"):InvokeServer("Cancel", { Id = id })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
	end
	if count == 0 then
		UIKit.Label({ Text = "ليس لديك عروض. اذهب لتبويب بيع لعرض حيوان.\nالرسوم: " .. Config.Market.FeePercent .. "%  •  الحد: " .. Config.Market.MaxListings .. " عروض  •  المدة: 3 أيام", Size = UDim2.new(1, 0, 0, 70), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = page })
	end
end

-- ===== بيع =====
local sellPanel: Frame
local priceBox: TextBox
local sellInfo: TextLabel
local function renderSell()
	local page = pages.Sell
	clear(page)
	local p = DataController.Profile
	if not p then
		return
	end
	local sorted = table.clone(p.Pets)
	PetUtil.SortByPower(sorted)
	for i, pet in ipairs(sorted) do
		if not pet.Locked then
			local card = InventoryUI.PetCard(page, pet, function()
				sellUid = pet.Uid
				renderSell()
			end)
			card.LayoutOrder = i
			if sellUid == pet.Uid then
				local stroke = card:FindFirstChildOfClass("UIStroke")
				if stroke then
					stroke.Color = UIKit.Colors.Green
					stroke.Thickness = 4
				end
			end
		end
	end
	local pet = sellUid and DataController.FindPet(sellUid)
	sellInfo.Text = pet and ("المختار: " .. PetUtil.DisplayName(pet) .. "  ⚔️ " .. Format.Number(PetUtil.BasePower(pet)) .. "\nقيمة التاجر: 💠 " .. npcValue(pet) .. "  •  الرسوم " .. Config.Market.FeePercent .. "%") or "اختر حيواناً من القائمة ثم حدد السعر"
end

-- ===== متجر الحيوانات (بيع للتاجر) =====
local npcInfo: TextLabel
local function renderNPC()
	local page = pages.NPC
	clear(page)
	local p = DataController.Profile
	if not p then
		return
	end
	local sorted = table.clone(p.Pets)
	PetUtil.SortByPower(sorted)
	local total = 0
	local n = 0
	for i, pet in ipairs(sorted) do
		if not pet.Locked then
			local card = InventoryUI.PetCard(page, pet, function()
				npcSelected[pet.Uid] = not npcSelected[pet.Uid] or nil
				renderNPC()
			end)
			card.LayoutOrder = i
			local lvl = card:FindFirstChild("Level") :: TextLabel
			lvl.Text = "💠" .. npcValue(pet)
			if npcSelected[pet.Uid] then
				total += npcValue(pet)
				n += 1
				local stroke = card:FindFirstChildOfClass("UIStroke")
				if stroke then
					stroke.Color = UIKit.Colors.Green
					stroke.Thickness = 4
				end
				local badge = card:FindFirstChild("Badge") :: TextLabel
				badge.Text = "☑️"
			end
		end
	end
	npcInfo.Text = "المختار: " .. n .. "  •  الإجمالي: 💠 " .. Format.Number(total)
end

function MarketUI.Refresh(force: boolean?)
	if currentTab == "Browse" then
		fetchBrowse(force)
	elseif currentTab == "Mine" then
		renderMine()
	elseif currentTab == "Sell" then
		renderSell()
	elseif currentTab == "NPC" then
		renderNPC()
	elseif currentTab == "Exchange" then
		renderExchange()
	end
end

function MarketUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Market", "🏪 السوق العالمي", UDim2.fromOffset(940, 640), Color3.fromRGB(255, 140, 60))

	local tabs = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 44), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.List(tabs, 6, true, true)
	for _, info in ipairs({ { "Browse", "🔎 تصفح" }, { "Mine", "📦 عروضي" }, { "Sell", "💠 بيع في السوق" }, { "NPC", "🐾 بيع للتاجر" }, { "Exchange", "🏦 صرّاف" } }) do
		tabButtons[info[1]] = UIKit.Button({ Text = info[2], Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(165, 40), MaxTextSize = 16, Parent = tabs }, function()
			sellerFilter = nil
			showTab(info[1])
			MarketUI.Refresh()
		end)
	end

	-- تصفح: شريط أدوات
	browseHeader = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 50), BackgroundTransparency = 1, Parent = w.Content })
	local searchBox = UIKit.New("TextBox", { Size = UDim2.fromOffset(220, 36), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = "🔍 بحث بالاسم أو البائع", Text = "", Font = UIKit.Font, TextColor3 = UIKit.Colors.Text, TextSize = 16, ClearTextOnFocus = false, Parent = browseHeader }) :: TextBox
	UIKit.Corner(searchBox, 8)
	searchBox:GetPropertyChangedSignal("Text"):Connect(function()
		browseSearch = searchBox.Text
		if currentTab == "Browse" then
			renderBrowse()
		end
	end)
	local SORTS = { "Newest", "Cheapest", "Power", "Rarity" }
	local SORT_LABELS = { Newest = "⇅ الأحدث", Cheapest = "⇅ الأرخص", Power = "⇅ القوة", Rarity = "⇅ الندرة" }
	local sortBtn = UIKit.Button({ Text = SORT_LABELS.Newest, Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(130, 36), Position = UDim2.fromOffset(230, 0), MaxTextSize = 15, Parent = browseHeader })
	sortBtn.Activated:Connect(function()
		local idx = table.find(SORTS, browseSort) or 1
		browseSort = SORTS[idx % #SORTS + 1]
		sortBtn.Text = SORT_LABELS[browseSort]
		renderBrowse()
	end)
	UIKit.Button({ Text = "🔄 تحديث", Color = UIKit.Colors.Blue, Size = UDim2.fromOffset(120, 36), Position = UDim2.fromOffset(370, 0), MaxTextSize = 15, Parent = browseHeader }, function()
		fetchBrowse(true)
	end)
	local filterLabel = UIKit.Label({ Text = "", Size = UDim2.fromOffset(300, 36), Position = UDim2.new(1, -300, 0, 0), TextXAlignment = Enum.TextXAlignment.Right, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 15, Parent = browseHeader })

	for _, name in ipairs({ "Browse", "Mine", "Sell", "NPC", "Exchange" }) do
		local top = (name == "Browse" or name == "Sell" or name == "NPC") and 96 or 52
		pages[name] = UIKit.Scroll(w.Content, { Size = UDim2.new(1, name == "Sell" and -280 or 0, 1, -top), Position = UDim2.fromOffset(0, top), Visible = false })
		UIKit.Grid(pages[name], UDim2.fromOffset(150, 190), 8)
	end
	UIKit.Grid(pages.Sell, UDim2.fromOffset(112, 122), 8)
	UIKit.Grid(pages.NPC, UDim2.fromOffset(112, 122), 8)

	-- بيع: لوحة جانبية
	sellPanel = UIKit.Frame({ Size = UDim2.fromOffset(270, 0), Position = UDim2.new(1, -270, 0, 96), AutomaticSize = Enum.AutomaticSize.Y, BackgroundColor3 = UIKit.Colors.Panel2, Visible = false, Parent = w.Content })
	UIKit.Corner(sellPanel, 14)
	UIKit.Padding(sellPanel, 10)
	UIKit.List(sellPanel, 8)
	sellInfo = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 70), MaxTextSize = 15, TextYAlignment = Enum.TextYAlignment.Top, Parent = sellPanel })
	priceBox = UIKit.New("TextBox", { Size = UDim2.new(1, 0, 0, 40), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = "💠 السعر", Text = "", Font = UIKit.Font, TextColor3 = UIKit.Colors.Text, TextSize = 20, ClearTextOnFocus = false, Parent = sellPanel }) :: TextBox
	UIKit.Corner(priceBox, 8)
	UIKit.Button({ Text = "🏪 عرض للبيع", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 42), MaxTextSize = 18, Parent = sellPanel }, function()
		if not sellUid then
			UIController.Notify("اختر حيواناً أولاً", UIKit.Colors.Red)
			return
		end
		local res = Remotes.Function("Market"):InvokeServer("List", { Uid = sellUid, Price = tonumber(priceBox.Text) or 0 })
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		else
			sellUid = nil
			priceBox.Text = ""
		end
	end)
	UIKit.Label({ Text = "💡 العروض تظهر لكل السيرفرات لمدة 3 أيام. احجز كشكاً في السوق ليجدك اللاعبون بسهولة.", Size = UDim2.new(1, 0, 0, 70), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 13, TextYAlignment = Enum.TextYAlignment.Top, Parent = sellPanel })

	-- الصرّاف
	local exPanel = UIKit.Frame({ Size = UDim2.fromOffset(460, 300), Position = UDim2.new(0.5, -230, 0, 110), BackgroundColor3 = UIKit.Colors.Panel2, Visible = false, Parent = w.Content })
	UIKit.Corner(exPanel, 14)
	UIKit.Padding(exPanel, 14)
	UIKit.List(exPanel, 10)
	UIKit.Label({ Text = "🏦 الصرّاف: اشترِ جواهر بالعملات", Size = UDim2.new(1, 0, 0, 34), MaxTextSize = 22, Parent = exPanel })
	local exInfo = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 70), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 15, TextYAlignment = Enum.TextYAlignment.Top, Parent = exPanel })
	local exBox = UIKit.New("TextBox", { Size = UDim2.new(1, 0, 0, 40), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = "عدد الجواهر", Text = "", Font = UIKit.Font, TextColor3 = UIKit.Colors.Text, TextSize = 20, ClearTextOnFocus = false, Parent = exPanel }) :: TextBox
	UIKit.Corner(exBox, 8)
	local exTotal = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 28), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 18, Parent = exPanel })
	exBox:GetPropertyChangedSignal("Text"):Connect(function()
		local p = DataController.Profile
		local n = tonumber(exBox.Text) or 0
		exTotal.Text = p and ("الإجمالي: 💰 " .. Format.Number(n * (p.GemPrice or 0))) or ""
	end)
	UIKit.Button({ Text = "💠 شراء", Color = UIKit.Colors.Green, Size = UDim2.new(1, 0, 0, 44), MaxTextSize = 20, Parent = exPanel }, function()
		local res = Remotes.Function("Market"):InvokeServer("Exchange", { Amount = tonumber(exBox.Text) or 0 })
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		else
			exBox.Text = ""
		end
	end)
	renderExchange = function()
		local p = DataController.Profile
		if not p then
			return
		end
		local day = math.floor(DataController.ServerTime() / 86400)
		local used = (p.GemExchange and p.GemExchange.Day == day) and p.GemExchange.Count or 0
		exInfo.Text = "السعر الحالي: 💰 " .. Format.Number(p.GemPrice or 0) .. " لكل جوهرة (يرتفع مع أعلى منطقة فتحتها)\nالسقف اليومي: " .. used .. " / " .. Config.GemExchange.DailyCap .. "\nالجواهر أندر من العملات: مصادرها الصناديق في السوق، قدرة \"باحث الجواهر\"، الزعماء، الزنزانة، وبيع الحيوانات."
	end

	-- التاجر: شريط
	local npcBar = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 40), Position = UDim2.fromOffset(0, 50), BackgroundTransparency = 1, Visible = false, Parent = w.Content })
	npcInfo = UIKit.Label({ Text = "", Size = UDim2.fromOffset(360, 40), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 17, Parent = npcBar })
	UIKit.Button({ Text = "بيع المختار 💠", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(170, 36), Position = UDim2.new(1, -350, 0, 2), MaxTextSize = 16, Parent = npcBar }, function()
		local uids = {}
		for uid in pairs(npcSelected) do
			table.insert(uids, uid)
		end
		if #uids == 0 then
			UIController.Notify("اختر حيوانات للبيع", UIKit.Colors.Red)
			return
		end
		local res = Remotes.Function("Market"):InvokeServer("SellNPC", { Uids = uids })
		if not res.ok and res.error then
			UIController.Notify(res.error, UIKit.Colors.Red)
		end
		npcSelected = {}
	end)
	UIKit.Button({ Text = "اختيار كل العاديات", Color = UIKit.Colors.Panel3, Size = UDim2.fromOffset(170, 36), Position = UDim2.new(1, -170, 0, 2), MaxTextSize = 15, Parent = npcBar }, function()
		local p = DataController.Profile
		if not p then
			return
		end
		for _, pet in ipairs(p.Pets) do
			local def = Pets.Get(pet.Id)
			if def and not pet.Locked and not pet.Equipped and pet.Variant == "Normal" and Rarities.Rank(def.Rarity) <= 2 then
				npcSelected[pet.Uid] = true
			end
		end
		renderNPC()
	end)

	local function refresh()
		browseHeader.Visible = currentTab == "Browse"
		sellPanel.Visible = currentTab == "Sell"
		npcBar.Visible = currentTab == "NPC"
		exPanel.Visible = currentTab == "Exchange"
		filterLabel.Text = sellerFilter and "عرض كشك بائع محدد" or ""
		MarketUI.Refresh()
	end
	local baseShow = showTab
	showTab = function(name: string)
		baseShow(name)
		browseHeader.Visible = name == "Browse"
		sellPanel.Visible = name == "Sell"
		npcBar.Visible = name == "NPC"
		exPanel.Visible = name == "Exchange"
		filterLabel.Text = sellerFilter and "عرض كشك بائع محدد" or ""
	end
	showTab("Browse")
	UIController.Register("Market", w, refresh)
	MachineUI.OnPetShop = function()
		showTab("NPC")
		renderNPC()
	end

	-- الأكشاك: الحجز والفتح + اللافتات
	ProximityPromptService.PromptTriggered:Connect(function(prompt)
		local model = prompt:FindFirstAncestorOfClass("Model")
		local boothId = model and model:GetAttribute("BoothId")
		if type(boothId) ~= "number" then
			return
		end
		local owner = model:GetAttribute("Owner")
		if owner == 0 then
			local res = Remotes.Function("Market"):InvokeServer("Booth", { BoothId = boothId })
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		elseif owner == Players.LocalPlayer.UserId then
			sellerFilter = nil
			showTab("Sell")
			UIController.Open("Market")
		else
			sellerFilter = owner
			showTab("Browse")
			UIController.Open("Market")
		end
	end)
	task.spawn(function()
		local map = Workspace:WaitForChild("Map")
		local marketFolder = map:WaitForChild("Zone_Market", 30)
		if not marketFolder then
			return
		end
		local function hook(booth: Instance)
			if not booth:IsA("Model") or booth:GetAttribute("BoothId") == nil then
				return
			end
			local sign = booth:FindFirstChild("BoothSign", true) :: BillboardGui?
			local label = sign and sign:FindFirstChildOfClass("TextLabel")
			local function update()
				if not label then
					return
				end
				local name = booth:GetAttribute("OwnerName")
				local n = booth:GetAttribute("Listings") or 0
				if type(name) == "string" and name ~= "" then
					label.Text = "🏪 " .. name .. "\n" .. n .. " عروض"
					label.TextColor3 = UIKit.Colors.Gold
				else
					label.Text = "كشك فارغ\nاضغط للحجز"
					label.TextColor3 = Color3.new(1, 1, 1)
				end
			end
			booth:GetAttributeChangedSignal("OwnerName"):Connect(update)
			booth:GetAttributeChangedSignal("Listings"):Connect(update)
			update()
		end
		for _, b in ipairs(marketFolder:GetChildren()) do
			hook(b)
		end
		marketFolder.ChildAdded:Connect(hook)
	end)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("Market") and currentTab ~= "Browse" then
			MarketUI.Refresh()
		end
	end)
end

return MarketUI

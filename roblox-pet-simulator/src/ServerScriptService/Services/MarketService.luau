--!strict
-- السوق العالمي: عروض بيع عبر السيرفرات (MemoryStore) + صندوق بريد للبائع (DataStore) + أكشاك + بيع للتاجر
local Players = game:GetService("Players")
local MemoryStoreService = game:GetService("MemoryStoreService")
local DataStoreService = game:GetService("DataStoreService")
local HttpService = game:GetService("HttpService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local PetUtil = require(Shared.Modules.PetUtil)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local PetService = require(script.Parent.PetService)
local MapBuilder = require(script.Parent.MapBuilder)
local RateLimit = require(script.Parent.RateLimit)
local Hooks = require(script.Parent.Hooks)

local MarketService = {}

local listings = MemoryStoreService:GetSortedMap("PetKingdom_Market_v1")
local mailbox = DataStoreService:GetDataStore("PetKingdom_Mailbox_v1")
local TTL = Config.Market.ListingTTL

local cache: { any } = {}
local cacheTime = 0
local booths: { [number]: Player } = {}
local boothOf: { [Player]: number } = {}

local function fail(msg: string)
	return { ok = false, error = msg }
end

-- ===== قراءة العروض (مع كاش) =====
local function fetchAll(force: boolean?): { any }
	if not force and os.clock() - cacheTime < Config.Market.CacheSeconds then
		return cache
	end
	local ok, res = pcall(function()
		return listings:GetRangeAsync(Enum.SortDirection.Descending, 200)
	end)
	if ok and type(res) == "table" then
		local out = {}
		for _, item in ipairs(res) do
			local v = item.value
			if type(v) == "table" and not v.Buyer then
				v.Id = item.key
				table.insert(out, v)
			end
		end
		cache = out
		cacheTime = os.clock()
	end
	return cache
end

local function updateBoothAttr(player: Player)
	local idx = boothOf[player]
	if not idx then
		return
	end
	local p = DataService.Get(player)
	local n = 0
	if p then
		for _ in pairs(p.MyListings) do
			n += 1
		end
	end
	local booth = MapBuilder.Booths[idx]
	if booth then
		booth:SetAttribute("Listings", n)
	end
end

-- ===== صندوق البريد =====
local function pushMail(userId: number, entry: any)
	pcall(function()
		mailbox:UpdateAsync("m_" .. userId, function(old)
			old = type(old) == "table" and old or {}
			table.insert(old, entry)
			return old
		end)
	end)
end

local function reconcile(player: Player)
	local p = DataService.Get(player)
	if not p then
		return
	end
	local mailKey = "m_" .. player.UserId
	local ok, mail = pcall(mailbox.GetAsync, mailbox, mailKey)
	local processed = {}
	if ok and type(mail) == "table" then
		for _, entry in ipairs(mail) do
			if entry.Type == "Sold" then
				local listing = p.MyListings[entry.ListingId]
				if listing then
					DataService.AddGems(player, entry.Gems or 0, true)
					p.Stats.MarketSales += 1
					p.MyListings[entry.ListingId] = nil
					DataService.Notify(player, "💠 بيع " .. (listing.Name or "حيوانك") .. " مقابل " .. (entry.Gems or 0) .. " جوهرة!", Color3.fromRGB(180, 120, 255))
					Hooks.Fire(player, "MarketSale", 1)
				end
				table.insert(processed, entry.ListingId)
			end
		end
		if #processed > 0 then
			pcall(function()
				mailbox:UpdateAsync(mailKey, function(old)
					old = type(old) == "table" and old or {}
					local keep = {}
					for _, e in ipairs(old) do
						if not table.find(processed, e.ListingId) then
							table.insert(keep, e)
						end
					end
					return keep
				end)
			end)
		end
	end
	-- العروض المنتهية: إعادة الحيوان
	local now = os.time()
	for id, listing in pairs(p.MyListings) do
		if listing.Expires and now > listing.Expires + 60 then
			local okGet, value = pcall(listings.GetAsync, listings, id)
			if okGet then
				if value == nil then
					-- انتهى بدون بيع → إعادة الحيوان
					if PetService.FreeSlots(player) > 0 then
						table.insert(p.Pets, listing.Pet)
						p.MyListings[id] = nil
						DataService.Notify(player, "⏳ انتهى عرض " .. (listing.Name or "") .. " وعاد الحيوان لمخزنك", Color3.fromRGB(255, 200, 80))
					end
				elseif type(value) == "table" and value.Buyer and value.Buyer > 0 then
					DataService.AddGems(player, math.floor((value.Price or 0) * (100 - Config.Market.FeePercent) / 100), true)
					p.MyListings[id] = nil
					pcall(listings.RemoveAsync, listings, id)
				end
			end
		end
	end
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	updateBoothAttr(player)
end

-- ===== الإجراءات =====
local function list(player: Player, payload: any)
	local p = DataService.Get(player) :: DataService.Profile
	local uid = tostring(payload.Uid)
	local price = math.floor(tonumber(payload.Price) or 0)
	if price < Config.Market.MinPrice or price > Config.Market.MaxPrice then
		return fail("السعر يجب أن يكون بين " .. Config.Market.MinPrice .. " و " .. Config.Market.MaxPrice)
	end
	local count = 0
	for _ in pairs(p.MyListings) do
		count += 1
	end
	if count >= Config.Market.MaxListings then
		return fail("الحد الأقصى " .. Config.Market.MaxListings .. " عروض")
	end
	local pet = PetService.Find(p, uid)
	if not pet or pet.Locked then
		return fail("الحيوان غير موجود أو مقفول")
	end
	local def = Pets.Get(pet.Id) :: Pets.PetDef
	local id = HttpService:GenerateGUID(false)
	local snapshot = table.clone(pet)
	snapshot.Equipped = false
	snapshot.Locked = false
	local value = {
		Seller = player.UserId,
		SellerName = player.DisplayName,
		Pet = snapshot,
		Name = PetUtil.DisplayName(pet),
		PetId = pet.Id,
		Variant = pet.Variant,
		Level = pet.Level or 1,
		Rarity = def.Rarity,
		Power = PetUtil.BasePower(pet),
		Price = price,
		Time = os.time(),
	}
	PetService.Remove(p, uid)
	local ok = pcall(listings.SetAsync, listings, id, value, TTL)
	if not ok then
		table.insert(p.Pets, pet)
		return fail("تعذر الاتصال بالسوق، حاول لاحقاً")
	end
	p.MyListings[id] = { Pet = snapshot, Name = value.Name, Price = price, Expires = os.time() + TTL, PetId = pet.Id, Variant = pet.Variant }
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	updateBoothAttr(player)
	cacheTime = 0
	DataService.Notify(player, "🏪 تم عرض " .. value.Name .. " بسعر 💠 " .. price, Color3.fromRGB(120, 255, 140))
	return { ok = true }
end

local function buy(player: Player, payload: any)
	local p = DataService.Get(player) :: DataService.Profile
	local id = tostring(payload.Id)
	local okGet, value = pcall(listings.GetAsync, listings, id)
	if not okGet or type(value) ~= "table" then
		cacheTime = 0
		return fail("العرض لم يعد متاحاً")
	end
	if value.Seller == player.UserId then
		return fail("لا يمكنك شراء عرضك")
	end
	if value.Buyer then
		return fail("تم بيعه للتو")
	end
	if p.Gems < value.Price then
		return fail("تحتاج 💠 " .. value.Price)
	end
	if PetService.FreeSlots(player) <= 0 then
		return fail("المخزن ممتلئ")
	end
	local okClaim, claimed = pcall(function()
		return listings:UpdateAsync(id, function(old)
			if type(old) ~= "table" or old.Buyer then
				return nil
			end
			old.Buyer = player.UserId
			return old
		end, TTL)
	end)
	if not okClaim or claimed == nil then
		cacheTime = 0
		return fail("تم بيعه للتو")
	end
	if not DataService.Spend(player, "Gems", value.Price) then
		return fail("تحتاج 💠 " .. value.Price)
	end
	local pet = table.clone(value.Pet)
	pet.Uid = HttpService:GenerateGUID(false)
	pet.Equipped = false
	pet.Locked = false
	pet.Enchants = pet.Enchants or {}
	pet.Level = pet.Level or 1
	pet.XP = pet.XP or 0
	table.insert(p.Pets, pet)
	p.Index[pet.Id] = true
	pcall(listings.RemoveAsync, listings, id)
	cacheTime = 0
	local payout = math.floor(value.Price * (100 - Config.Market.FeePercent) / 100)
	local seller = Players:GetPlayerByUserId(value.Seller)
	if seller and DataService.Get(seller) then
		local sp = DataService.Get(seller) :: DataService.Profile
		DataService.AddGems(seller, payout, true)
		sp.Stats.MarketSales += 1
		sp.MyListings[id] = nil
		DataService.MarkDirty(seller)
		updateBoothAttr(seller)
		DataService.Notify(seller, "💠 " .. player.DisplayName .. " اشترى " .. value.Name .. " مقابل " .. payout .. " جوهرة!", Color3.fromRGB(180, 120, 255))
		Hooks.Fire(seller, "MarketSale", 1)
	else
		pushMail(value.Seller, { Type = "Sold", ListingId = id, Gems = payout, Buyer = player.DisplayName })
	end
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	DataService.Notify(player, "🎉 اشتريت " .. value.Name .. "!", Color3.fromRGB(120, 255, 140))
	Remotes.Event("EventEffect"):FireClient(player, { Type = "Purchase" })
	return { ok = true }
end

local function cancel(player: Player, payload: any)
	local p = DataService.Get(player) :: DataService.Profile
	local id = tostring(payload.Id)
	local listing = p.MyListings[id]
	if not listing then
		return fail("العرض غير موجود")
	end
	if PetService.FreeSlots(player) <= 0 then
		return fail("المخزن ممتلئ")
	end
	local okClaim, claimed = pcall(function()
		return listings:UpdateAsync(id, function(old)
			if type(old) ~= "table" or old.Buyer then
				return nil
			end
			old.Buyer = -1
			return old
		end, 60)
	end)
	if okClaim and claimed ~= nil then
		pcall(listings.RemoveAsync, listings, id)
		table.insert(p.Pets, listing.Pet)
		p.MyListings[id] = nil
		DataService.MarkDirty(player)
		PetService.UpdateEquippedAttribute(player)
		updateBoothAttr(player)
		cacheTime = 0
		return { ok = true }
	end
	-- بيع أو انتهى → التسوية
	reconcile(player)
	return { ok = true }
end

local function sellNPC(player: Player, payload: any)
	local p = DataService.Get(player) :: DataService.Profile
	local uids = type(payload.Uids) == "table" and payload.Uids or { payload.Uid }
	local total = 0
	local n = 0
	for _, uid in ipairs(uids) do
		local pet = PetService.Find(p, tostring(uid))
		if pet and not pet.Locked then
			local def = Pets.Get(pet.Id) :: Pets.PetDef
			local value = (Config.Market.NPCValue[def.Rarity] or 1) * (Config.VariantMultipliers[pet.Variant] or 1) * (1 + (pet.Level or 1) / 50)
			total += math.floor(value)
			PetService.Remove(p, pet.Uid)
			n += 1
		end
	end
	if n == 0 then
		return fail("لا يوجد حيوان صالح للبيع")
	end
	DataService.AddGems(player, total, true)
	DataService.MarkDirty(player)
	PetService.UpdateEquippedAttribute(player)
	DataService.Notify(player, "💠 بعت " .. n .. " حيوان مقابل " .. total .. " جوهرة", Color3.fromRGB(180, 120, 255))
	return { ok = true, gems = total }
end

function MarketService.NPCValue(pet: any): number
	local def = Pets.Get(pet.Id)
	if not def then
		return 0
	end
	return math.floor((Config.Market.NPCValue[def.Rarity] or 1) * (Config.VariantMultipliers[pet.Variant] or 1) * (1 + (pet.Level or 1) / 50))
end

local function exchange(player: Player, payload: any)
	local p = DataService.Get(player) :: DataService.Profile
	local amount = math.floor(tonumber(payload.Amount) or 0)
	if amount < 1 then
		return fail("أدخل عدداً صحيحاً")
	end
	local day = math.floor(os.time() / 86400)
	if p.GemExchange.Day ~= day then
		p.GemExchange = { Day = day, Count = 0 }
	end
	if p.GemExchange.Count + amount > Config.GemExchange.DailyCap then
		return fail("السقف اليومي " .. Config.GemExchange.DailyCap .. " جوهرة (تبقى " .. (Config.GemExchange.DailyCap - p.GemExchange.Count) .. ")")
	end
	local Zones = require(Shared.Data.Zones)
	local best = 1
	for k in pairs(p.UnlockedZones) do
		local z = Zones.Get(tonumber(k) or 1)
		if z then
			best = math.max(best, z.Multiplier)
		end
	end
	local price = Config.GemExchange.CoinsPerGem * best * amount
	if not DataService.Spend(player, "Coins", price) then
		return fail("تحتاج 💰 " .. price)
	end
	p.GemExchange.Count += amount
	DataService.AddGems(player, amount, false)
	DataService.MarkDirty(player)
	DataService.Notify(player, "💠 اشتريت " .. amount .. " جوهرة", Color3.fromRGB(180, 120, 255))
	return { ok = true }
end

function MarketService.ExchangePrice(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 0
	end
	local Zones = require(Shared.Data.Zones)
	local best = 1
	for k in pairs(p.UnlockedZones) do
		local z = Zones.Get(tonumber(k) or 1)
		if z then
			best = math.max(best, z.Multiplier)
		end
	end
	return Config.GemExchange.CoinsPerGem * best
end

local function claimBooth(player: Player, payload: any)
	local idx = math.floor(tonumber(payload.BoothId) or 0)
	local booth = MapBuilder.Booths[idx]
	if not booth then
		return fail("كشك غير موجود")
	end
	if boothOf[player] == idx then
		-- تحرير الكشك
		booths[idx] = nil
		boothOf[player] = nil
		booth:SetAttribute("Owner", 0)
		booth:SetAttribute("OwnerName", "")
		booth:SetAttribute("Listings", 0)
		return { ok = true, released = true }
	end
	if booths[idx] then
		return fail("الكشك محجوز")
	end
	if boothOf[player] then
		local old = MapBuilder.Booths[boothOf[player]]
		booths[boothOf[player]] = nil
		if old then
			old:SetAttribute("Owner", 0)
			old:SetAttribute("OwnerName", "")
			old:SetAttribute("Listings", 0)
		end
	end
	booths[idx] = player
	boothOf[player] = idx
	booth:SetAttribute("Owner", player.UserId)
	booth:SetAttribute("OwnerName", player.DisplayName)
	updateBoothAttr(player)
	DataService.Notify(player, "🏪 حجزت الكشك " .. idx .. "! اعرض حيواناتك من السوق", Color3.fromRGB(120, 255, 140))
	return { ok = true }
end

function MarketService.Handle(player: Player, action: string, payload: any): any
	local p = DataService.Get(player)
	if not p then
		return fail("لم يتم تحميل البيانات")
	end
	if not RateLimit.Check(player, "Market", 6, 2) then
		return fail("ببطء!")
	end
	payload = type(payload) == "table" and payload or {}
	if action == "Browse" then
		local all = fetchAll(payload.Force == true)
		local sellerFilter = tonumber(payload.Seller)
		local out = {}
		for _, v in ipairs(all) do
			if not sellerFilter or v.Seller == sellerFilter then
				table.insert(out, { Id = v.Id, Seller = v.Seller, SellerName = v.SellerName, Name = v.Name, PetId = v.PetId, Variant = v.Variant, Level = v.Level, Rarity = v.Rarity, Power = v.Power, Price = v.Price, Time = v.Time })
			end
		end
		return { ok = true, listings = out }
	elseif action == "List" then
		return list(player, payload)
	elseif action == "Buy" then
		return buy(player, payload)
	elseif action == "Cancel" then
		return cancel(player, payload)
	elseif action == "SellNPC" then
		return sellNPC(player, payload)
	elseif action == "Booth" then
		return claimBooth(player, payload)
	elseif action == "Exchange" then
		return exchange(player, payload)
	elseif action == "Reconcile" then
		reconcile(player)
		return { ok = true }
	end
	return fail("إجراء غير معروف")
end

function MarketService.Init()
	Remotes.Function("Market").OnServerInvoke = function(player, action, payload)
		return MarketService.Handle(player, tostring(action), payload)
	end
	table.insert(DataService.Extenders, function(player, payload)
		payload.GemPrice = MarketService.ExchangePrice(player)
	end)
	DataService.Loaded:Connect(function(player)
		task.delay(3, function()
			if player.Parent == Players then
				reconcile(player)
			end
		end)
	end)
	Players.PlayerRemoving:Connect(function(player)
		local idx = boothOf[player]
		if idx then
			booths[idx] = nil
			boothOf[player] = nil
			local booth = MapBuilder.Booths[idx]
			if booth then
				booth:SetAttribute("Owner", 0)
				booth:SetAttribute("OwnerName", "")
				booth:SetAttribute("Listings", 0)
			end
		end
	end)
	task.spawn(function()
		while true do
			task.wait(120)
			for _, player in ipairs(Players:GetPlayers()) do
				local p = DataService.Get(player)
				if p and next(p.MyListings) ~= nil then
					reconcile(player)
				end
			end
		end
	end)
	-- تحديث الأكشاك: prompt الحجز يُعالج من العميل عبر Remote
end

return MarketService

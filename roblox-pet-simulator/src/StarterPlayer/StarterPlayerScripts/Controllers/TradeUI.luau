--!strict
-- قائمة اللاعبين + نافذة التبادل + طلب وارد
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local PetUtil = require(Shared.Modules.PetUtil)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local InventoryUI = require(script.Parent.InventoryUI)

local TradeUI = {}

local state: any = nil
local tradeWindow: UIKit.Window
local myGrid: ScrollingFrame
local theirGrid: ScrollingFrame
local invGrid: ScrollingFrame
local statusLabel: TextLabel
local confirmBtn: TextButton
local myGemsBox: TextBox
local theirGemsLabel: TextLabel
local partnerLabel: TextLabel

local function clear(parent: Instance)
	for _, c in ipairs(parent:GetChildren()) do
		if c:IsA("Frame") then
			c:Destroy()
		end
	end
end

local function refreshTrade()
	if not state then
		return
	end
	local p = DataController.Profile
	partnerLabel.Text = "🤝 تبادل مع " .. state.Partner.DisplayName
	clear(myGrid)
	clear(theirGrid)
	clear(invGrid)
	local offered = {}
	for i, pet in ipairs(state.MyOffer) do
		offered[pet.Uid] = true
		local card = InventoryUI.PetCard(myGrid, pet, function()
			Remotes.Event("TradeAction"):FireServer("Remove", { Uid = pet.Uid })
		end)
		card.LayoutOrder = i
	end
	for i, pet in ipairs(state.TheirOffer) do
		local card = InventoryUI.PetCard(theirGrid, pet)
		card.LayoutOrder = i
	end
	if p then
		local sorted = table.clone(p.Pets)
		PetUtil.SortByPower(sorted)
		for i, pet in ipairs(sorted) do
			if not offered[pet.Uid] and not pet.Locked then
				local card = InventoryUI.PetCard(invGrid, pet, function()
					Remotes.Event("TradeAction"):FireServer("Add", { Uid = pet.Uid })
				end)
				card.LayoutOrder = i
			end
		end
	end
	if not myGemsBox:IsFocused() then
		myGemsBox.Text = tostring(state.MyGems or 0)
	end
	theirGemsLabel.Text = "💠 " .. (state.TheirGems or 0) .. " جوهرة"
	local mine, theirs = state.MyConfirmed, state.TheirConfirmed
	if state.Countdown then
		statusLabel.Text = "⏳ يتم التبادل خلال " .. state.Countdown .. "..."
		statusLabel.TextColor3 = UIKit.Colors.Gold
	else
		statusLabel.Text = (mine and "✅ أكدت" or "⬜ لم تؤكد") .. "   •   " .. (theirs and "✅ الطرف الآخر أكد" or "⬜ الطرف الآخر لم يؤكد")
		statusLabel.TextColor3 = UIKit.Colors.Muted
	end
	confirmBtn.Text = mine and "إلغاء التأكيد" or "✅ تأكيد"
	confirmBtn.BackgroundColor3 = mine and UIKit.Colors.Panel3 or UIKit.Colors.Green
end

function TradeUI.Init()
	local gui = UIController.Gui :: ScreenGui

	-- قائمة اللاعبين
	local list = UIKit.Window(gui, "Trade", "🤝 التبادل — اللاعبون", UDim2.fromOffset(460, 520), Color3.fromRGB(60, 120, 220))
	UIKit.Label({ Text = "اختر لاعباً لإرسال طلب تبادل. الحد " .. Config.TradeMaxPets .. " حيوانات لكل طرف.", Size = UDim2.new(1, 0, 0, 40), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 16, Parent = list.Content })
	local scroll = UIKit.Scroll(list.Content, { Size = UDim2.new(1, 0, 1, -44), Position = UDim2.fromOffset(0, 44) })
	UIKit.List(scroll, 6)
	local function refreshList()
		clear(scroll)
		local me = Players.LocalPlayer
		local any = false
		for _, pl in ipairs(Players:GetPlayers()) do
			if pl ~= me then
				any = true
				local row = UIKit.Frame({ Size = UDim2.new(1, -8, 0, 52), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
				UIKit.Corner(row, 10)
				UIKit.Label({ Text = pl.DisplayName .. "  (@" .. pl.Name .. ")", Size = UDim2.new(1, -150, 1, 0), Position = UDim2.fromOffset(12, 0), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 18, Parent = row })
				UIKit.Button({ Text = "طلب تبادل", Color = UIKit.Colors.Blue, Size = UDim2.fromOffset(130, 38), Position = UDim2.new(1, -140, 0, 7), MaxTextSize = 16, Parent = row }, function()
					Remotes.Event("TradeRequest"):FireServer(pl.UserId)
				end)
			end
		end
		if not any then
			UIKit.Label({ Text = "لا يوجد لاعبون آخرون في السيرفر", Size = UDim2.new(1, 0, 0, 40), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = scroll })
		end
	end
	UIController.Register("Trade", list, refreshList)

	-- نافذة التبادل
	tradeWindow = UIKit.Window(gui, "TradeSession", "🤝 تبادل", UDim2.fromOffset(940, 640), Color3.fromRGB(60, 120, 220))
	partnerLabel = tradeWindow.Title
	local left = UIKit.Frame({ Size = UDim2.new(0.5, -6, 0, 250), BackgroundColor3 = UIKit.Colors.Panel2, Parent = tradeWindow.Content })
	UIKit.Corner(left, 12)
	UIKit.Label({ Text = "عرضي", Size = UDim2.new(0.5, 0, 0, 26), MaxTextSize = 18, Parent = left })
	myGemsBox = UIKit.New("TextBox", { Size = UDim2.new(0.5, -8, 0, 26), Position = UDim2.new(0.5, 4, 0, 0), BackgroundColor3 = Color3.fromRGB(15, 16, 28), PlaceholderText = "💠 جواهر تعرضها", Text = "0", Font = UIKit.Font, TextColor3 = Color3.fromRGB(200, 140, 255), TextSize = 16, ClearTextOnFocus = false, Parent = left }) :: TextBox
	UIKit.Corner(myGemsBox, 8)
	myGemsBox.FocusLost:Connect(function()
		Remotes.Event("TradeAction"):FireServer("SetGems", { Amount = tonumber(myGemsBox.Text) or 0 })
	end)
	myGrid = UIKit.Scroll(left, { Size = UDim2.new(1, -8, 1, -30), Position = UDim2.fromOffset(4, 28) })
	UIKit.Grid(myGrid, UDim2.fromOffset(100, 118), 6)
	local right = UIKit.Frame({ Size = UDim2.new(0.5, -6, 0, 250), Position = UDim2.new(0.5, 6, 0, 0), BackgroundColor3 = UIKit.Colors.Panel2, Parent = tradeWindow.Content })
	UIKit.Corner(right, 12)
	UIKit.Label({ Text = "عرض الطرف الآخر", Size = UDim2.new(0.5, 0, 0, 26), MaxTextSize = 18, Parent = right })
	theirGemsLabel = UIKit.Label({ Text = "💠 0", Size = UDim2.new(0.5, -8, 0, 26), Position = UDim2.new(0.5, 4, 0, 0), TextColor3 = Color3.fromRGB(200, 140, 255), MaxTextSize = 16, Parent = right })
	theirGrid = UIKit.Scroll(right, { Size = UDim2.new(1, -8, 1, -30), Position = UDim2.fromOffset(4, 28) })
	UIKit.Grid(theirGrid, UDim2.fromOffset(100, 118), 6)
	statusLabel = UIKit.Label({ Text = "", Size = UDim2.new(1, -240, 0, 40), Position = UDim2.fromOffset(0, 256), MaxTextSize = 18, Parent = tradeWindow.Content })
	confirmBtn = UIKit.Button({ Text = "تأكيد", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(110, 40), Position = UDim2.new(1, -230, 0, 256), MaxTextSize = 18, Parent = tradeWindow.Content }, function()
		Remotes.Event("TradeAction"):FireServer("Confirm", {})
	end)
	UIKit.Button({ Text = "إلغاء", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(110, 40), Position = UDim2.new(1, -110, 0, 256), MaxTextSize = 18, Parent = tradeWindow.Content }, function()
		Remotes.Event("TradeAction"):FireServer("Cancel", {})
	end)
	UIKit.Label({ Text = "حيواناتك (اضغط للإضافة)", Size = UDim2.new(1, 0, 0, 24), Position = UDim2.fromOffset(0, 300), MaxTextSize = 16, TextColor3 = UIKit.Colors.Muted, Parent = tradeWindow.Content })
	invGrid = UIKit.Scroll(tradeWindow.Content, { Size = UDim2.new(1, 0, 1, -326), Position = UDim2.fromOffset(0, 326) })
	UIKit.Grid(invGrid, UDim2.fromOffset(100, 118), 6)
	tradeWindow.Close.Activated:Connect(function()
		Remotes.Event("TradeAction"):FireServer("Cancel", {})
	end)
	UIController.Register("TradeSession", tradeWindow, refreshTrade)

	Remotes.Event("TradeUpdate").OnClientEvent:Connect(function(data)
		state = data
		if data then
			if not UIController.IsOpen("TradeSession") then
				UIController.Open("TradeSession")
			else
				refreshTrade()
			end
		elseif UIController.IsOpen("TradeSession") then
			UIController.Close()
		end
	end)
	DataController.Changed:Connect(function()
		if UIController.IsOpen("TradeSession") then
			refreshTrade()
		end
	end)

	-- طلب وارد
	Remotes.Event("TradeIncoming").OnClientEvent:Connect(function(data)
		local popup = UIKit.Frame({ Size = UDim2.fromOffset(360, 120), Position = UDim2.new(0.5, -180, 0, 200), BackgroundColor3 = UIKit.Colors.Panel, ZIndex = 20, Parent = gui })
		UIKit.Corner(popup, 14)
		UIKit.Stroke(popup, UIKit.Colors.Blue, 3)
		UIKit.Label({ Text = "🤝 " .. data.FromName .. " يريد التبادل معك", Size = UDim2.new(1, -16, 0, 50), Position = UDim2.fromOffset(8, 6), MaxTextSize = 20, ZIndex = 21, Parent = popup })
		UIKit.Button({ Text = "قبول", Color = UIKit.Colors.Green, Size = UDim2.fromOffset(150, 40), Position = UDim2.fromOffset(20, 66), MaxTextSize = 18, ZIndex = 21, Parent = popup }, function()
			Remotes.Event("TradeRespond"):FireServer(data.FromUserId, true)
			popup:Destroy()
		end)
		UIKit.Button({ Text = "رفض", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(150, 40), Position = UDim2.new(1, -170, 0, 66), MaxTextSize = 18, ZIndex = 21, Parent = popup }, function()
			Remotes.Event("TradeRespond"):FireServer(data.FromUserId, false)
			popup:Destroy()
		end)
		UIKit.Pop(popup)
		task.delay(20, function()
			if popup.Parent then
				popup:Destroy()
			end
		end)
	end)
end

return TradeUI

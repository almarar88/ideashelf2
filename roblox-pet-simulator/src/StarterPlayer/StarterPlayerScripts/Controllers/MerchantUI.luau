--!strict
-- التاجر المتجول
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Format = require(Shared.Modules.Format)
local MerchantStock = require(Shared.Modules.MerchantStock)
local Pets = require(Shared.Data.Pets)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local PetViewport = require(script.Parent.PetViewport)

local MerchantUI = {}

function MerchantUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Merchant", "🧳 التاجر المتجول", UDim2.fromOffset(760, 420), Color3.fromRGB(200, 60, 60))
	local timer = UIKit.Label({ Text = "", Size = UDim2.new(1, 0, 0, 28), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 18, Parent = w.Content })
	local grid = UIKit.Frame({ Size = UDim2.new(1, 0, 1, -34), Position = UDim2.fromOffset(0, 34), BackgroundTransparency = 1, Parent = w.Content })
	UIKit.Grid(grid, UDim2.fromOffset(170, 250), 10)
	local lastRotation = -1

	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		local now = DataController.ServerTime()
		local rotation = MerchantStock.RotationId(now)
		timer.Text = "يتغير المخزون بعد " .. Format.Time(MerchantStock.SecondsLeft(now))
		local bought = p.Merchant.Rotation == rotation and p.Merchant.Bought or {}
		if rotation ~= lastRotation then
			for _, c in ipairs(grid:GetChildren()) do
				if c:IsA("Frame") then
					c:Destroy()
				end
			end
		end
		lastRotation = rotation
		local stock = MerchantStock.Stock(rotation)
		for slot, item in ipairs(stock) do
			local card = grid:FindFirstChild("Slot" .. slot) :: Frame?
			if not card then
				card = UIKit.Frame({ Name = "Slot" .. slot, LayoutOrder = slot, BackgroundColor3 = UIKit.Colors.Panel2, Parent = grid })
				UIKit.Corner(card, 14)
				UIKit.Stroke(card, UIKit.Colors.Gold, 2)
				local vis = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 120), BackgroundTransparency = 1, Parent = card })
				if item.Type == "Pet" and Pets.Get(item.Key) then
					PetViewport.Create(vis, item.Key, "Normal", true)
				else
					local icon = item.Type == "Potion" and "🧪" or (item.Type == "Spins" and "🎡" or "🔁")
					UIKit.Label({ Text = icon, MaxTextSize = 70, Parent = vis })
				end
				UIKit.Label({ Text = item.Name, Size = UDim2.new(1, -8, 0, 30), Position = UDim2.fromOffset(4, 122), MaxTextSize = 17, Parent = card })
				UIKit.Label({ Name = "Limit", Text = "", Size = UDim2.new(1, -8, 0, 22), Position = UDim2.fromOffset(4, 152), TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, Parent = card })
				UIKit.Button({ Name = "Buy", Text = "💎 " .. item.Cost, Color = UIKit.Colors.Green, Size = UDim2.new(1, -16, 0, 40), Position = UDim2.new(0, 8, 1, -48), MaxTextSize = 18, Parent = card }, function()
					local res = Remotes.Function("Merchant"):InvokeServer(slot)
					if not res.ok and res.error then
						UIController.Notify(res.error, UIKit.Colors.Red)
					end
				end)
			end
			local n = bought[tostring(item.PoolIndex)] or 0
			local limitLabel = card:FindFirstChild("Limit") :: TextLabel
			limitLabel.Text = "اشتريت " .. n .. " / " .. item.Limit
			local btn = card:FindFirstChild("Buy") :: TextButton
			btn.BackgroundColor3 = n >= item.Limit and UIKit.Colors.Panel3 or (p.Diamonds >= item.Cost and UIKit.Colors.Green or UIKit.Colors.Panel3)
			btn.Text = n >= item.Limit and "نفد" or ("💎 " .. item.Cost)
		end
	end
	UIController.Register("Merchant", w, refresh)
	task.spawn(function()
		while true do
			task.wait(1)
			if UIController.IsOpen("Merchant") then
				refresh()
			end
		end
	end)
end

return MerchantUI

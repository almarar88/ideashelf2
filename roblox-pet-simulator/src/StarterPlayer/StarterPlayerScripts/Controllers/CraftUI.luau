--!strict
-- محطة التصنيع
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Pets = require(Shared.Data.Pets)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local UIController = require(script.Parent.UIController)
local PetViewport = require(script.Parent.PetViewport)

local CraftUI = {}

local function have(p: any, input: any): number
	local n = 0
	for _, pet in ipairs(p.Pets) do
		if not pet.Locked then
			local def = Pets.Get(pet.Id)
			if (input.Pet == nil or pet.Id == input.Pet) and (input.Rarity == nil or (def and def.Rarity == input.Rarity)) and (input.Variant or "Normal") == pet.Variant then
				n += 1
			end
		end
	end
	return n
end

function CraftUI.Init()
	local gui = UIController.Gui :: ScreenGui
	local w = UIKit.Window(gui, "Craft", "🔨 محطة التصنيع", UDim2.fromOffset(820, 600), Color3.fromRGB(255, 160, 60))
	local scroll = UIKit.Scroll(w.Content)
	UIKit.List(scroll, 10)
	local rows = {}
	for i, r in ipairs(Config.Recipes) do
		local row = UIKit.Frame({ LayoutOrder = i, Size = UDim2.new(1, -8, 0, 130), BackgroundColor3 = UIKit.Colors.Panel2, Parent = scroll })
		UIKit.Corner(row, 12)
		local vp = UIKit.Frame({ Size = UDim2.fromOffset(110, 110), Position = UDim2.fromOffset(8, 10), BackgroundTransparency = 1, Parent = row })
		if r.Output.Pet then
			PetViewport.Create(vp, r.Output.Pet, r.Output.Variant or "Normal", true)
		else
			UIKit.Label({ Text = r.Output.Potion and "🧪" or "🔁", MaxTextSize = 60, Parent = vp })
		end
		UIKit.Label({ Text = r.Name, Size = UDim2.new(1, -330, 0, 28), Position = UDim2.fromOffset(126, 8), TextXAlignment = Enum.TextXAlignment.Left, MaxTextSize = 20, Parent = row })
		local req = UIKit.Label({ Text = "", Size = UDim2.new(1, -330, 0, 70), Position = UDim2.fromOffset(126, 36), TextXAlignment = Enum.TextXAlignment.Left, TextYAlignment = Enum.TextYAlignment.Top, TextColor3 = UIKit.Colors.Muted, MaxTextSize = 14, Parent = row })
		local cost = UIKit.Label({ Text = "", Size = UDim2.fromOffset(190, 30), Position = UDim2.new(1, -200, 0, 10), TextColor3 = UIKit.Colors.Gold, MaxTextSize = 16, Parent = row })
		local btn = UIKit.Button({ Text = "🔨 تصنيع", Color = Color3.fromRGB(255, 160, 60), Size = UDim2.fromOffset(190, 44), Position = UDim2.new(1, -200, 0, 70), MaxTextSize = 18, Parent = row }, function()
			local res = Remotes.Function("Craft"):InvokeServer(r.Id)
			if not res.ok and res.error then
				UIController.Notify(res.error, UIKit.Colors.Red)
			end
		end)
		rows[r.Id] = { Req = req, Cost = cost, Btn = btn }
	end
	local function refresh()
		local p = DataController.Profile
		if not p then
			return
		end
		for _, r in ipairs(Config.Recipes) do
			local row = rows[r.Id]
			local lines = {}
			local okAll = true
			for _, input in ipairs(r.Inputs) do
				local n = have(p, input)
				local ok = n >= input.Count
				okAll = okAll and ok
				table.insert(lines, (ok and "✅ " or "❌ ") .. input.Count .. " × " .. (input.Pet and (Pets.Get(input.Pet) or { Name = input.Pet }).Name or input.Rarity) .. " (" .. (input.Variant or "Normal") .. ")  [" .. n .. "]")
			end
			row.Req.Text = table.concat(lines, "\n")
			local parts = {}
			if (r.Diamonds or 0) > 0 then
				table.insert(parts, "💎 " .. Format.Number(r.Diamonds))
			end
			if (r.Gems or 0) > 0 then
				table.insert(parts, "💠 " .. Format.Number(r.Gems))
			end
			row.Cost.Text = table.concat(parts, "  ")
			local canPay = p.Diamonds >= (r.Diamonds or 0) and p.Gems >= (r.Gems or 0)
			row.Btn.BackgroundColor3 = (okAll and canPay) and Color3.fromRGB(255, 160, 60) or UIKit.Colors.Panel3
		end
	end
	UIController.Register("Craft", w, refresh)
end

return CraftUI

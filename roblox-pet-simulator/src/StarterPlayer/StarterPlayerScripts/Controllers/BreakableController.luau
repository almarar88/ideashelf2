--!strict
-- أشرطة الصحة فوق الصناديق، تأثير الضرب، ونوافذ المكافأة
local Workspace = game:GetService("Workspace")
local Debris = game:GetService("Debris")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Breakables = require(Shared.Data.Breakables)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local UIKit = require(script.Parent.UIKit)
local DataController = require(script.Parent.DataController)
local EffectsController = require(script.Parent.EffectsController)

local BreakableController = {}

local function attach(model: Model)
	local root = model.PrimaryPart or model:FindFirstChild("Base") :: BasePart?
	if not root then
		return
	end
	local typeName = model:GetAttribute("Type") :: string
	local def = Breakables.Get(typeName or "")
	local bb = Instance.new("BillboardGui")
	bb.Name = "HealthBar"
	bb.Size = UDim2.fromOffset(150, 52)
	bb.StudsOffset = Vector3.new(0, root.Size.Y / 2 + 3, 0)
	bb.AlwaysOnTop = false
	bb.MaxDistance = 120
	bb.LightInfluence = 0
	local name = UIKit.Label({ Text = def and def.Name or typeName, Size = UDim2.new(1, 0, 0, 22), TextStrokeTransparency = 0.2, Parent = bb })
	local coins = model:GetAttribute("Coins") :: number
	local diamonds = model:GetAttribute("Diamonds") :: number
	local rewardText = ""
	if coins and coins > 0 then
		rewardText = "💰 " .. Format.Number(coins)
	end
	if diamonds and diamonds > 0 then
		rewardText = rewardText .. " 💎 " .. diamonds
	end
	UIKit.Label({ Text = rewardText, Size = UDim2.new(1, 0, 0, 16), Position = UDim2.fromOffset(0, 22), TextColor3 = UIKit.Colors.Gold, Parent = bb })
	local _bg, fill, label = UIKit.ProgressBar(bb, UIKit.Colors.Green, UDim2.new(1, 0, 0, 12), UDim2.fromOffset(0, 40))
	label.Visible = false
	local function update()
		local h = model:GetAttribute("Health") :: number or 0
		local mh = model:GetAttribute("MaxHealth") :: number or 1
		local ratio = math.clamp(h / mh, 0, 1)
		fill.Size = UDim2.fromScale(ratio, 1)
		fill.BackgroundColor3 = ratio > 0.5 and UIKit.Colors.Green or (ratio > 0.2 and UIKit.Colors.Gold or UIKit.Colors.Red)
		name.Text = (def and def.Name or typeName) .. "  " .. Format.Number(h)
	end
	update()
	model:GetAttributeChangedSignal("Health"):Connect(update)
	model:GetAttributeChangedSignal("LastHit"):Connect(function()
		local by = model:GetAttribute("LastHitBy")
		local dmg = model:GetAttribute("LastDamage")
		local p = DataController.Profile
		if by == Players.LocalPlayer.UserId and type(dmg) == "number" and p and p.Settings.DamageNumbers ~= false then
			local crit = model:GetAttribute("LastCrit") == true
			if crit then
				EffectsController.Shockwave(root.Position, Color3.fromRGB(255, 200, 40))
			end
			local anchor = Instance.new("Part")
			anchor.Anchored = true
			anchor.CanCollide = false
			anchor.CanQuery = false
			anchor.Transparency = 1
			anchor.Size = Vector3.new(1, 1, 1)
			anchor.Position = root.Position + Vector3.new(math.random(-2, 2), root.Size.Y / 2, math.random(-2, 2))
			anchor.Parent = Workspace
			local dbb = Instance.new("BillboardGui")
			dbb.Size = UDim2.fromOffset(160, 40)
			dbb.AlwaysOnTop = true
			local dl = UIKit.Label({ Text = (crit and "💥 " or "-") .. Format.Number(dmg), TextColor3 = crit and UIKit.Colors.Gold or Color3.fromRGB(255, 90, 90), TextStrokeTransparency = 0, MaxTextSize = crit and 30 or 22, Parent = dbb })
			dbb.Parent = anchor
			UIKit.Tween(dbb, { StudsOffset = Vector3.new(0, 4, 0) }, 0.8)
			UIKit.Tween(dl, { TextTransparency = 1, TextStrokeTransparency = 1 }, 0.8, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
			Debris:AddItem(anchor, 0.9)
		end
		local hl = Instance.new("Highlight")
		hl.FillColor = Color3.new(1, 1, 1)
		hl.FillTransparency = 0.3
		hl.OutlineTransparency = 1
		hl.Parent = model
		UIKit.Tween(hl, { FillTransparency = 1 }, 0.25)
		Debris:AddItem(hl, 0.3)
	end)
	bb.Parent = root
end

local function popup(data: any)
	local pos = data.Position :: Vector3
	local text = ""
	if data.Coins and data.Coins > 0 then
		text = "+" .. Format.Number(data.Coins) .. " 💰"
	end
	if data.Diamonds and data.Diamonds > 0 then
		text = text .. "  +" .. data.Diamonds .. " 💎"
	end
	if data.Gems and data.Gems > 0 then
		text = text .. "  +" .. data.Gems .. " 💠"
	end
	if text == "" then
		return
	end
	EffectsController.Burst(pos, data.Color or Color3.fromRGB(255, 200, 40), 24, 0.5)
	EffectsController.Play("Break")
	local anchor = Instance.new("Part")
	anchor.Anchored = true
	anchor.CanCollide = false
	anchor.CanQuery = false
	anchor.Transparency = 1
	anchor.Size = Vector3.new(1, 1, 1)
	anchor.Position = pos
	anchor.Parent = Workspace
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(200, 50)
	bb.AlwaysOnTop = true
	bb.StudsOffset = Vector3.new(0, 0, 0)
	local label = UIKit.Label({ Text = text, TextColor3 = UIKit.Colors.Gold, TextStrokeTransparency = 0, Parent = bb })
	bb.Parent = anchor
	UIKit.Tween(bb, { StudsOffset = Vector3.new(0, 6, 0) }, 1.2)
	UIKit.Tween(label, { TextTransparency = 1, TextStrokeTransparency = 1 }, 1.2, Enum.EasingStyle.Quad, Enum.EasingDirection.In)
	Debris:AddItem(anchor, 1.3)
end

function BreakableController.Init()
	local folder = Workspace:WaitForChild("Breakables")
	for _, m in ipairs(folder:GetChildren()) do
		if m:IsA("Model") then
			attach(m)
		end
	end
	folder.ChildAdded:Connect(function(m)
		if m:IsA("Model") and not m:FindFirstChild("HealthBar", true) then
			task.defer(attach, m)
		end
	end)
	Remotes.Event("RewardPopup").OnClientEvent:Connect(popup)
end

return BreakableController

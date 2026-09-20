--!strict
-- فتح المناطق، البوابات، التنقل، بوابة VIP، سرعة المشي
local Players = game:GetService("Players")
local MarketplaceService = game:GetService("MarketplaceService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Zones = require(Shared.Data.Zones)
local Format = require(Shared.Modules.Format)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)
local MapBuilder = require(script.Parent.MapBuilder)
local Hooks = require(script.Parent.Hooks)
local PetUtil = require(Shared.Modules.PetUtil)

local ZoneService = {}

local touchDebounce: { [Player]: number } = {}

function ZoneService.Unlock(player: Player, index: number): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	local zone = Zones.List[index]
	if not p or not zone then
		return { ok = false, error = "منطقة غير موجودة" }
	end
	if p.UnlockedZones[tostring(index)] then
		return { ok = true }
	end
	local required = Zones.RebirthRequired(index)
	if required > 0 and p.Rebirths < required then
		return { ok = false, error = "هذا العالم يتطلب " .. required .. " ريبيرث" }
	end
	if not Zones.IsWorldStart(index) and not p.UnlockedZones[tostring(index - 1)] then
		return { ok = false, error = "افتح المنطقة السابقة أولاً" }
	end
	if not DataService.Spend(player, "Coins", zone.Cost) then
		return { ok = false, error = "تحتاج 💰 " .. Format.Number(zone.Cost) .. " لفتح " .. zone.Name }
	end
	p.UnlockedZones[tostring(index)] = true
	Hooks.Fire(player, "Zone", index)
	DataService.MarkDirty(player)
	Remotes.Event("EventEffect"):FireClient(player, { Type = "ZoneUnlock", Zone = index })
	DataService.Notify(player, "🔓 فتحت منطقة " .. zone.Name .. " (" .. zone.Arabic .. ")!", Color3.fromRGB(120, 255, 140))
	return { ok = true }
end

function ZoneService.Teleport(player: Player, index: number): boolean
	local p = DataService.Get(player)
	if not p then
		return false
	end
	if index == 0 then
		if not DataService.HasGamepass(player, "VIP") then
			return false
		end
	elseif index == -1 or index == -2 then
		-- السوق والزنزانة متاحان للجميع
	elseif not p.UnlockedZones[tostring(index)] then
		return false
	elseif p.Rebirths < Zones.RebirthRequired(index) then
		return false
	end
	local layout = MapBuilder.Zones[index]
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not layout or not hrp then
		return false
	end
	hrp.CFrame = CFrame.new(layout.Spawn + Vector3.new(0, 4, 0), layout.Center)
	p.LastZone = index
	DataService.MarkDirty(player)
	return true
end

local function onGateTouched(gate: BasePart, hit: BasePart)
	local char = hit.Parent
	local player = char and Players:GetPlayerFromCharacter(char)
	if not player then
		return
	end
	local now = os.clock()
	if now - (touchDebounce[player] or 0) < 1.5 then
		return
	end
	touchDebounce[player] = now
	local index = gate:GetAttribute("Zone") :: number
	local p = DataService.Get(player)
	if not p or p.UnlockedZones[tostring(index)] then
		return
	end
	local res = ZoneService.Unlock(player, index)
	if not res.ok and res.error then
		DataService.Notify(player, res.error, Color3.fromRGB(255, 120, 120))
	end
end

local function onPortalTouched(kind: string, hit: BasePart)
	local char = hit.Parent
	local player = char and Players:GetPlayerFromCharacter(char)
	if not player then
		return
	end
	local now = os.clock()
	if now - (touchDebounce[player] or 0) < 2 then
		return
	end
	touchDebounce[player] = now
	if kind == "VIP" then
		if DataService.HasGamepass(player, "VIP") then
			ZoneService.Teleport(player, 0)
		else
			DataService.Notify(player, "👑 منطقة VIP لأصحاب جيم باس VIP", Color3.fromRGB(255, 215, 0))
			if Config.Gamepasses.VIP > 0 then
				pcall(MarketplaceService.PromptGamePassPurchase, MarketplaceService, player, Config.Gamepasses.VIP)
			end
		end
	elseif kind == "World2" or kind == "World3" then
		local p = DataService.Get(player)
		if not p then
			return
		end
		local start = kind == "World2" and Zones.WorldStart[2] or Zones.WorldStart[3]
		if not p.UnlockedZones[tostring(start)] then
			local res = ZoneService.Unlock(player, start)
			if not res.ok then
				DataService.Notify(player, res.error or "لا يمكن الدخول", Color3.fromRGB(255, 120, 120))
				return
			end
		end
		ZoneService.Teleport(player, start)
	elseif kind == "World1" then
		ZoneService.Teleport(player, Zones.WorldStart[2] - 1)
	elseif kind == "BackWorld2" then
		ZoneService.Teleport(player, Zones.WorldStart[3] - 1)
	elseif kind == "Market" then
		ZoneService.Teleport(player, -1)
	elseif kind == "Dungeon" then
		ZoneService.Teleport(player, -2)
	elseif kind == "MarketReturn" or kind == "DungeonReturn" then
		ZoneService.Teleport(player, 1)
	else
		ZoneService.Teleport(player, 1)
	end
end

local function computeSpeed(player: Player): number
	local p = DataService.Get(player)
	if not p then
		return 16
	end
	local agility = PetUtil.EnchantBonuses(p.Pets).Agility or 0
	local board = tonumber(player:GetAttribute("BoardSpeed")) or 0
	return 16 + (p.Upgrades.Speed or 0) * 2 + agility + board
end

local function applyCharacter(player: Player, char: Model)
	local p = DataService.Get(player)
	local hum = char:WaitForChild("Humanoid", 10) :: Humanoid?
	if hum and p then
		hum.WalkSpeed = computeSpeed(player)
	end
	task.wait(0.3)
	if p and p.LastZone and p.LastZone ~= 1 then
		ZoneService.Teleport(player, p.LastZone)
	end
	if DataService.HasGamepass(player, "VIP") then
		player:SetAttribute("VIP", true)
		local head = char:FindFirstChild("Head")
		if head and not head:FindFirstChild("VIPTag") then
			local bb = Instance.new("BillboardGui")
			bb.Name = "VIPTag"
			bb.Size = UDim2.fromScale(4, 1)
			bb.StudsOffset = Vector3.new(0, 2.6, 0)
			bb.AlwaysOnTop = true
			local l = Instance.new("TextLabel")
			l.Size = UDim2.fromScale(1, 1)
			l.BackgroundTransparency = 1
			l.Text = "👑 VIP"
			l.TextColor3 = Color3.fromRGB(255, 215, 0)
			l.TextStrokeTransparency = 0.2
			l.Font = Enum.Font.FredokaOne
			l.TextScaled = true
			l.Parent = bb
			bb.Parent = head
		end
	end
end

function ZoneService.RefreshSpeed(player: Player)
	local char = player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.WalkSpeed = computeSpeed(player)
	end
end

function ZoneService.Init()
	for index, layout in pairs(MapBuilder.Zones) do
		if layout.Gate then
			local gate = layout.Gate
			gate.Touched:Connect(function(hit)
				onGateTouched(gate, hit)
			end)
		end
	end
	if MapBuilder.VIPPortal then
		MapBuilder.VIPPortal.Touched:Connect(function(hit)
			onPortalTouched("VIP", hit)
		end)
	end
	if MapBuilder.VIPReturnPortal then
		MapBuilder.VIPReturnPortal.Touched:Connect(function(hit)
			onPortalTouched("Return", hit)
		end)
	end
	if MapBuilder.World2Portal then
		MapBuilder.World2Portal.Touched:Connect(function(hit)
			onPortalTouched("World2", hit)
		end)
	end
	if MapBuilder.World1Portal then
		MapBuilder.World1Portal.Touched:Connect(function(hit)
			onPortalTouched("World1", hit)
		end)
	end
	for kind, portal in pairs(MapBuilder.Portals) do
		portal.Touched:Connect(function(hit)
			onPortalTouched(kind, hit)
		end)
	end
	-- تحديث السرعة عند تغير الإنشانتات (عبر تغير الحيوانات المجهزة)
	Players.PlayerAdded:Connect(function(player)
		player:GetAttributeChangedSignal("EquippedPets"):Connect(function()
			ZoneService.RefreshSpeed(player)
		end)
	end)

	Remotes.Function("UnlockZone").OnServerInvoke = function(player, index)
		return ZoneService.Unlock(player, tonumber(index) or 0)
	end
	Remotes.Event("Teleport").OnServerEvent:Connect(function(player, index)
		ZoneService.Teleport(player, tonumber(index) or 1)
	end)

	local function hook(player: Player)
		if player:GetAttribute("ZoneHooked") then
			return
		end
		player:SetAttribute("ZoneHooked", true)
		player.CharacterAdded:Connect(function(char)
			applyCharacter(player, char)
		end)
		if player.Character then
			task.spawn(applyCharacter, player, player.Character)
		end
	end
	DataService.Loaded:Connect(function(player)
		hook(player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		touchDebounce[player] = nil
	end)
end

return ZoneService

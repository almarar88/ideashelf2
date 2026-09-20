--!strict
-- الألقاب ولوحة الاسم فوق الرأس (لقب + رتبة الريبيرث + VIP)
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Remotes = require(Shared.Remotes)
local DataService = require(script.Parent.DataService)

local TitleService = {}

function TitleService.Available(p: DataService.Profile): { string }
	local out = {}
	for _, t in ipairs(Config.Titles) do
		local ok = true
		if t.Achievement then
			ok = p.Achievements[t.Achievement] == true
		elseif t.Stat then
			ok = (p.Stats[t.Stat] or 0) >= (t.Target or 0)
		end
		if ok then
			table.insert(out, t.Id)
		end
	end
	return out
end

local function rankIcon(rebirths: number): string
	local icon = ""
	for _, r in ipairs(Config.RebirthRanks) do
		if rebirths >= r[1] then
			icon = r[2]
		end
	end
	return icon
end

function TitleService.Refresh(player: Player)
	local p = DataService.Get(player)
	local char = player.Character
	local head = char and char:FindFirstChild("Head")
	if not p or not head then
		return
	end
	local titleName = ""
	for _, t in ipairs(Config.Titles) do
		if t.Id == p.Title and t.Id ~= "" then
			titleName = t.Name
		end
	end
	local rank = rankIcon(p.Rebirths)
	local vip = DataService.HasGamepass(player, "VIP")
	local lines = {}
	if vip then
		table.insert(lines, "👑 VIP")
	end
	if titleName ~= "" then
		table.insert(lines, titleName)
	end
	if rank ~= "" then
		table.insert(lines, rank .. " ريبيرث " .. p.Rebirths)
	end
	local existing = head:FindFirstChild("VIPTag") or head:FindFirstChild("NameTag")
	if existing then
		existing:Destroy()
	end
	if #lines == 0 then
		return
	end
	local bb = Instance.new("BillboardGui")
	bb.Name = "NameTag"
	bb.Size = UDim2.fromScale(7, #lines * 0.7)
	bb.StudsOffset = Vector3.new(0, 2.4 + #lines * 0.35, 0)
	bb.AlwaysOnTop = true
	bb.MaxDistance = 120
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = 1
	l.Text = table.concat(lines, "\n")
	l.TextColor3 = vip and Color3.fromRGB(255, 215, 0) or Color3.fromRGB(255, 255, 255)
	l.TextStrokeTransparency = 0.2
	l.Font = Enum.Font.FredokaOne
	l.TextScaled = true
	l.Parent = bb
	bb.Parent = head
end

function TitleService.Set(player: Player, id: string): { ok: boolean, error: string? }
	local p = DataService.Get(player)
	if not p then
		return { ok = false, error = "لم يتم تحميل البيانات" }
	end
	if not table.find(TitleService.Available(p), id) then
		return { ok = false, error = "لم تفتح هذا اللقب بعد" }
	end
	p.Title = id
	DataService.MarkDirty(player)
	TitleService.Refresh(player)
	return { ok = true }
end

function TitleService.Init()
	Remotes.Function("Title").OnServerInvoke = function(player, id)
		return TitleService.Set(player, tostring(id))
	end
	table.insert(DataService.Extenders, function(player, payload)
		local p = DataService.Get(player)
		payload.TitlesAvailable = p and TitleService.Available(p) or {}
	end)
	local function hook(player: Player)
		player.CharacterAdded:Connect(function()
			task.wait(0.5)
			TitleService.Refresh(player)
		end)
	end
	Players.PlayerAdded:Connect(hook)
	for _, pl in ipairs(Players:GetPlayers()) do
		hook(pl)
	end
	DataService.Loaded:Connect(function(player)
		task.delay(1, TitleService.Refresh, player)
	end)
	-- تحديث دوري (الريبيرث/الإنجازات قد تتغير)
	task.spawn(function()
		while true do
			task.wait(30)
			for _, pl in ipairs(Players:GetPlayers()) do
				TitleService.Refresh(pl)
			end
		end
	end)
end

return TitleService

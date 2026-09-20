--!strict
local Format = {}

local SUFFIX = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

function Format.Number(n: number): string
	if n ~= n or n == math.huge then
		return "∞"
	end
	local neg = n < 0
	n = math.abs(n)
	if n < 1000 then
		local s = tostring(math.floor(n + 0.5))
		return neg and "-" .. s or s
	end
	local idx = 1
	while n >= 1000 and idx < #SUFFIX do
		n /= 1000
		idx += 1
	end
	local s
	if n >= 100 then
		s = string.format("%d", math.floor(n))
	elseif n >= 10 then
		s = string.format("%.1f", n)
	else
		s = string.format("%.2f", n)
	end
	s = s:gsub("%.?0+$", "")
	return (neg and "-" or "") .. s .. SUFFIX[idx]
end

function Format.Comma(n: number): string
	local s = tostring(math.floor(n + 0.5))
	local out = s:reverse():gsub("(%d%d%d)", "%1,"):reverse()
	return (out:gsub("^,", ""))
end

function Format.Percent(p: number): string
	if p >= 10 then
		return string.format("%.1f%%", p)
	elseif p >= 1 then
		return string.format("%.2f%%", p)
	else
		return string.format("%.3f%%", p)
	end
end

function Format.Time(seconds: number): string
	seconds = math.max(0, math.floor(seconds))
	local h = seconds // 3600
	local m = (seconds % 3600) // 60
	local s = seconds % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, s)
	end
	return string.format("%d:%02d", m, s)
end

return Format

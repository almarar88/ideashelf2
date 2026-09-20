--!strict
-- قناة أحداث داخلية بين الخدمات (للمهام والإنجازات والدليل التعليمي)
local Hooks = {}
Hooks.Listeners = {} :: { (Player, string, number) -> () }

function Hooks.Fire(player: Player, kind: string, amount: number)
	for _, fn in ipairs(Hooks.Listeners) do
		task.spawn(fn, player, kind, amount)
	end
end

function Hooks.Listen(fn: (Player, string, number) -> ())
	table.insert(Hooks.Listeners, fn)
end

return Hooks

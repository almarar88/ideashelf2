--!strict
-- أدوات بناء الواجهة بالكود (بدون أي أصول خارجية)
local TweenService = game:GetService("TweenService")

local UIKit = {}

UIKit.Font = Enum.Font.FredokaOne
UIKit.Colors = {
	Panel = Color3.fromRGB(28, 31, 52),
	Panel2 = Color3.fromRGB(40, 44, 72),
	Panel3 = Color3.fromRGB(52, 57, 92),
	Text = Color3.fromRGB(255, 255, 255),
	Muted = Color3.fromRGB(170, 175, 200),
	Green = Color3.fromRGB(70, 210, 110),
	Red = Color3.fromRGB(235, 80, 90),
	Blue = Color3.fromRGB(70, 150, 255),
	Gold = Color3.fromRGB(255, 200, 50),
	Purple = Color3.fromRGB(160, 90, 255),
	Cyan = Color3.fromRGB(80, 220, 255),
	Pink = Color3.fromRGB(255, 110, 190),
}

function UIKit.New(class: string, props: { [string]: any }?, children: { Instance }?): any
	local inst = Instance.new(class)
	if props then
		for k, v in pairs(props) do
			if k ~= "Parent" then
				(inst :: any)[k] = v
			end
		end
	end
	if children then
		for _, c in ipairs(children) do
			c.Parent = inst
		end
	end
	if props and props.Parent then
		inst.Parent = props.Parent
	end
	return inst
end

function UIKit.Corner(parent: Instance, px: number?): UICorner
	return UIKit.New("UICorner", { CornerRadius = UDim.new(0, px or 12), Parent = parent })
end

function UIKit.Stroke(parent: Instance, color: Color3?, thickness: number?, transparency: number?): UIStroke
	return UIKit.New("UIStroke", {
		Color = color or Color3.new(0, 0, 0),
		Thickness = thickness or 2,
		Transparency = transparency or 0,
		ApplyStrokeMode = Enum.ApplyStrokeMode.Border,
		Parent = parent,
	})
end

function UIKit.Gradient(parent: Instance, top: Color3, bottom: Color3, rotation: number?): UIGradient
	return UIKit.New("UIGradient", {
		Color = ColorSequence.new(top, bottom),
		Rotation = rotation or 90,
		Parent = parent,
	})
end

function UIKit.Padding(parent: Instance, px: number): UIPadding
	return UIKit.New("UIPadding", {
		PaddingTop = UDim.new(0, px),
		PaddingBottom = UDim.new(0, px),
		PaddingLeft = UDim.new(0, px),
		PaddingRight = UDim.new(0, px),
		Parent = parent,
	})
end

function UIKit.Frame(props: { [string]: any }): Frame
	local defaults = {
		BackgroundColor3 = UIKit.Colors.Panel,
		BorderSizePixel = 0,
	}
	for k, v in pairs(props) do
		defaults[k] = v
	end
	return UIKit.New("Frame", defaults)
end

function UIKit.Label(props: { [string]: any }): TextLabel
	local defaults = {
		BackgroundTransparency = 1,
		Font = UIKit.Font,
		TextColor3 = UIKit.Colors.Text,
		TextScaled = true,
		TextWrapped = true,
		Text = "",
		Size = UDim2.fromScale(1, 1),
		TextStrokeTransparency = 0.6,
		TextStrokeColor3 = Color3.new(0, 0, 0),
	}
	for k, v in pairs(props) do
		if k ~= "MaxTextSize" then
			defaults[k] = v
		end
	end
	local label = UIKit.New("TextLabel", defaults)
	if props.MaxTextSize then
		UIKit.New("UITextSizeConstraint", { MaxTextSize = props.MaxTextSize, Parent = label })
	end
	return label
end

function UIKit.Tween(inst: Instance, props: { [string]: any }, t: number?, style: Enum.EasingStyle?, dir: Enum.EasingDirection?): Tween
	local tween = TweenService:Create(inst, TweenInfo.new(t or 0.2, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), props)
	tween:Play()
	return tween
end

-- زر ملون مع تأثير عند المرور والضغط
function UIKit.Button(props: { [string]: any }, callback: (() -> ())?): TextButton
	local color = props.Color or UIKit.Colors.Blue
	local defaults = {
		BackgroundColor3 = color,
		BorderSizePixel = 0,
		Font = UIKit.Font,
		TextColor3 = UIKit.Colors.Text,
		TextScaled = true,
		Text = props.Text or "",
		AutoButtonColor = false,
		TextStrokeTransparency = 0.5,
		Size = props.Size or UDim2.fromOffset(120, 40),
	}
	for k, v in pairs(props) do
		if k ~= "Color" and k ~= "MaxTextSize" then
			defaults[k] = v
		end
	end
	local btn = UIKit.New("TextButton", defaults) :: TextButton
	UIKit.Corner(btn, 10)
	UIKit.Stroke(btn, Color3.new(0, 0, 0), 2, 0.5)
	UIKit.Gradient(btn, Color3.new(1, 1, 1), Color3.fromRGB(190, 190, 190))
	UIKit.New("UITextSizeConstraint", { MaxTextSize = props.MaxTextSize or 26, Parent = btn })
	local h, s, v = color:ToHSV()
	btn.MouseEnter:Connect(function()
		UIKit.Tween(btn, { BackgroundColor3 = Color3.fromHSV(h, s, math.min(1, v * 1.15)) }, 0.1)
	end)
	btn.MouseLeave:Connect(function()
		UIKit.Tween(btn, { BackgroundColor3 = color }, 0.1)
	end)
	btn.MouseButton1Down:Connect(function()
		UIKit.Tween(btn, { BackgroundColor3 = Color3.fromHSV(h, s, v * 0.8) }, 0.05)
	end)
	btn.MouseButton1Up:Connect(function()
		UIKit.Tween(btn, { BackgroundColor3 = color }, 0.1)
	end)
	if callback then
		btn.Activated:Connect(callback)
	end
	return btn
end

-- زر أيقونة دائري للـ HUD
function UIKit.IconButton(parent: Instance, icon: string, text: string, color: Color3, callback: () -> ()): TextButton
	local holder = UIKit.New("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(74, 84), Parent = parent })
	local btn = UIKit.New("TextButton", {
		BackgroundColor3 = color,
		Size = UDim2.fromOffset(64, 64),
		Position = UDim2.fromOffset(5, 0),
		Text = icon,
		Font = UIKit.Font,
		TextScaled = true,
		AutoButtonColor = false,
		BorderSizePixel = 0,
		Parent = holder,
	}) :: TextButton
	UIKit.Corner(btn, 18)
	UIKit.Stroke(btn, Color3.new(0, 0, 0), 2.5, 0.4)
	UIKit.Gradient(btn, Color3.new(1, 1, 1), Color3.fromRGB(170, 170, 170))
	UIKit.Padding(btn, 8)
	UIKit.Label({ Text = text, Size = UDim2.new(1, 0, 0, 18), Position = UDim2.fromOffset(0, 66), TextStrokeTransparency = 0.2, Parent = holder })
	btn.MouseEnter:Connect(function()
		UIKit.Tween(btn, { Size = UDim2.fromOffset(70, 70), Position = UDim2.fromOffset(2, -3) }, 0.1)
	end)
	btn.MouseLeave:Connect(function()
		UIKit.Tween(btn, { Size = UDim2.fromOffset(64, 64), Position = UDim2.fromOffset(5, 0) }, 0.1)
	end)
	btn.Activated:Connect(callback)
	return btn
end

export type Window = { Root: Frame, Content: Frame, Title: TextLabel, Close: TextButton }

-- نافذة بعنوان وزر إغلاق
function UIKit.Window(parent: Instance, name: string, title: string, size: UDim2, accent: Color3?): Window
	local root = UIKit.Frame({
		Name = name,
		Size = size,
		Position = UDim2.fromScale(0.5, 0.5),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Visible = false,
		Parent = parent,
	})
	UIKit.Corner(root, 18)
	UIKit.Stroke(root, accent or UIKit.Colors.Panel3, 3)
	UIKit.Gradient(root, UIKit.Colors.Panel2, UIKit.Colors.Panel)

	local bar = UIKit.Frame({ Size = UDim2.new(1, 0, 0, 52), BackgroundColor3 = accent or UIKit.Colors.Blue, Parent = root })
	UIKit.Corner(bar, 18)
	UIKit.Gradient(bar, Color3.new(1, 1, 1), Color3.fromRGB(180, 180, 180))
	UIKit.Frame({ Size = UDim2.new(1, 0, 0, 20), Position = UDim2.new(0, 0, 1, -20), BackgroundColor3 = accent or UIKit.Colors.Blue, Parent = bar })
	local titleLabel = UIKit.Label({ Text = title, Size = UDim2.new(1, -120, 1, -10), Position = UDim2.fromOffset(60, 5), TextStrokeTransparency = 0.3, Parent = bar })
	UIKit.New("UITextSizeConstraint", { MaxTextSize = 32, Parent = titleLabel })

	local close = UIKit.Button({ Text = "✕", Color = UIKit.Colors.Red, Size = UDim2.fromOffset(40, 40), Position = UDim2.new(1, -46, 0, 6), MaxTextSize = 24, Parent = bar })

	local content = UIKit.Frame({ Name = "Content", BackgroundTransparency = 1, Size = UDim2.new(1, -24, 1, -70), Position = UDim2.fromOffset(12, 60), Parent = root })

	return { Root = root, Content = content, Title = titleLabel, Close = close }
end

function UIKit.Scroll(parent: Instance, props: { [string]: any }?): ScrollingFrame
	local defaults = {
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Size = UDim2.fromScale(1, 1),
		ScrollBarThickness = 6,
		ScrollBarImageColor3 = UIKit.Colors.Muted,
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollingDirection = Enum.ScrollingDirection.Y,
		Parent = parent,
	}
	if props then
		for k, v in pairs(props) do
			defaults[k] = v
		end
	end
	return UIKit.New("ScrollingFrame", defaults)
end

function UIKit.Grid(parent: Instance, cell: UDim2, pad: number): UIGridLayout
	return UIKit.New("UIGridLayout", {
		CellSize = cell,
		CellPadding = UDim2.fromOffset(pad, pad),
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = Enum.HorizontalAlignment.Center,
		Parent = parent,
	})
end

function UIKit.List(parent: Instance, pad: number, horizontal: boolean?, center: boolean?): UIListLayout
	return UIKit.New("UIListLayout", {
		Padding = UDim.new(0, pad),
		FillDirection = horizontal and Enum.FillDirection.Horizontal or Enum.FillDirection.Vertical,
		SortOrder = Enum.SortOrder.LayoutOrder,
		HorizontalAlignment = center and Enum.HorizontalAlignment.Center or Enum.HorizontalAlignment.Left,
		VerticalAlignment = center and Enum.VerticalAlignment.Center or Enum.VerticalAlignment.Top,
		Parent = parent,
	})
end

-- شريط تقدم
function UIKit.ProgressBar(parent: Instance, color: Color3, size: UDim2, position: UDim2?): (Frame, Frame, TextLabel)
	local bg = UIKit.Frame({ Size = size, Position = position or UDim2.new(), BackgroundColor3 = Color3.fromRGB(15, 15, 25), Parent = parent })
	UIKit.Corner(bg, 8)
	UIKit.Stroke(bg, Color3.new(0, 0, 0), 2, 0.4)
	local fill = UIKit.Frame({ Size = UDim2.fromScale(0.5, 1), BackgroundColor3 = color, Parent = bg })
	UIKit.Corner(fill, 8)
	UIKit.Gradient(fill, Color3.new(1, 1, 1), Color3.fromRGB(170, 170, 170))
	local label = UIKit.Label({ Text = "", TextStrokeTransparency = 0.2, Parent = bg })
	return bg, fill, label
end

function UIKit.Pop(inst: GuiObject)
	local target = inst.Size
	inst.Size = UDim2.new(target.X.Scale * 0.8, target.X.Offset * 0.8, target.Y.Scale * 0.8, target.Y.Offset * 0.8)
	UIKit.Tween(inst, { Size = target }, 0.25, Enum.EasingStyle.Back)
end

return UIKit

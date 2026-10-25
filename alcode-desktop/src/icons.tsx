/**
 * أيقونات خطّية.
 *
 * رُسمت هنا بدل استعمال الرموز التعبيرية: الرموز التعبيرية تأتي بألوانها
 * وأسلوبها من نظام التشغيل، فتتضارب مع أي لوحة ألوان وتكسر وحدة الواجهة —
 * وهي أكثر ما كان يجعل التطبيق يبدو مجمَّعًا لا مصمَّمًا.
 *
 * كلها على شبكة ٢٤، بسماكة ١٫٧٥ ونهايات دائرية، وترث لون النصّ. الحجم
 * والسماكة يُضبطان من الخاصيّات، فتبقى الأيقونة متّسقة في كل مقاس.
 */

interface Props {
  size?: number
  stroke?: number
  className?: string
  style?: React.CSSProperties
}

function Svg({ size = 20, stroke = 1.75, children, style, className }: Props & {
  children: React.ReactNode
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0, ...style }}
      aria-hidden
    >
      {children}
    </svg>
  )
}

export const Icon = {
  home: (p: Props) => (
    <Svg {...p}><path d="M3 10.2 12 3.5l9 6.7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z" /></Svg>
  ),
  sparkle: (p: Props) => (
    <Svg {...p}>
      <path d="M12 3.2 13.7 9l5.8 1.7-5.8 1.7L12 18.2 10.3 12.4 4.5 10.7 10.3 9Z" />
      <path d="M18.5 3.5v3M20 5h-3" />
    </Svg>
  ),
  list: (p: Props) => (
    <Svg {...p}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </Svg>
  ),
  mosque: (p: Props) => (
    <Svg {...p}>
      <path d="M12 2.5c2.6 2 4 3.7 4 5.5H8c0-1.8 1.4-3.5 4-5.5Z" />
      <path d="M4 21v-7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7" />
      <path d="M2.5 21h19M9.5 21v-4a2.5 2.5 0 0 1 5 0v4" />
    </Svg>
  ),
  cloud: (p: Props) => (
    <Svg {...p}>
      <path d="M7.5 19h9.3a3.7 3.7 0 0 0 .4-7.4 5.6 5.6 0 0 0-10.8-1A4.2 4.2 0 0 0 7.5 19Z" />
    </Svg>
  ),
  news: (p: Props) => (
    <Svg {...p}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h10A1.5 1.5 0 0 1 17 5.5V18a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2Z" />
      <path d="M19 20a2 2 0 0 0 2-2V9.5A1.5 1.5 0 0 0 19.5 8H17" />
      <path d="M7.5 8h6M7.5 11.5h6M7.5 15h3.5" />
    </Svg>
  ),
  grid: (p: Props) => (
    <Svg {...p}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </Svg>
  ),
  brain: (p: Props) => (
    <Svg {...p}>
      <path d="M9.5 3.5A3 3 0 0 0 6.6 6 2.8 2.8 0 0 0 5 11.3 3 3 0 0 0 6.8 16a3 3 0 0 0 5.2 2V4.8a2.6 2.6 0 0 0-2.5-1.3Z" />
      <path d="M14.5 3.5A3 3 0 0 1 17.4 6 2.8 2.8 0 0 1 19 11.3 3 3 0 0 1 17.2 16a3 3 0 0 1-5.2 2" />
    </Svg>
  ),
  settings: (p: Props) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.1 14.4a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a1.9 1.9 0 1 1-3.8 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a1.9 1.9 0 1 1 0-3.8h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5v-.3a1.9 1.9 0 1 1 3.8 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a1.9 1.9 0 1 1 0 3.8h-.2a1.6 1.6 0 0 0-1.5 1Z" />
    </Svg>
  ),
  mic: (p: Props) => (
    <Svg {...p}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5" />
    </Svg>
  ),
  send: (p: Props) => (
    <Svg {...p}><path d="M20.5 3.5 10.8 13.2M20.5 3.5l-6.2 17-3.5-7.3-7.3-3.5Z" /></Svg>
  ),
  stop: (p: Props) => (
    <Svg {...p}><rect x="6.5" y="6.5" width="11" height="11" rx="2.5" /></Svg>
  ),
  plus: (p: Props) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  refresh: (p: Props) => (
    <Svg {...p}>
      <path d="M20.5 11.5a8.5 8.5 0 1 1-2.6-6.1" />
      <path d="M20.5 3.8v5h-5" />
    </Svg>
  ),
  clock: (p: Props) => (
    <Svg {...p}><circle cx="12" cy="12" r="8.75" /><path d="M12 7v5.2l3.3 2" /></Svg>
  ),
  history: (p: Props) => (
    <Svg {...p}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 3.8v5h5" />
      <path d="M12 7.5v5l3 1.8" />
    </Svg>
  ),
  check: (p: Props) => <Svg {...p}><path d="M4.5 12.5 9.5 17.5 19.5 6.5" /></Svg>,
  close: (p: Props) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>,
  chevron: (p: Props) => <Svg {...p}><path d="M14.5 5.5 8 12l6.5 6.5" /></Svg>,
  search: (p: Props) => (
    <Svg {...p}><circle cx="10.8" cy="10.8" r="6.8" /><path d="M15.8 15.8 21 21" /></Svg>
  ),
  pin: (p: Props) => (
    <Svg {...p}>
      <path d="M12 21.5s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Z" />
      <circle cx="12" cy="10.5" r="2.6" />
    </Svg>
  ),
  compass: (p: Props) => (
    <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5Z" /></Svg>
  ),
  key: (p: Props) => (
    <Svg {...p}>
      <circle cx="8" cy="15.5" r="4.5" />
      <path d="m11.3 12.3 8.2-8.2M16.5 7l2.5 2.5M14 9.5 16.5 12" />
    </Svg>
  ),
  speaker: (p: Props) => (
    <Svg {...p}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4Z" />
      <path d="M16 9.2a4 4 0 0 1 0 5.6M18.8 6.4a8 8 0 0 1 0 11.2" />
    </Svg>
  ),
  mute: (p: Props) => (
    <Svg {...p}>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4Z" />
      <path d="m16.5 9.5 4.5 5M21 9.5l-4.5 5" />
    </Svg>
  ),
  download: (p: Props) => (
    <Svg {...p}><path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5M4.5 20h15" /></Svg>
  ),
  lock: (p: Props) => (
    <Svg {...p}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </Svg>
  ),
  sun: (p: Props) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4" />
    </Svg>
  ),
  bolt: (p: Props) => (
    <Svg {...p}><path d="M13.5 2.5 4.5 13.5h6l-1 8 9-11h-6Z" /></Svg>
  ),
}

export type IconName = keyof typeof Icon

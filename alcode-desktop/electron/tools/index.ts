import { appTools } from './apps'
import { automationTools } from './automation'
import { dailyTools } from './daily'
import { fileTools } from './files'
import { inputTools } from './input'
import { personalTools } from './personal'
import { screenTools } from './screen'
import { systemTools } from './system'
import { windowTools } from './windows'
import { ToolSpec } from './types'

/** كل ما يستطيع المساعد فعله على هذا الجهاز. */
export const allTools: ToolSpec[] = [
  ...systemTools,
  ...appTools,
  ...windowTools,
  ...inputTools,
  ...screenTools,
  ...fileTools,
  ...automationTools,
  ...personalTools,
  ...dailyTools,
]

export function toolByName(name: string): ToolSpec | undefined {
  return allTools.find((t) => t.name === name)
}

/** تعريفات الأدوات بالصيغة التي تفهمها واجهة Anthropic. */
export function toolsForApi(): Array<Record<string, unknown>> {
  return allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties: tool.input,
      required: tool.required ?? [],
      additionalProperties: false,
    },
  }))
}

/** ملخّص للعرض في شاشة القدرات. */
export function toolGroups(): { group: string; tools: { name: string; description: string; danger: string }[] }[] {
  const map = new Map<string, { name: string; description: string; danger: string }[]>()
  for (const tool of allTools) {
    const list = map.get(tool.group) ?? []
    list.push({ name: tool.name, description: tool.description, danger: tool.danger })
    map.set(tool.group, list)
  }
  return [...map.entries()].map(([group, tools]) => ({ group, tools }))
}

export type { ToolSpec } from './types'

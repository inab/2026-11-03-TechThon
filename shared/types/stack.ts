/** One layer of the request's path, shown in the stack on the protected page. */
export interface StackLayer {
  id: string
  title: string
  /** One line for the label next to the plate. */
  short: string
  /** What happens at this layer, in full (shown in the detail card). */
  description: string
  /** Not on the request's path (drawn dashed). */
  side?: boolean
  /** Nesting: 1 = inside the layer above, 2 = inside that one (drawn smaller). */
  depth?: number
  /** time: value is an ISO date, shown as local time plus "3 min ago". */
  items: { label: string, value: string, time?: boolean }[]
}

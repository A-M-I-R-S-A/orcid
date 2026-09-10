const HEADING_RE = /<(h[2-4])\b[^>]*>([\s\S]*?)<\/\1>/gi

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqGroup {
  title: string | null
  intro: string
  items: FaqItem[]
}

export interface FaqDocument {
  intro: string
  groups: FaqGroup[]
}

interface Mark {
  level: number
  text: string
  start: number
  end: number
}

export function toPlainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value.replace(/&(?:amp|lt|gt|quot|apos|nbsp|#39);/g, (entity) => ENTITIES[entity] ?? entity)
}

function marksOf(html: string): Mark[] {
  const out: Mark[] = []

  for (const match of html.matchAll(HEADING_RE)) {
    const start = match.index ?? 0
    out.push({
      level: Number(match[1]!.slice(1)),
      text: toPlainText(match[2]!),
      start,
      end: start + match[0].length,
    })
  }

  return out
}

export function parseFaq(html: string): FaqDocument {
  const source = html.trim()
  const marks = marksOf(source)

  if (marks.length === 0) return { intro: source, groups: [] }

  const grouped = marks.some((m) => m.level === 2) && marks.some((m) => m.level === 3)
  const questionLevel = grouped ? 3 : marks[0]!.level
  const relevant = marks.filter((m) => m.level === questionLevel || (grouped && m.level === 2))

  const groups: FaqGroup[] = []
  let current: FaqGroup = { title: null, intro: '', items: [] }

  const flush = () => {
    if (current.items.length > 0 || current.title) groups.push(current)
  }

  relevant.forEach((mark, index) => {
    const next = relevant[index + 1]
    const body = source.slice(mark.end, next ? next.start : source.length).trim()

    if (grouped && mark.level === 2) {
      flush()
      current = { title: mark.text, intro: body, items: [] }
      return
    }

    if (mark.text) current.items.push({ question: mark.text, answer: body })
  })

  flush()

  return {
    intro: source.slice(0, relevant[0]!.start).trim(),
    groups: groups.filter((group) => group.items.length > 0),
  }
}

export function splitLead(html: string): { lead: string; rest: string } {
  const source = html.trim()
  const match = /^<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(source)

  if (!match) return { lead: '', rest: source }

  const lead = toPlainText(match[1]!)
  if (!lead) return { lead: '', rest: source }

  return { lead, rest: source.slice(match[0].length).trim() }
}

export function excerpt(html: string, limit = 180): string {
  const text = toPlainText(html)
  if (text.length <= limit) return text

  const cut = text.slice(0, limit)
  const boundary = cut.lastIndexOf(' ')
  return `${(boundary > limit * 0.6 ? cut.slice(0, boundary) : cut).trimEnd()}…`
}

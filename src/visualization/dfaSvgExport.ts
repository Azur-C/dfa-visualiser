import type { DFA, StateID } from "../dfa-core/types"
import { formatSymbolsForDisplay, type AutomatonInputMode } from "../symbolic/predicateSyntax"
import { dfaToReactFlow } from "./dfaToReactFlow"
import { DFA_NODE_SIZE } from "../components/DfaNode"

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

export function createDfaSvg(
  dfa: DFA,
  automatonMode: AutomatonInputMode
): { svg: string; width: number; height: number } {
  const stateCount = Math.max(dfa.states.size, 1)
  const layoutRadius = Math.max(220, stateCount * 12)
  const layoutCenter = { x: layoutRadius + 120, y: layoutRadius + 120 }
  const { nodes, edges } = dfaToReactFlow(dfa, {
    radius: layoutRadius,
    center: layoutCenter,
  })
  const nodeRadius = DFA_NODE_SIZE / 2
  const padding = 120
  const centers = new Map<StateID, { x: number; y: number; label: string; isAccept: boolean; isStart: boolean }>()

  for (const node of nodes) {
    if (!node.data?.stateId) continue
    centers.set(node.data.stateId, {
      x: node.position.x + nodeRadius,
      y: node.position.y + nodeRadius,
      label: node.data.label,
      isAccept: Boolean(node.data.isAccept),
      isStart: Boolean(node.data.isStart),
    })
  }

  const xs = Array.from(centers.values()).flatMap((center) => [center.x - nodeRadius, center.x + nodeRadius])
  const ys = Array.from(centers.values()).flatMap((center) => [center.y - nodeRadius, center.y + nodeRadius])
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding
  const width = Math.ceil(maxX - minX)
  const height = Math.ceil(maxY - minY)
  const acceptColor = "#2f9e44"

  const edgeMarkup = edges
    .map((edge) => {
      const source = centers.get(edge.source as StateID)
      const target = centers.get(edge.target as StateID)
      if (!source || !target) return ""

      const symbols = edge.data?.symbols ?? []
      const label = formatSymbolsForDisplay(symbols, automatonMode)
      let path = ""
      let labelX = 0
      let labelY = 0

      if (edge.source === edge.target) {
        const startX = source.x - 12
        const startY = source.y - nodeRadius
        const endX = source.x + 12
        const endY = source.y - nodeRadius
        const control1X = source.x - 76
        const control1Y = source.y - nodeRadius - 70
        const control2X = source.x + 76
        const control2Y = source.y - nodeRadius - 70
        path = `M ${startX} ${startY} C ${control1X} ${control1Y} ${control2X} ${control2Y} ${endX} ${endY}`
        labelX = source.x
        labelY = source.y - nodeRadius - 74
      } else {
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.hypot(dx, dy)
        if (dist === 0) return ""

        const ux = dx / dist
        const uy = dy / dist
        const sx = source.x + ux * nodeRadius
        const sy = source.y + uy * nodeRadius
        const tx = target.x - ux * nodeRadius
        const ty = target.y - uy * nodeRadius
        const mx = (sx + tx) / 2
        const my = (sy + ty) / 2
        const nx = -uy
        const ny = ux
        const curveFactor = 0.2
        const cx = mx + nx * dist * curveFactor
        const cy = my + ny * dist * curveFactor

        path = `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`
        labelX = 0.25 * sx + 0.5 * cx + 0.25 * tx
        labelY = 0.25 * sy + 0.5 * cy + 0.25 * ty
      }

      const labelWidth = Math.max(24, Math.min(240, label.length * 7 + 12))
      const labelHeight = 18

      return `
        <path d="${path}" fill="none" stroke="#111827" stroke-width="2" marker-end="url(#arrow)" />
        ${
          label
            ? `<g>
                <rect x="${labelX - labelWidth / 2}" y="${labelY - labelHeight / 2}" width="${labelWidth}" height="${labelHeight}" rx="4" fill="#ffffff" fill-opacity="0.94" stroke="#e5e7eb" />
                <text x="${labelX}" y="${labelY + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#111827">${escapeXml(label)}</text>
              </g>`
            : ""
        }
      `
    })
    .join("")

  const nodeMarkup = Array.from(centers.values())
    .map((node) => {
      const labelFontSize = node.label.length > 8 ? 11 : 12
      const startArrow = node.isStart
        ? `<path d="M ${node.x - nodeRadius - 38} ${node.y} L ${node.x - nodeRadius - 8} ${node.y - 16} L ${node.x - nodeRadius - 8} ${node.y + 16} Z" fill="#3da9fc" />`
        : ""
      const innerAccept = node.isAccept
        ? `<circle cx="${node.x}" cy="${node.y}" r="${nodeRadius - 7}" fill="none" stroke="${acceptColor}" stroke-width="2" />`
        : ""

      return `
        <g>
          ${startArrow}
          <circle cx="${node.x}" cy="${node.y}" r="${nodeRadius}" fill="#fff" stroke="${node.isAccept ? acceptColor : "#111827"}" stroke-width="2" />
          ${innerAccept}
          <text x="${node.x}" y="${node.y + 4}" text-anchor="middle" font-size="${labelFontSize}" font-weight="600" fill="#111827">${escapeXml(node.label)}</text>
        </g>
      `
    })
    .join("")

  const title = escapeXml(dfa.meta?.name ?? "DFA")
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${minX} ${minY} ${width} ${height}" role="img" aria-label="${title}">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#111827" />
    </marker>
  </defs>
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#f8fafc" />
  ${edgeMarkup}
  ${nodeMarkup}
</svg>
`

  return { svg, width, height }
}

export function convertSvgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      const maxDimension = Math.max(width, height)
      const scale = Math.max(1, Math.min(2, 4096 / maxDimension))
      const canvas = document.createElement("canvas")
      canvas.width = Math.ceil(width * scale)
      canvas.height = Math.ceil(height * scale)

      const context = canvas.getContext("2d")
      if (!context) {
        reject(new Error("Unable to create a canvas for PNG export."))
        return
      }

      context.fillStyle = "#f8fafc"
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error("Unable to create PNG file."))
      }, "image/png")
    }

    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Unable to render SVG for PNG export."))
    }

    image.src = url
  })
}

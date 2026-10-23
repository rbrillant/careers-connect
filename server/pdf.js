/**
 * Minimal PDF writer.
 *
 * Generates a valid single-purpose PDF without pulling in a large dependency.
 * It supports what a consent record needs: a title, paragraphs, and a
 * two-column list of label/value rows. Text is escaped and wrapped, and every
 * page uses the built-in Helvetica font.
 *
 * Output is a Buffer of PDF bytes.
 */

const PAGE_WIDTH = 595.28 // A4 at 72dpi
const PAGE_HEIGHT = 841.89
const MARGIN = 56
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2
const LINE_HEIGHT = 16
const BOTTOM_LIMIT = MARGIN

// Rough width estimate for Helvetica at a given size. PDF has no built-in
// text metrics accessible here, so we approximate: average glyph ≈ 0.5em for
// regular text, ≈ 0.55em for bold. Good enough for wrapping prose.
const AVG_GLYPH = 0.5
const SHEET_FONT_SIZE = 11

function escapeText(text) {
  return String(text ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    // Non-Latin-1 characters are not representable in the built-in fonts.
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?')
}

function measure(text, size, bold) {
  return String(text).length * size * (bold ? AVG_GLYPH * 1.1 : AVG_GLYPH)
}

function wrap(text, size, maxWidth, bold) {
  const words = String(text).split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']

  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (measure(candidate, size, bold) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/**
 * @param {object} doc
 * @param {string} doc.title
 * @param {Array<{heading?: string, text?: string}>} doc.blocks  Flowing content
 * @param {Array<[string, string]>} doc.fields                   Label/value rows
 */
export function buildPdf(doc) {
  const ops = []
  let y = PAGE_HEIGHT - MARGIN

  const ensureSpace = (needed) => {
    if (y - needed < BOTTOM_LIMIT) {
      ops.push('0 0 0 RG 0.5 w')
      y = BOTTOM_LIMIT
    }
  }

  const writeLine = (text, { size = SHEET_FONT_SIZE, bold = false, gapBefore = 0, gapAfter = 0 } = {}) => {
    const lines = wrap(text, size, CONTENT_WIDTH, bold)
    ensureSpace(gapBefore + lines.length * LINE_HEIGHT + gapAfter)
    y -= gapBefore
    for (const line of lines) {
      y -= LINE_HEIGHT
      ops.push(
        `BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(line)}) Tj ET`
      )
    }
    y -= gapAfter
  }

  const rule = () => {
    ensureSpace(12)
    y -= 12
    ops.push(`0.75 0.75 0.75 RG 0.75 w ${MARGIN} ${y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(2)} ${y.toFixed(2)} l S`)
    y -= 6
  }

  // ---- Title ----------------------------------------------------------
  writeLine(doc.title, { size: 18, bold: true, gapAfter: 4 })
  rule()

  // ---- Flowing blocks -------------------------------------------------
  for (const block of doc.blocks || []) {
    if (block.heading) writeLine(block.heading, { size: 12, bold: true, gapBefore: 8, gapAfter: 2 })
    if (block.text) writeLine(block.text, { gapAfter: 2 })
  }

  // ---- Field rows -----------------------------------------------------
  if (doc.fields?.length) {
    writeLine('Consent record', { size: 12, bold: true, gapBefore: 16, gapAfter: 4 })

    const labelWidth = 170
    for (const [label, value] of doc.fields) {
      const valueLines = wrap(value ?? '', SHEET_FONT_SIZE, CONTENT_WIDTH - labelWidth, false)
      ensureSpace(valueLines.length * LINE_HEIGHT + 4)
      const rowTop = y
      // Label
      y = rowTop
      y -= LINE_HEIGHT
      ops.push(
        `BT /F2 ${SHEET_FONT_SIZE} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(label)}) Tj ET`
      )
      // Value (may wrap onto several lines)
      let valueY = rowTop
      for (const line of valueLines) {
        valueY -= LINE_HEIGHT
        ops.push(
          `BT /F1 ${SHEET_FONT_SIZE} Tf 1 0 0 1 ${MARGIN + labelWidth} ${valueY.toFixed(2)} Tm (${escapeText(line)}) Tj ET`
        )
      }
      y = Math.min(y, valueY)
    }
  }

  // ---- Signature line -------------------------------------------------
  if (doc.signature) {
    ensureSpace(60)
    y -= 36
    ops.push(`0 0 0 RG 0.75 w ${MARGIN} ${(y - 4).toFixed(2)} m ${(MARGIN + 260).toFixed(2)} ${(y - 4).toFixed(2)} l S`)
    y -= 20
    ops.push(
      `BT /F1 ${SHEET_FONT_SIZE} Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(doc.signature)}) Tj ET`
    )
    y -= LINE_HEIGHT
    ops.push(
      `BT /F1 9 Tf 1 0 0 1 ${MARGIN} ${y.toFixed(2)} Tm (${escapeText(doc.signatureCaption || 'Signature')}) Tj ET`
    )
  }

  // ---- Footer ---------------------------------------------------------
  const footer = doc.footer ? escapeText(doc.footer) : ''
  if (footer) {
    ops.push(
      `BT /F1 8 Tf 1 0 0 1 ${MARGIN} ${(MARGIN - 20).toFixed(2)} Tm (${footer}) Tj ET`
    )
  }

  return assemble(ops)
}

function assemble(ops) {
  const content = ops.join('\n')
  const contentLength = Buffer.byteLength(content, 'latin1')

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
  ]

  let pdf = '%PDF-1.4\n'
  const offsets = []
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'))
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'latin1')
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, 'latin1')
}

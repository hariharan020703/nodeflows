// Minimal ZIP writer, store-only (no compression), in plain ArrayBuffer work with no dependency.
//
// NOTE: `jszip` is declared in package.json and installed. This file predates that and does not use
// it — if you would rather have the library, `makeZip` collapses to a few lines
// (`new JSZip()`, `.file(name, text)`, `.generateAsync({ type: 'blob' })`) and this whole module can
// go. Both work; keeping two is the only wrong answer. Left as-is because it is verified end to end
// (archives generated here open in Windows Explorer with the right names and contents).
//
// Store-only is a deliberate trade: these are small JSON files, and a stored entry is a valid zip
// every tool can open. If the payloads ever get large enough that size matters, this is where a
// DEFLATE pass (or CompressionStream) would go.

// Standard CRC-32 (IEEE 802.3), table built once on first use.
let CRC_TABLE = null
function crcTable() {
  if (CRC_TABLE) return CRC_TABLE
  CRC_TABLE = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    CRC_TABLE[i] = c >>> 0
  }
  return CRC_TABLE
}

function crc32(bytes) {
  const t = crcTable()
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = t[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Zip stores modification time as two packed 16-bit DOS fields, 2-second resolution.
function dosStamp(d) {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  }
}

// files: [{ name, text }] — name is the entry name inside the archive, kept exactly as given so
// the archive holds the original filenames.
export function makeZip(files) {
  const enc = new TextEncoder()
  const { time, date } = dosStamp(new Date())
  const parts = []
  const central = []
  let offset = 0

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const data = enc.encode(f.text)
    const crc = crc32(data)

    // Local file header: 30 fixed bytes, then the name.
    const local = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true) // signature
    lv.setUint16(4, 20, true) // version needed
    lv.setUint16(6, 0x0800, true) // flags: UTF-8 names
    lv.setUint16(8, 0, true) // method 0 = stored
    lv.setUint16(10, time, true)
    lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, data.length, true) // compressed size == raw size when stored
    lv.setUint32(22, data.length, true)
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // no extra field
    local.set(nameBytes, 30)

    // Central directory entry: 46 fixed bytes, then the name. Points back at the local header.
    const cd = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(cd.buffer)
    cv.setUint32(0, 0x02014b50, true)
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true)
    cv.setUint16(12, time, true)
    cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, data.length, true)
    cv.setUint32(24, data.length, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint32(42, offset, true) // offset of this entry's local header
    cd.set(nameBytes, 46)

    parts.push(local, data)
    central.push(cd)
    offset += local.length + data.length
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, files.length, true) // entries on this disk
  ev.setUint16(10, files.length, true) // entries total
  ev.setUint32(12, cdSize, true)
  ev.setUint32(16, offset, true) // where the central directory starts
  return new Blob([...parts, ...central, end], { type: 'application/zip' })
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoked on the next tick rather than immediately: Safari cancels an in-flight download if the
  // URL is released in the same task as the click.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

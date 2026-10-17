export function looksBinary(buf: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 8192))
  if (head.includes(0)) return true
  let suspicious = 0
  const n = Math.min(head.length, 2048)
  for (let i = 0; i < n; i++) {
    const b = head.readUInt8(i)
    if (b < 9 || (b > 13 && b < 32)) suspicious++
  }
  return n > 0 && suspicious / n > 0.08
}

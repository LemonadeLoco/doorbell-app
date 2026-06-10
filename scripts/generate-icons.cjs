const sharp = require('sharp')
const path  = require('path')
const fs    = require('fs')

const svg = `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="112" fill="#F59E0B"/>
  <path d="M256 82 L432 218 L432 418 L80 418 L80 218 Z"
        fill="none" stroke="white" stroke-width="30"
        stroke-linejoin="round" stroke-linecap="round"/>
  <rect x="135" y="315" width="66" height="103" rx="9" fill="#FDE68A"/>
  <rect x="223" y="268" width="66" height="150" rx="9" fill="white"/>
  <rect x="311" y="289" width="66" height="129" rx="9" fill="#FDE68A"/>
</svg>`

const dir = path.join(__dirname, '..', 'public', 'icons')
fs.mkdirSync(dir, { recursive: true })

async function run() {
  for (const size of [192, 512]) {
    await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(dir, `icon-${size}.png`))
    console.log(`icon-${size}.png done`)
  }
}
run().catch(console.error)

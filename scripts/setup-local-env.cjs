const fs = require('node:fs')
const crypto = require('node:crypto')
if (!fs.existsSync('.env')) {
  let text = fs.readFileSync('.env.example', 'utf8')
  text = text.replace('replace-with-random-secret', crypto.randomBytes(48).toString('hex'))
  text = text.replace('replace-with-random-password', crypto.randomBytes(24).toString('hex'))
  fs.writeFileSync('.env', text)
  console.log('Created .env with generated local secrets. Do not commit this file.')
} else console.log('Kept existing .env.')

const fs = require('fs');
const code = fs.readFileSync('/app/.next/server/app/api/applications/[id]/deploy/route.js', 'utf8');
const idx = code.indexOf('Performing Zero-Downtime Health Check');
if (idx > -1) {
  console.log(code.substring(idx - 100, idx + 1000));
}

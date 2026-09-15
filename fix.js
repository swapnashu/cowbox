const fs = require('fs');
let code = fs.readFileSync('src/app/api/files/route.ts', 'utf8');
code = code.replace(/message: \\\\File \\\\ saved successfully\\\\/, 'message:  + 'File  saved successfully' + ');
code = code.replace(/message: \\\\Deleted \\\\/, 'message:  + 'Deleted ' + ');
code = code.replace(/message: \\\\Copied to \\\\/, 'message:  + 'Copied to ' + ');
code = code.replace(/message: \\\\Renamed to \\\\/, 'message:  + 'Renamed to ' + ');
fs.writeFileSync('src/app/api/files/route.ts', code);


const app = require('./service.js');

const fs = require('fs');
const path = require('path');

console.log('=== DEBUG START ===');
console.log('Process CWD:', process.cwd());
console.log('__dirname:', __dirname);
console.log('All files in CWD:', fs.readdirSync('.'));
console.log('Config exists in CWD:', fs.existsSync('./config.js'));
console.log('Config exists absolute:', fs.existsSync(path.join(process.cwd(), 'config.js')));
console.log('Config content:', fs.existsSync('./config.js') ? fs.readFileSync('./config.js', 'utf8').substring(0, 200) : 'MISSING');
console.log('=== DEBUG END ===');


const port = process.argv[2] || 3000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});

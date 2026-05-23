// Wrapper to fix Vercel CLI issue with non-ASCII hostname in HTTP headers
const os = require('os');
os.hostname = () => 'my-pc';

// Forward CLI args: node vercel-wrapper.js [vercel-args...]
process.argv = ['node', 'vercel', ...process.argv.slice(2)];
require('./node_modules/vercel/dist/index.js');

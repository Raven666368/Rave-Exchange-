const { spawn } = require('child_process');
const fs = require('fs');

const out = fs.openSync('./backend.log', 'a');
const err = fs.openSync('./backend.log', 'a');

const env = Object.assign({}, process.env, { PYTHONPATH: './backend' });
const subprocess = spawn('python3', ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8080'], {
  detached: true,
  env: env,
  stdio: [ 'ignore', out, err ]
});

subprocess.unref();
console.log('Backend started in background. PID:', subprocess.pid);

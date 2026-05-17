const { spawn } = require('child_process');
const fs = require('fs');

const env = Object.assign({}, process.env, { PYTHONPATH: 'backend' });

// Start Python backend
const py = spawn('python3', ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', '8080'], {
  env: env,
  stdio: 'inherit'
});

py.on('error', (e) => {
  console.error("Backend error:", e);
});

// Start Angular Dev Server
const ng = spawn('npx', ['cross-env', 'ng', 'serve', '--port=3000', '--host=0.0.0.0', '--allowed-hosts', `--define=GEMINI_API_KEY='${process.env.GEMINI_API_KEY}'`, ...(process.env.DISABLE_HMR ? ['--live-reload=false'] : [])], {
  env: process.env,
  stdio: 'inherit'
});

ng.on('error', (e) => {
  console.error("Frontend error:", e);
});

process.on('SIGINT', () => {
    py.kill();
    ng.kill();
    process.exit();
});

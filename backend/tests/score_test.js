import { io } from 'socket.io-client';

function timeout(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function run() {
  console.log('Starting @score integration test');
  const socket = io('http://localhost:3001', { path: '/socket.io', reconnection: false, timeout: 5000 });

  const messages = [];

  socket.on('connect', () => console.log('connected to backend'));
  socket.on('connect_error', (err) => console.error('connect_error', err && err.message ? err.message : err));

  socket.on('chat', (line) => {
    console.log('chat event:', line);
    messages.push(String(line));
  });

  // Wait for welcome
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (messages.length > 0) break;
    await timeout(200);
  }

  if (messages.length === 0) {
    console.error('No welcome message from server');
    socket.close();
    process.exitCode = 2;
    return;
  }

  console.log('emitting @score');
  socket.emit('chat', '@score');

  const waitStart = Date.now();
  let found = false;
  while (Date.now() - waitStart < 8000) {
    if (messages.some(m => /under development/.test(m) || /under develop/.test(m))) { found = true; break; }
    await timeout(200);
  }

  socket.close();

  if (found) {
    console.log('Score test passed: saw development placeholder');
    process.exitCode = 0;
  } else {
    console.error('Score test FAILED: placeholder not seen');
    process.exitCode = 3;
  }
}

run().catch((e) => { console.error('Test errored', e); process.exitCode = 1; });

import { io } from 'socket.io-client';

function timeout(ms) { return new Promise((res) => setTimeout(res, ms)); }

async function run() {
  console.log('Starting socket.io integration test');
  const socket = io('http://localhost:3001', { path: '/socket.io', reconnection: false, timeout: 5000 });

  const messages = [];

  socket.on('connect', () => console.log('connected to backend'));
  socket.on('connect_error', (err) => {
    console.error('connect_error', err && err.message ? err.message : err);
  });

  socket.on('chat', (line) => {
    console.log('chat event:', line);
    messages.push(String(line));
  });

  // Wait for a short time for welcome message
  const start = Date.now();
  while (Date.now() - start < 8000) {
    if (messages.length > 0) break;
    await timeout(200);
  }

  if (messages.length === 0) {
    console.error('No welcome/chat messages received from server');
    socket.close();
    process.exitCode = 2;
    return;
  }

  // Send a chat message and expect an echo
  const testMsg = 'integration-test hello ' + Math.floor(Math.random()*1000);
  console.log('emitting chat:', testMsg);
  socket.emit('chat', testMsg);

  const waitStart = Date.now();
  let found = false;
  while (Date.now() - waitStart < 8000) {
    if (messages.some(m => m.includes(testMsg))) { found = true; break; }
    await timeout(200);
  }

  socket.close();

  if (found) {
    console.log('Integration test passed: saw echoed message');
    process.exitCode = 0;
  } else {
    console.error('Integration test FAILED: did not see echoed message');
    console.error('Messages received:', messages.slice(-10));
    process.exitCode = 3;
  }
}

run().catch((e) => { console.error('Test errored', e); process.exitCode = 1; });

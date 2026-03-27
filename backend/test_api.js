const fetch = require('node-fetch');

async function pollUntilLive() {
  const url = 'https://wishflow-backend-uyd2.onrender.com/api/integrations/whatsapp/pair-phone';
  console.log('Polling live Render server for new deployment...\n');

  for (let i = 1; i <= 20; i++) {
    console.log(`[Poll ${i}/20] ${new Date().toLocaleTimeString()}`);
    const t = Date.now();
    try {
      const res  = await fetch(url, {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ userId: `poll-${i}`, phoneNumber: '919817203207' })
      });
      const data = await res.json();
      const ms = Date.now() - t;
      console.log(`  Status=${res.status} in ${ms}ms`);
      console.log(`  Body=${JSON.stringify(data)}\n`);

      if (data.pairingCode) {
        console.log('\n✅ SUCCESS! Live server is running new code!');
        console.log('Pairing code for 919817203207 :', data.pairingCode);
        return;
      } else if (data.message && data.message.includes('Pairing process started')) {
        console.log('  ⏳ Old code still running. Waiting 30s...\n');
        await new Promise(r => setTimeout(r, 30000));
      } else if (data.error) {
        console.log('  Backend error:', data.error, '— New code is live but had an error.\n');
        return;
      } else {
        await new Promise(r => setTimeout(r, 15000));
      }
    } catch(e) {
      console.log('  ❌ Fetch error (server may be restarting):', e.message, '\n');
      await new Promise(r => setTimeout(r, 20000));
    }
  }
}

pollUntilLive();

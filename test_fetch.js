const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 1500);
fetch('http://172.18.0.19:8089/?t=' + Date.now(), { signal: controller.signal, cache: 'no-store' })
  .then(r => console.log('STATUS:', r.status))
  .catch(e => console.error('ERROR:', e.message));

import { readFile } from 'node:fs/promises';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Missing configuration: ' + name);
  return value;
}

const scriptId = required('APPS_SCRIPT_ID');
const deploymentId = required('APPS_SCRIPT_DEPLOYMENT_ID');
const source = await readFile(new URL('./Counter.html', import.meta.url), 'utf8');
const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: required('GOOGLE_CLIENT_ID'),
    client_secret: required('GOOGLE_CLIENT_SECRET'),
    refresh_token: required('GOOGLE_REFRESH_TOKEN'),
  }),
});
if (!tokenResponse.ok) throw new Error('Google OAuth failed: HTTP ' + tokenResponse.status);
const { access_token: token } = await tokenResponse.json();

async function request(path, method = 'GET', body) {
  const response = await fetch('https://script.googleapis.com/v1/projects/' +
    encodeURIComponent(scriptId) + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(method + ' ' + path + ': HTTP ' + response.status);
  return response.json();
}

const deploymentPath = '/deployments/' + encodeURIComponent(deploymentId);
const { deploymentConfig: config, entryPoints } = await request(deploymentPath);
if (!entryPoints?.some(entry => entry.webApp?.entryPointConfig?.access === 'MYSELF')) {
  throw new Error('Expected the private Counter web app deployment.');
}
const { files } = await request('/content');
const counter = files.find(file => file.name === 'Counter' && file.type === 'HTML');
if (!counter) throw new Error('Counter.html is missing in Apps Script.');
await request('/content', 'PUT', {
  files: files.map(({ name, type, source: existing }) => ({
    name, type, source: name === 'Counter' ? source : existing,
  })),
});
const { versionNumber } = await request('/versions', 'POST', { description: 'Counter form' });
await request(deploymentPath, 'PUT', {
  deploymentConfig: {
    scriptId,
    versionNumber,
    manifestFileName: config.manifestFileName,
    description: config.description,
  },
});
console.log('Counter deployed as Apps Script version ' + versionNumber);

const http = require('http');
const fs = require('fs');
const path = require('path');
const { createOAuthClient } = require('./google-drive');

const PORT = 3002;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;
const ENV_FILE = path.resolve('.env');
const auth = createOAuthClient(REDIRECT_URI);
const url = auth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/drive'],
});

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, REDIRECT_URI);
  if (requestUrl.pathname !== '/oauth2callback' || !requestUrl.searchParams.get('code')) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const { tokens } = await auth.getToken(requestUrl.searchParams.get('code'));
    if (!tokens.refresh_token) throw new Error('No refresh token returned. Remove Cretile access from your Google Account and run this command again.');
    const current = fs.readFileSync(ENV_FILE, 'utf8');
    const next = current.match(/^GOOGLE_OAUTH_REFRESH_TOKEN=/m)
      ? current.replace(/^GOOGLE_OAUTH_REFRESH_TOKEN=.*$/m, `GOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}`)
      : `${current.trim()}\nGOOGLE_OAUTH_REFRESH_TOKEN=${tokens.refresh_token}\n`;
    fs.writeFileSync(ENV_FILE, next);
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<h1>Google Drive connected.</h1><p>You can close this tab and return to Terminal.</p>');
    console.log('Google Drive connected. Your refresh token has been saved securely in .env.');
  } catch (error) {
    response.writeHead(500).end('Authorization failed. Check the Terminal window.');
    console.error(error.message);
  } finally {
    setTimeout(() => server.close(), 500);
  }
});

server.listen(PORT, () => {
  console.log('Open this link in your browser, choose your Google account, and allow Drive access:');
  console.log(url);
});

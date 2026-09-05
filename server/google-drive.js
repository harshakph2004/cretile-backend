const { readFileSync } = require('fs');
const path = require('path');
const { google } = require('googleapis');

function clientDetails() {
  const file = process.env.GOOGLE_OAUTH_CLIENT_FILE;
  if (!file) throw new Error('Set GOOGLE_OAUTH_CLIENT_FILE in .env.');
  const config = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  return config.installed || config.web;
}

function createOAuthClient(redirectUri) {
  const details = clientDetails();
  return new google.auth.OAuth2(
    details.client_id,
    details.client_secret,
    redirectUri || details.redirect_uris?.[0] || 'http://localhost',
  );
}

function createDriveClient() {
  if (!process.env.GOOGLE_OAUTH_REFRESH_TOKEN) {
    throw new Error('Google Drive has not been authorized. Run npm run authorize-drive first.');
  }
  const auth = createOAuthClient();
  auth.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth });
}

module.exports = { createDriveClient, createOAuthClient };

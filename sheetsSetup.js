require('dotenv').config();
const { getNewToken } = require ('./lib/apiForSheets');
const { OAuth2Client } = require('google-auth-library');
(function() {
  const credentials = JSON.parse(process.env.CLIENT_SECRET);
  var clientSecret = credentials.installed.client_secret;
  var clientId = credentials.installed.client_id;
  var redirectUrl = credentials.installed.redirect_uris[0];
  var oauth2Client = new OAuth2Client(clientId, clientSecret, redirectUrl);
  getNewToken(oauth2Client, function(token) {
    // Logs new sheets access token.
    console.log('Access Token: ', JSON.stringify(token));
  });
})();

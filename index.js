module.exports = (robot) => {
  var apiForSheets = function(userName, context, isPullRequest) {
    var claLabel = ['Needs CLA'];
    var hasUserSignedCla = false;
    var spreadsheetId = process.env.SPREADSHEET_ID;
    // Google Sheets API v4
    var fs = require('fs');
    var readline = require('readline');
    var google = require('googleapis');
    var googleAuth = require('google-auth-library');

    // If modifying these scopes, delete your previously saved credentials
    // at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
    var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
    var clientSecret = process.env.CLIENT_SECRET;

    /**
      * Create an OAuth2 client with the given credentials, and then execute the
      * given callback function.
      *
      * @param {Object} credentials The authorization client credentials.
      * @param {function} callback The callback to call with the
      *   authorized client.
      */
    var authorize = function(credentials, callback) {
      var clientSecret = credentials.installed.client_secret;
      var clientId = credentials.installed.client_id;
      var redirectUrl = credentials.installed.redirect_uris[0];
      var auth = new googleAuth();
      var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
      oauth2Client.credentials = JSON.parse(process.env.CREDENTIALS);
      callback(oauth2Client);
    };

    /**
      * Get and store new token after prompting for user authorization, and then
      * execute the given callback with the authorized OAuth2 client.
      *
      * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get
      *   token for.
      * @param {getEventsCallback} callback The callback to call with
      *    the authorized client.
      */
    var getNewToken = function(oauth2Client, callback) {
      var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
      });
      // eslint-disable-next-line no-console
      console.log('Authorize this app by visiting this url: ', authUrl);
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
          if (err) {
            // eslint-disable-next-line no-console
            console.log('Error while trying to retrieve access token', err);
            return;
          }
          oauth2Client.credentials = token;
          storeToken(token);
          callback(oauth2Client);
        });
      });
    };

    /**
      * Store token to disk be used in later program executions.
      *
      * @param {Object} token The token to store to disk.
      */
    var storeToken = function(token) {
      try {
        fs.mkdirSync(TOKEN_DIR);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      fs.writeFile(TOKEN_PATH, JSON.stringify(token));
      // eslint-disable-next-line no-console
      console.log('Token stored to ' + TOKEN_PATH);
    };


    var checkClaSheet = function(auth) {
      var sheets = google.sheets('v4');
      sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: spreadsheetId,
        range: 'Usernames!A:A',
      }, function(err, response) {
        if (err) {
          // eslint-disable-next-line no-console
          console.log('The API returned an error: ' + err);
          return;
        }
        var rows = response.values;
        if (rows.length === 0) {
          // eslint-disable-next-line no-console
          console.log('No data found.');
        } else {
          for (var i = 0; i < rows.length; i++) {
            var rowUserName = rows[i][0];
            if (rowUserName === userName) {
              hasUserSignedCla = true;
              break;
            }
          }

          var params;
          if (hasUserSignedCla === true) {
            const labels = context.github.issues.getIssueLabels(
              context.issue());
            var labelData, claFlag = false;
            labels.then((resp) => {
              labelDataJSON = JSON.stringify(resp);
              labelData = resp.data;
              for (
                var labelIndex = 0;
                labelIndex < labelData.length;
                labelIndex++) {
                if (labelData[labelIndex].name === claLabel[0]) {
                  claFlag = true;
                  break;
                }
              }
              if (claFlag === true) {
                context.github.issues.removeLabel(context.issue({
                  name: claLabel[0]
                }));
              }
            });
            return;
          } else {
            var linkText = 'here';
            var linkResult = linkText.link('https://goo.gl/forms/AttNH80OV0');
            params = context.issue({
              body: 'Hi! @' + userName +
              '. Welcome to Oppia! Please could you ' +
              'follow the instructions ' + linkResult +
              ' to get started ? You\'ll need to do ' +
              'this before we can accept your PR. Thanks!'});
            if (isPullRequest === true) {
              context.github.issues.addLabels(context.issue({
                labels: claLabel
              }));
            }
          }
          return context.github.issues.createComment(params);
        }
      });
    };

    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
    authorize(JSON.parse(clientSecret), checkClaSheet);
  };

  /*
    Please use GitHub Webhook Payloads and not REST APIs.
    Link:  https://octokit.github.io/rest.js/
  */

  robot.on('issue_comment.created', async context => {
    if (context.isBot === false){
      const userName = context.payload.comment.user.login;
      apiForSheets(userName, context, false);
    }
  });

  robot.on('pull_request.opened', async context => {
    if (context.isBot === false){
      const userName = context.payload.pull_request.user.login;
      apiForSheets(userName, context, true);
    }
  });
};

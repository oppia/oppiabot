module.exports = (robot) => {
  function APIForSheets(userName, context, isPullRequest) {
    var cla_label = ['Needs CLA'];
    var hasUserSignedCla = false;
    // Google Sheets API v4
    var fs = require('fs');
    var readline = require('readline');
    var google = require('googleapis');
    var googleAuth = require('google-auth-library');

    // If modifying these scopes, delete your previously saved credentials
    // at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
    var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

    var client_secret = process.env.CLIENT_SECRET;
    // Authorize a client with the loaded credentials, then call the
    // Google Sheets API.
    authorize(JSON.parse(client_secret), checkCLASheet);
    /**
         * Create an OAuth2 client with the given credentials, and then execute the
         * given callback function.
         *
         * @param {Object} credentials The authorization client credentials.
         * @param {function} callback The callback to call with the authorized client.
         */
    function authorize(credentials, callback) {
      var clientSecret = credentials.installed.client_secret;
      var clientId = credentials.installed.client_id;
      var redirectUrl = credentials.installed.redirect_uris[0];
      var auth = new googleAuth();
      var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
      oauth2Client.credentials = JSON.parse(process.env.CREDENTIALS);
      callback(oauth2Client);
    }

    /**
         * Get and store new token after prompting for user authorization, and then
         * execute the given callback with the authorized OAuth2 client.
         *
         * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
         * @param {getEventsCallback} callback The callback to call with the authorized
         *     client.
         */
    function getNewToken(oauth2Client, callback) {
      var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
      });
      console.log('Authorize this app by visiting this url: ', authUrl);
      var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      rl.question('Enter the code from that page here: ', function(code) {
        rl.close();
        oauth2Client.getToken(code, function(err, token) {
          if (err) {
            console.log('Error while trying to retrieve access token', err);
            return;
          }
          oauth2Client.credentials = token;
          storeToken(token);
          callback(oauth2Client);
        });
      });
    }

    /**
         * Store token to disk be used in later program executions.
         *
         * @param {Object} token The token to store to disk.
         */
    function storeToken(token) {
      try {
        fs.mkdirSync(TOKEN_DIR);
      } catch (err) {
        if (err.code != 'EEXIST') {
          throw err;
        }
      }
      fs.writeFile(TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to ' + TOKEN_PATH);
    }

    
    function checkCLASheet(auth) {
      var sheets = google.sheets('v4');
      sheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: '1FEE3yW9K71n0yLA5nRipHg3ml8EF0z-AqOaRBK7XIaY',
        range: 'Usernames!A:A',
      }, function(err, response) {
        if (err) {
          console.log('The API returned an error: ' + err);
          return;
        }
        var rows = response.values;
        if (rows.length == 0) {
          console.log('No data found.');
        } else {
          for (var i = 0; i < rows.length; i++) {
            var rowUserName = rows[i][0];
            if (rowUserName == userName) {
              hasUserSignedCla = true;
              break;
            }
          }

          var params;
          console.log('hasUserSignedCla details');
          console.log(hasUserSignedCla);
          if (hasUserSignedCla == true) {
            console.log('Inside if');
            console.log(context.issue());
            const labels = context.github.issues.getIssueLabels(context.issue());
            var labelData, CLAFlag = false;
            labels.then((resp)=>{
              console.log('1.' + resp);
              console.log('2.' + resp.data);
              labelDataJSON = JSON.stringify(resp);
              console.log('3.' + labelDataJSON);
              //labelData = labelDataJSON.data
              labelData = resp.data;
              console.log('4.' + labelData);
              for (var labelIndex = 0; labelIndex < labelData.length; labelIndex++) {
                if (labelData[labelIndex].name == cla_label[0]) {
                  CLAFlag = true;
                  break;
                }
              }
              console.log('5.' + CLAFlag);
              if (CLAFlag == true) {
                context.github.issues.removeLabel(context.issue({
                  name: cla_label[0]
                }));
              }
            });
            return;
          } else {
            console.log('Inside else');
            var linkText = 'here';
            var linkResult = linkText.link('https://tinyurl.com/claformoppia');
            params = context.issue({body: 'Hi! @' + userName +
            '. Welcome to Oppia! Please could you follow the instructions ' + linkResult +
            ' to get started ? You\'ll need to do this before we can accept your PR. Thanks!'});
            if (isPullRequest == true) {
              context.github.issues.addLabels(context.issue({
                labels: cla_label
              }));
            }
          }
          console.log('Here are the params!');
          console.log(params);
          return context.github.issues.createComment(params);
        }
      });
    }
  }

  /*
  Remember: Use GitHub Webhook Payloads and not REST APIs
  Link:  https://octokit.github.io/rest.js/
  */

  robot.on('issue_comment.created', async context => {
    if (context.isBot == false){
      const userName = context.payload.comment.user.login;
      APIForSheets(userName, context, false);
    }
  });

  robot.on('pull_request.opened', async context => {
    if (context.isBot == false){
      const userName = context.payload.pull_request.user.login;
      APIForSheets(userName, context, true);
    }
  });

};


// // require('dotenv').config();
// const nock = require('nock');
// // Requiring our app implementation
// const myProbotApp = require('..');
// const { createProbot } = require('probot');

// const payload = require('../fixtures/pullRequestPayload.json');

// describe('New Spec', () => {
//   /**
//    * This is the main entrypoint to the Probot app
//    * @type {import('probot').Application} probot
//    */
//   let probot;

//   beforeEach(() => {
//     // nock.disableNetConnect();
//     probot = createProbot({ id: 1, cert: 'test', githubToken: 'test' });
//     probot.load(myProbotApp);
//     probot.auth = () => Promise.resolve({github})
//   });

//   it('calls appropriately', async () => {
//     // Receive a webhook event
//     await probot.receive({ name: 'pull_request', payload: payload.payload });
//   });

//   afterEach(() => {
//     nock.cleanAll();
//     nock.enableNetConnect();
//   });
// });
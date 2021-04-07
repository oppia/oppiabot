// require('dotenv').config();
// const { createProbot } = require('probot');
// const oppiaBot = require('../index');
// const scheduler = require('../lib/scheduler');
// const pullRequestReviewModule = require('../lib/checkPullRequestReview');
// const reviewPayloadData = require('../fixtures/pullRequestReview.json');
// const commentPayloadData = require('../fixtures/pullRequestComment.json');
// const utilityModule = require('../lib/utils');
// let payloadData = JSON.parse(
//   JSON.stringify(require('../fixtures/pullRequestPayload.json'))
// );

// describe('Pull Request Review Module', () => {
//   /**
//    * @type {import('probot').Probot} robot
//    */
//   let robot;

//   /**
//    * @type {import('probot').Octokit} github
//    */
//   let github;

//   /**
//    * @type {import('probot').Application} app
//    */
//   let app;

//   beforeEach(() => {
//     spyOn(scheduler, 'createScheduler').and.callFake(() => { });

//     github = {
//       issues: {
//        createComment: jasmine.createSpy('createComment').and.returnValue({}),
//         addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
//         removeAssignees: jasmine
//           .createSpy('removeAssignees')
//           .and.returnValue({}),
//         addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
//         removeLabels: jasmine.createSpy('removeLabels').and.returnValue({}),
//         update: jasmine.createSpy('update').and.returnValue({}),
//       },
//     };
//     robot = createProbot({
//       id: 1,
//       cert: 'test',
//       githubToken: 'test',
//     });

//     app = robot.load(oppiaBot);
//     spyOn(app, 'auth').and.resolveTo(github);
//     //spyOn(pullRequestReviewModule, 'handleChangesRequested').
//     //and.callThrough();
//     spyOn(pullRequestReviewModule, 'handlePullRequestReview').
//       and.callFake(() => {});
//     spyOn(utilityModule, 'sleep').and.callFake(() => { });
//   });

//   describe('A reviewer requests changes to the PR', () => {
//     // beforeEach(() => {
//     //   github.pulls = {
//     //     get: jasmine.createSpy('get').and.resolveTo({
//     //       data: reviewPayloadData.payload.pull_request,
//     //     }),
//     //   };
//     // });

//     describe('A reviewer requests changes to the PR', () => {
//       // beforeEach(() => {
//       //   github.pulls = {
//       //     get: jasmine.createSpy('get').and.resolveTo({
//       //       data: reviewPayloadData.payload.pull_request,
//       //     }),
//       //   };
//       // });

//       describe('When reviewer requests changes and LGTM label' +
//        'was already added to the pull request.', ()=>{
//         beforeEach(async () => {
//           const label = {
//             id: 248679580,
//             node_id: 'MDU6TGFiZWwyNDg2Nzk1ODA=  ',
//            url: 'https://api.github.com/repos/oppia/oppia/labels/PR:%20LGTM',
//             name: 'PR: LGTM',
//             color: '009800',
//           };
//           // Set the payload action and label which will simulate adding
//           // the changelog label.
//           payloadData.payload.action = 'labeled';
//           payloadData.payload.label = label;
//           payloadData.payload.pull_request.requested_reviewers = [
//             { login: 'reviewer1' },
//             { login: 'reviewer2' },
//           ];
//           payloadData.payload.pull_request.assignees = [];
//           // Set project owner to be pr author.
//           payloadData.payload.pull_request.user.login = 'kevintab95';
//           spyOn(pullRequestReviewModule, 'handleChangesRequested').
//             and.callFake(() => {});
//           await robot.receive(reviewPayloadData);
//         });
//         it('should check type of review', () => {
//           expect(
//             pullRequestReviewModule.handlePullRequestReview
//           ).toHaveBeenCalled();
//         });

//         it('Should comment on PR', ()=>{
//           expect(github.issues.createComment)
//             .toHaveBeenCalled();
//         });

//         it('Should Remove the LGTM Label', ()=>{
//           expect(github.issues.removeLabels).toHaveBeenCalled();
//         });
//       });
//     });
//   });
// });





























//   beforeEach(() => {
//     spyOn(scheduler, 'createScheduler').and.callFake(() => { });

//     github = {
//       issues: {
//         createComment: jasmine
// .createSpy('createComment').and.returnValue({}),
//      addAssignees: jasmine.createSpy('addAssignees').and.returnValue({}),
//         removeAssignees: jasmine
//           .createSpy('removeAssignees')
//           .and.returnValue({}),
//         addLabels: jasmine.createSpy('addLabels').and.returnValue({}),
//      removeLabels: jasmine.createSpy('removeLabels').and.returnValue({}),
//       },
//     };

//     robot = createProbot({
//       id: 1,
//       cert: 'test',
//       githubToken: 'test',
//     });

//     app = robot.load(oppiaBot);
//     spyOn(app, 'auth').and.resolveTo(github);
//spyOn(pullRequestReviewModule, 'handleChangesRequested').and.callThrough();
//spyOn(pullRequestReviewModule, 'handlePullRequestReview').and.callThrough();
//   });
//   describe('A reviewer requests changes to the PR', () => {
//     beforeEach(() => {
//       github.pulls = {
//         get: jasmine.createSpy('get').and.resolveTo({
//           data: reviewPayloadData.payload.pull_request,
//         }),
//       };
//     });

//     describe('When reviewer requests changes and LGTM label' +
//      ' was already added to the pull request.', ()=>{
//       beforeEach(async () => {
//         await robot.receive(reviewPayloadData);
//       });

//       it('should check type of review', () => {
//         expect(
//           pullRequestReviewModule.handlePullRequestReview
//         ).toHaveBeenCalled();
//       });

//       it('Should comment on PR', ()=>{
//         expect(github.issues.createComment)
//           .toHaveBeenCalled();
//       });

//       it('Should Remove the LGTM Label', ()=>{
//         expect(github.issues.removeLabels).toHaveBeenCalled();
//       });
//     });
//   });
// });


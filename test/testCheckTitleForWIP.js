var assert = require('assert');
const sinon = require('sinon');
const checkPullRequestTitleForWIPModule = require('../lib/checkTitleForWIP');

describe('tests Check title for WIP', function() {
    it('Check with WIP PR', function() {
      context = {
        payload: {
          pull_request: {
            user: {
              login: 'asdf'
            },
            title: 'WIP PR'
          },
          forced: true
        },
        repo: function(a){
            return a;
        },
        github: {
          issues:{
            createComment: sinon.spy()
          }
        }
      }
      checkPullRequestTitleForWIPModule.checkTitleForWIP(context);
      assert(context.github.issues.createComment.calledOnce)
    });
    it('Check with PR that is not WIP', function() {
      context = {
        payload: {
          pull_request: {
            user: {
              login: 'asdf'
            },
            title: 'normal PR'
          },
          forced: true
        },
        repo: function(a){
            return a;
        },
        github: {
          issues:{
            createComment: sinon.spy()
          }
        }
      }
      checkPullRequestTitleForWIPModule.checkTitleForWIP(context);
      assert(!context.github.issues.createComment.calledOnce)
    });
});

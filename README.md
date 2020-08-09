_These instructions are for developers who'd like to contribute code to improve the Oppia platform. If you'd prefer to help out with other things, please see our [general contribution guidelines](https://github.com/oppia/oppia/wiki)._

Thanks for your interest in improving the Oppia platform! This page explains how to get set up, how to find something to work on, and how to make a code change.

If you run into any problems along the way, please file an issue on our [issue tracker](https://github.com/oppia/oppia/issues), or get help by posting to the [developers' mailing list](https://groups.google.com/forum/#!forum/oppia-dev). There are also lots of helpful resources in the sidebar, check that out too! Also, if you'd like to get familiar with Oppia from a user's point of view, you can take a look at the [user documentation](http://oppia.github.io/).

## Setting things up

1. Please sign the CLA so that we can accept your contributions. If you're contributing as an individual, use the [individual CLA](https://goo.gl/forms/AttNH80OV0). If your company owns the copyright to your contributions, a company representative should sign the [corporate CLA](https://goo.gl/forms/xDq9gK3Zcv).
1. Fill in the [Oppia contributor survey](https://goo.gl/forms/otv30JV3Ihv0dT3C3) to let us know what your interests are. (You can always change your responses later.)
1. Install Oppia, following the appropriate installation instructions for your OS -- [Linux](https://github.com/oppia/oppia/wiki/Installing-Oppia-%28Linux%29), [Mac OS](https://github.com/oppia/oppia/wiki/Installing-Oppia-%28Mac-OS%29), [Windows](https://github.com/oppia/oppia/wiki/Installing-Oppia-%28Windows%29). If you run into any issues, please check out the [troubleshooting instructions](https://github.com/oppia/oppia/wiki/Troubleshooting).
1. Update your GitHub settings:
   - [Set up 2FA](https://help.github.com/articles/securing-your-account-with-two-factor-authentication-2fa/) on your GitHub account. **This is important to prevent people from impersonating you.**
     - You might need to create a [personal access token](https://help.github.com/articles/creating-a-personal-access-token-for-the-command-line/) so that you can log in from the command line.
   - Go to your [Notifications page](https://github.com/settings/notifications), and configure it according to your preferences.
   - (Optional) Consider setting up [automatic auth](https://help.github.com/articles/caching-your-github-password-in-git/) so you don't have to type in a username and password each time you commit a change.
   - (Optional) If you want to keep track of everything that happens on the Oppia repository, go to the [Oppia repo](https://github.com/oppia/oppia), and click 'Watch' at the top right. Be warned, though -- this might end up sending you a lot of email! The important thing is to ensure you notice when someone replies to a conversation you're part of, so please configure your notification settings accordingly.
1. If you use [Sublime Text](http://www.sublimetext.com/), consider installing the SublimeLinter, [SublimeLinter-eslint](https://github.com/SublimeLinter/SublimeLinter-eslint) and [SublimeLinter-pylint](https://github.com/SublimeLinter/SublimeLinter-pylint) plugins, following the instructions on their respective pages.
1. On your browser, consider [pinning](https://support.mozilla.org/en-US/kb/pinned-tabs-keep-favorite-websites-open) both this wiki page (for easy reference later) and the [Gitter tab](https://gitter.im/oppia/oppia-chat) (so that you can keep abreast of new activity). To pin a tab, just right-click the tab you want to pin, and select "Pin Tab".
1. Familiarize yourself with the resources linked to from the sidebar of this page, especially the [overview of the codebase](https://github.com/oppia/oppia/wiki/Overview-of-the-Oppia-codebase), the [coding style guide](https://github.com/oppia/oppia/wiki/Coding-style-guide), and our [Frequently Asked Questions](https://github.com/oppia/oppia/wiki/Frequently-Asked-Questions). You don't have to read all the other stuff right now, but it's a good idea to be aware of what's available, so that you can refer to it later if needed.
1. Join the [oppia-dev@](https://groups.google.com/forum/#!forum/oppia-dev) mailing list, and say hi on the [gitter](https://gitter.im/oppia/oppia-chat) chat channel!
1. Take up your first starter project! You can find more details in the next section.

## Developing your skills

In general, it's easier to contribute to the Oppia codebase if you have some knowledge of git, as well as at least one of Python or AngularJS/Angular. You don't need to know all of this before you start, though! Many of our contributors have picked these skills up concurrently while tackling their first issues.

That said, we strongly recommend that you be open to learning new things. If you need to brush up on some of the technologies used in Oppia, here are some resources that may help:

- Git and Github are used to make changes to the repository. So, it's good to know how to use them to do basic stuff like branching, merging, pull/push etc. [Here](https://github.com/oppia/oppia/wiki/Learning-Resources) is a page we've compiled that contains some links to useful learning materials.
- AngularJS (v1) and Angular 8 are used for Oppia's frontend; we are currently in the process of migrating from the former to the latter. Most of our open issues are in the frontend and require at least some knowledge of HTML, AngularJS/Angular and CSS, so knowledge of frontend coding will serve you well if you'd like to contribute to Oppia over the longer term.
  - A nice YouTube video tutorial for AngularJS can be found [here](https://www.youtube.com/watch?v=nO1ROKMjPqI&list=PLvZkOAgBYrsS_ugyamsNpCgLSmtIXZGiz) and you can check the official [tutorial](https://docs.angularjs.org/tutorial/index)/[guide](https://docs.angularjs.org/guide). For an outline of AngularJS, you can also take a look at this [short overview](https://egghead.io/articles/new-to-angularjs-start-learning-here) with pointers to other resources.
  - For Angular 8, consider checking out the official documentation [here](https://angular.io/docs), which also includes a [tutorial](https://angular.io/tutorial).
- If you are new to HTML, some tutorials include [Mozilla's guide](https://developer.mozilla.org/en-US/docs/Learn/HTML/Introduction_to_HTML) (which includes some practice assessments), as well as [this tutorial for beginners](http://htmldog.com/guides/html/beginner/).
- We also have some backend (Python) projects available, but not as many, so we'd strongly recommend learning AngularJS if you have the opportunity and inclination -- otherwise, the range of projects you can take up will be more limited. That said, let us know at welcome@oppia.org if you'd like suggestions for non-frontend projects, and we'll do our best to help.

## Finding something to do...

### ... as a new contributor

Welcome! Please make sure to follow the [setup instructions](https://github.com/oppia/oppia/wiki/Contributing-code-to-Oppia#setting-things-up) above if you haven't already. After that, we'd **strongly recommend** tackling some part of one of the following starter issues:

- [#4057](https://github.com/oppia/oppia/issues/4057) (frontend; Karma tests)
- [#8668](https://github.com/oppia/oppia/issues/8668) (frontend; documenting the services)
- [#6240](https://github.com/oppia/oppia/issues/6240) (writing end to end tests)
- [#8015](https://github.com/oppia/oppia/issues/8015) (Refactoring frontend services)
- [#8016](https://github.com/oppia/oppia/issues/8016) (Refactoring frontend services)
- [#8472](https://github.com/oppia/oppia/issues/8472) (Migrating AngularJS files to Angular 8)
- [#8038](https://github.com/oppia/oppia/issues/8038) (Refactoring frontend services)

since these issues are hand-picked and ensure that you don't run into unexpected roadblocks while working on them. For other issues, you may need to be more independent because often times, we don’t know how to solve them either.
If you decide to pick one of these, please go ahead and leave a comment saying which part of the issue you're taking, and submit a follow-up PR by following the [instructions below](Contributing-code-to-Oppia#instructions-for-making-a-code-change). You don't need to wait for approval to get started!

If you need some help from someone with a more prominent UI/UX or design perspective, tag @rachelwchen and expect a response within 2-3 days, if not, ping in the Oppia Gitter channel.

**Important Note**: Please make sure to read and follow the [PR instructions](Contributing-code-to-Oppia#instructions-for-making-a-code-change) carefully, otherwise your PR review may be delayed.

### ... after completing two starter projects

After you've completed parts of at least two different starter projects and successfully submitted PRs for them into develop, we'll mail you a collaborator invite link for the Oppia repository. This is a manual process and may take up to 48 hours. Please visit [this link](https://github.com/oppia/oppia/invitations) to accept the invitation to collaborate. We'll also get in touch to suggest suitable longer-term projects based on your interests, but please feel free to email us at admin@oppia.org if you don't receive the email!

### ... as an existing contributor

There are lots of options!

- **Want easy projects?** Check out our [list of "good first issues"](https://github.com/oppia/oppia/labels/good%20first%20issue).
- **Want projects that matter?** Check out our [list of high-priority issues](https://github.com/oppia/oppia/issues?q=is%3Aopen+is%3Aissue+label%3Aimportant).
- **Want to practice debugging?** Check out our [list of issues needing debugging help](https://github.com/oppia/oppia/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aopen%20label%3A%22needs%20debugging%22%20).
- **Want to practice writing a design doc?** Check out the [list of issues requiring a design doc](https://github.com/oppia/oppia/labels/needs%20design%20doc). This is useful for learning how to write good "technical implementation" proposals.
- **Want to join a team working on a larger effort?** See our [list of projects](https://github.com/oppia/oppia/projects).
- **Want to lead a project?** Let us know by emailing admin@oppia.org. We may offer you the opportunity to do this once you've sent in several good PRs.
- **Want help figuring out what to do?** Just ask us on [Gitter](https://gitter.im/oppia/oppia-chat), or send an email to admin@oppia.org. We'll try to help!

If an issue hasn't got someone assigned to it, and there's no existing PR for the issue (you can check this by scanning the list of [existing PRs](https://github.com/oppia/oppia/pulls)), feel free to take it up by assigning yourself to it. You don't need to ask permission to do so. Also, if you need help or advice on an issue, you can contact the corresponding team lead, whose GitHub username you can find in the issue's grey label. You can also find a list of all Oppia teams on the [Projects page](https://github.com/oppia/oppia/projects), together with their respective team leads.

## Instructions for making a code change

**Working on your first Pull Request?** _You can learn how from this free series: [How to Contribute to an Open Source Project on GitHub](https://egghead.io/series/how-to-contribute-to-an-open-source-project-on-github)._

**Note:** If your change involves more than around 500 lines of code, we recommend first creating a short [design doc](https://github.com/oppia/oppia/wiki/Writing-design-docs) and sending it to the oppia-dev@googlegroups.com for feedback before writing any code. This helps avoid duplication of effort, and allows us to offer advice and suggestions on the implementation approach.

To make code changes, please follow the following instructions carefully! Otherwise, your code review may be delayed.

1. **Before coding anything, choose a descriptive branch name** that is lowercase and hyphen-separated, e.g. `fuzzy-rules`, and create a new branch with this name, starting from 'develop'. Make sure that your branch name doesn't start with `develop`, `release` or `test`.

   You can do all this by running:

   ```
     git fetch upstream
     git checkout develop
     git merge upstream/develop
     git checkout -b your-branch-name
   ```

2. **Make commit(s) locally to your feature branch.** Each commit should be self-contained and have a descriptive commit message that helps other developers understand why the changes were made. However, **do not write "Fix #ISSUE_NUMBER"** (e.g. Fix #99999) in your commit messages, as this will cause Github to close the original issue automatically. You can rename your commit messages using `git commit --amend`.

   - Before making the commit, do some sanity-checks:

     - Ensure that your code follows [the style rules](https://github.com/oppia/oppia/wiki/Coding-style-guide).
     - Start up a local instance of Oppia and do some manual testing in order to check that you haven't broken anything!

   - To actually make the commit, run:

     ```
       git commit -a -m "{{YOUR COMMIT MESSAGE HERE}}"
     ```

   - **Note**: There is no maximum/minimum number of commits required in a PR. Just follow the instructions of the reviewer. Since we make a squash merge, there is no restriction on the number of commits you make but make sure that your commits are meaningful.

3. **Push changes to your GitHub fork.**

   - **Before pushing**, make sure to check the following things, otherwise you will incur delays with the review process or the automated checks:

     - Do some manual testing on your local instance of Oppia to check that you haven't broken anything. You can do this by running `python -m scripts.start`. **This is important, in order to avoid breakages. Don't rely on the automated tests alone.**

     - Use a tool like `git diff` or `meld` to check that the changes you've made are exactly what you want them to be, and that you haven't left in anything spurious.

     - Ensure that your code is fully covered by automated tests. (For more info, see the wiki pages on writing tests in the sidebar menu.)

   - When you're ready to push, run:

     ```
       git push origin {{YOUR BRANCH NAME}}
     ```

     **Make sure to do this from the command line** (and not GitHub's Desktop client), since this also runs some important presubmit checks before your code gets uploaded to GitHub. If any of these checks fail, read the failure messages and fix the issues by making a new commit (see step 3), then **repeat the previous instructions** to retry the push. **Do not bypass these checks, since doing so will lead to delays in the review process.**

4. **When your feature is ready to merge, create a pull request.**

   - Go to your fork on GitHub, select your branch from the dropdown menu, and click "pull request". Ensure that the 'base' repository is the main oppia repo and that the 'base' branch is 'develop'.
   - Following the guidance in the PR checklist, add a descriptive title explaining the purpose of the PR (e.g. "Fix issue #bugnum: add a warning when the user leaves a page in the middle of an exploration.").
   - Fill out the rest of the PR checklist.
   - Click "Create pull request", then **immediately** check the "Files changed" tab on your PR on GitHub and read it carefully to make sure that the changes are correct (e.g., no missing newlines at the ends of files; no files left out by mistake). This is a good way to catch obvious errors that would otherwise lead to delays in the review process. If you find an error, you can either make additional commits to the same PR to fix it, or close the PR and submit a new one.
   - Request a review from the issue's "owner" (which can be found in a label on the issue) **and** also set them as the PR assignee. Make sure to assign a reviewer explicitly in both the Reviewers and Assignees fields. Also, leave a top-level comment on your PR saying "@{{reviewer}} PTAL", where {{reviewer}} is the GitHub username of your reviewer. ("PTAL" means "Please take a look".)
   - After a while, check your PR to see whether the Travis checks have passed. If not, follow the instructions at "[If your build fails...](https://github.com/oppia/oppia/wiki/If-your-build-fails)".
   - Then, wait for your code to get reviewed!
     - While you're waiting, it's totally fine to start work on a new PR if you like. Just make sure to **checkout the develop branch** and sync to HEAD before you check out a new branch, so that each of your feature branches is based off the main trunk.

5. #### **Test your PR to confirm that the changes you have made are working properly**
   - Test all the places where the changes are made, including buttons, tabs, lists etc. Make a screen recording of these changes and add it to your PR

6. #### **Address review comments until all reviewers give LGTM ('looks good to me').**

   - When your reviewer has completed their review, they will reassign the PR back to you, at which point you should push updates, respond to **all** comments, and reassign it back to them. This continues until the reviewer gives LGTM, after which the PR is merged. Here is the procedure for responding to a review:

     - Merge develop into your branch. If you run into conflicts, run the following commands to resolve them (**note:** replace new-branch-name with the name of your branch):

     ```
       git checkout new-branch-name
       git fetch upstream
       git merge upstream/develop
       ...[fix the conflicts -- see https://help.github.com/articles/resolving-a-merge-conflict-using-the-command-line]...
       ...[make sure the tests pass before committing]...
       git commit -a
       git push origin new-branch-name
     ```

     - Make a new commit addressing the comments you agree with, and push it to the same branch. (Continue to use descriptive commit messages, or something like "Address review comments" if you're addressing many disparate review comments in the same commit.) **You do not need to close your PR and create a new one -- it's fine to push new commits to the existing PR.**
       - **Always make commits locally, and then push to GitHub.** Don't make changes using the online GitHub editor -- this bypasses lint/presubmit checks, and will cause the code on GitHub to diverge from the code on your machine.
       - **Never force-push changes to GitHub once reviews have started.** This will delay your review because it overwrites history on GitHub and makes the incremental changes harder to review. It may also lead to the PR being closed.
     - As you are making changes, track them by replying to each comment via the Files Changed tab, **choosing the "Start a review" option** for the first comment. Each reply should be either "Done" or a response explaining why the corresponding suggestion wasn't implemented. Also, please **do not** mark the comment as resolved, since this just makes it harder to actually read the comment thread. When you've responded to all comments, submit the review to add all your messages to the main thread.
       - **Tip:** If a reviewer asks questions about the "why" behind something, consider proactively adding a clear comment above the relevant line in your code, since the fact that the reviewer had to ask suggests that at least one developer doesn't understand what is going on from the code alone. Otherwise, you'll probably get a follow-up review comment asking you to leave a code comment anyway :)

   - Once you've addressed everything, and would like the reviewer(s) to take another look:
     - Follow the instructions in Step 3 to test your changes locally before pushing.
     - Make the push, and then immediately check that the changes in the "Files Changed" tab are what you intend them to be.
     - **Important:** Make sure you've posted responses to **all** the review comments from the reviewer(s).
     - **Important:** In the conversation thread, **write a top-level comment** explicitly asking the reviewer(s) to take another look ("@XXX PTAL"), and assign them to the PR.

7. **Make sure all CI checks pass.** While waiting to get LGTM from reviewers, make sure that all the CI checks (Travis, CircleCI, etc.) pass, since otherwise you won't be able to merge your PR. (See "[If your build fails...](https://github.com/oppia/oppia/wiki/If-your-build-fails)" for some suggestions on what to do if you run into issues.)

   - If all reviewers have given LGTM but you're still waiting for the CI checks to pass, make sure you're assigned to the PR, so that you can merge it once the CI checks are complete.

8. **Tidy up!** After the PR status has changed to "Merged", delete the feature branch from both your local clone and the GitHub repository:

   ```
     git branch -D new-branch-name
     git push origin --delete new-branch-name
   ```

9. **Celebrate.** Congratulations, you have contributed to Oppia!

## Tips for making a good code change

1. Make dependent (“stacked”) PRs to ensure smaller time between reviews and subsequent PRs. A large PR results in difficulty to review for the reviewer as well as difficulty in making changes according to a review for an author. So, it is better to create smaller PRs which deliver a single small goal. If you have any other code change dependent on a PR, it is better to stack it on the that PR and create a new PR instead of merging it in one PR.

2. Try and follow test-driven development. This is the easiest way to make sure the code you wrote is working fine. Writing tests for the expected behaviour, and then writing code that will pass the tests is the basic idea. Refer our guides for writing good tests: [Backend Tests](https://github.com/oppia/oppia/wiki/Writing-backend-tests), [Frontend Tests](https://github.com/oppia/oppia/wiki/Frontend-test-best-practices), [End to end tests](https://github.com/oppia/oppia/wiki/End-to-End-Tests), [Tests for pylint extensions](https://github.com/oppia/oppia/wiki/Writing-Tests-For-Pylint).

3. If you are making a contribution which involves change in some user interface or introduces a new feature, it is good to start with a design doc to avoid wasting efforts later. Follow our [guide](https://github.com/oppia/oppia/wiki/Writing-design-docs) for writing design docs.

### Notes

- Our central development branch is `develop`, which should be clean and ready for release at any time. All changes should be done in feature branches based off of `develop`.

- If you face any issues while setting things up, or your PR build fails unexpectedly (please go through the logs of the PR build and try debugging the problem on your own first!), feel free to ping **@oppia/core-maintainers** for help.

- To find the author of a particular change in a file, run this command:

  ```
  git blame file-name
  ```

  The output will show the latest commit SHA, author, date, and time of commit for each line.

  To confine the search of an author between particular lines in a file, you can use:

  ```
  git blame -L 40,60 file-name
  ```

  The output will then show lines 40 to 60 of the particular file.

  For more `git blame` options, you can visit the [git blame documentation](https://git-scm.com/docs/git-blame).

- If your PR includes changing the location of the file, if you simply move the file by cut and paste method, then the git will track it as a new file. So to prevent this, use:

  ```
  git mv old_file_path new_file_path
  ```

  By using this command git will detect the file as a renamed file.

- **Important** PRs marked with the “critical” label need to be tested in the backup server before being merged. For this, one of the release coordinators (with access to deploy) should checkout a new branch from develop, merge the branch from the PR into the new branch, and initiate deployment to the backup server from this branch. The PR author should give specific testing instructions for the changes (like which job to run, what the expected output is, etc) and the coordinator should verify the same. Once successfully tested, the PR should be merged into develop. This is to prevent cases like exploration migrations which can result in data corruption (as it will auto-migrate) if the migration isn’t safe. The "critical" label needs to be applied on PRs that change data validation checks, and other possibly critical changes which could affect production data.

## WIP / Draft Pull Requests

While making a contribution, you may discover that your change is not complete and needs some more work. You may want to make a work in progress (WIP) or a draft pull request so that the reviewers can begin reviewing your changes, however, draft pull requests consumes resources like the Circle CI builds and Travis CI builds and this is not always what you want since the pull request is still a work in progress.

Hence, we advice that you prefix the commit messages with **[skip ci]** or **[ci skip]** request if it is a work in progress to prevent CI checks from running.

Learn more about skipping a [Travis CI build](https://docs.travis-ci.com/user/customizing-the-build/#skipping-a-build) and skipping a [Circle CI build](https://circleci.com/docs/2.0/skip-build/#skipping-a-build).


## Labeling issues and pull requests

While contributing to Oppia, you will need to add different labels to issues or pull requests which you are working on.

However, not all labels are allowed on issues and pull requests.

Below are labels which can be applied to pull requests:

1. Dependencies: Should be added to pull requests that updates one or more dependencies.
2. Critical: Should be added to pull requests that change storage models.
3. Stale: Should only be added by oppiabot on pull requests that have not been active over a period of time.
4. Changelog (labels containing _PR CHANGELOG_): Should be used on pull requests for respective projects. For example, a pull requests which upgrades a service from angularjs to angular 8, should apply the angular migration changelog label **PR CHANGELOG: Angular Migration -- @bansalnitish**.
5. Labels starting with **PR** like _PR: LGTM, PR: don’t merge - needs CLA_: These labels are used to denote the status of a pull request. For example, the **PR: LGTM** shows that the PR has been approved and is probably waiting for CI checks to be completed.
6. PR: require post-merge sync to HEAD: Should only be applied to pull requests which when merged will require all other open pull requests to be updated with the develop branch.

All other labels are to be used on issues.

It should be noted that the **good first issue** label should only be added by members of the onboarding team which is led by [@Showtim3](https://github.com/Showtim3).

A complete list of labels can be found [here](https://github.com/oppia/oppia/labels).

## Writing design docs

Sometimes, it might not be entirely clear how to implement something. In such cases, we recommend creating a short document which states the problem clearly and provides a comparative analysis of the different approaches that you can think of to tackle the issue.

This will enable you to get reviews from your mentors and other Oppia contributors easily without needing to schedule a meeting, and make it easier to add additional reviewers later if needed. You can find more information on [this wiki page](https://github.com/oppia/oppia/wiki/Writing-design-docs) about how to write these docs, as well as best practices for responding to doc reviews.

## Communication channels

### Mailing lists

We have several mailing lists in the form of Google Groups that you can join:

- [oppia-announce](https://groups.google.com/forum/#!forum/oppia-announce) is for announcements of new releases or blog posts.
- [oppia-dev](https://groups.google.com/forum/#!forum/oppia-dev) is the main mailing list for communication between developers, and for technical questions.

We also have a developer chat room [here](https://gitter.im/oppia/oppia-chat). Feel free to drop in and say hi!

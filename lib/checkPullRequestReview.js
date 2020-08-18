/**
 * 1. Reviewer reviews and approves
 *    - Bot unassigns reviewer and assigns next reviewer(s)(if any).
 *    - If all reviewers have approved, bot checks if the user has merging
 *      rights and assigns user if that is the case or otherwise assigns the
 *      project owner.
 * 2.  Reviewer reviews and requests changes
 *    - Bot unassigns reviewer and assigns the user
 */
const { sleep } = require('./utils');

const handleChangesRequested = async (context) => {
  // Sleep for 3 minutes.
  await sleep(60 * 1000 * 3);
};

const handleApproval = (context) => {
  // Sleep for 3 minutes.
  await sleep(60 * 1000 * 3);
};

const handlePullRequestReview = context => {

}




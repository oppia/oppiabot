// 1. Install Axios
// 2. Check if pr modifies codeowner file.
// 3. Fetch codeowner file from oppia.
// 4. Get all new additions to the codeowner file.
// 5. Get the new usernames added to the codeowner file.
// 6. Check that the new usernames can be found in the fetched codeowner file.
// 7. If username can be found, do nothing.
// 8. If username cannot be found, comment on the PR, ccing oppia/core-maintainers.
const checkForCodeowner = (context) => {};

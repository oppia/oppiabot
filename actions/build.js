const { execSync } = require('child_process');

execSync('npm run actions-build');
execSync('git add dist/index.js');

'use strict';

const { validateProfileLibrary, runCli: runLibraryCli } = require('./profile-library-output-check');

function validateProfileArticles(options = {}) {
  return validateProfileLibrary({ ...options, route: 'compatibility' });
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}${error.url ? ` url=${error.url}` : ''}`);
}

function runCli(args = process.argv.slice(2)) {
  return runLibraryCli(args, 'compatibility');
}

if (require.main === module) process.exitCode = runCli();
module.exports = { validateProfileArticles, formatDiagnostics, runCli };

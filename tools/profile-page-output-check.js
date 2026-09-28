'use strict';

const path = require('path');
const { validateProfileLibrary, runCli: runLibraryCli } = require('./profile-library-output-check');

function validateProfilePage(options = {}) {
  return validateProfileLibrary({ ...options, route: 'home' });
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}${error.url ? ` url=${error.url}` : ''}`);
}

function runCli(args = process.argv.slice(2)) {
  return runLibraryCli(args, 'home');
}

if (require.main === module) process.exitCode = runCli();
module.exports = { validateProfilePage, formatDiagnostics, runCli };

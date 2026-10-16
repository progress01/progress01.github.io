// Serve the installed hexo-generator-searchdb browser runtime from this site.
// Reading it from node_modules keeps the browser implementation aligned with
// the installed package version and avoids an independently maintained copy.
const fs = require('fs');
const path = require('path');

const packageJsonPath = require.resolve('hexo-generator-searchdb/package.json');
const packageDirectory = path.dirname(packageJsonPath);
const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const runtime = fs.readFileSync(path.join(packageDirectory, 'dist/search.js'), 'utf8');
const license = fs.readFileSync(path.join(packageDirectory, 'LICENSE'), 'utf8');
const version = packageInfo.version;

hexo.extend.generator.register('searchdb_runtime', function() {
  return [
    {
      path: 'lib/searchdb/search.js',
      data: `/*! hexo-generator-searchdb v${version}; MIT License (see /lib/searchdb/LICENSE) */\n${runtime}`
    },
    {
      path: 'lib/searchdb/LICENSE',
      data: license
    }
  ];
});

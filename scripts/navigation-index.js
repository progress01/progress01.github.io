const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { buildIndex } = require('../tools/lib/navigation-index');

hexo.extend.generator.register('personal_navigation_index', function(locals) {
  const read = file => fs.readFileSync(path.join(hexo.source_dir, file), 'utf8');
  const index = buildIndex({ posts: locals.posts, microblog: JSON.parse(read('microblog.json')),
    desk: yaml.load(read('reading-desk.yml'), { schema: yaml.JSON_SCHEMA }), origin: hexo.config.url });
  index.warnings.forEach(message => hexo.log.warn(message));
  return { path: 'navigation-index.json', data: JSON.stringify(index) };
});

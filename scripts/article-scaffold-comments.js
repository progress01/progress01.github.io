'use strict';

const fs = require('node:fs');
const path = require('node:path');

function getArticleLayout(filePath) {
  const relative = path.relative(hexo.source_dir, filePath).replaceAll('\\', '/');
  if (relative.startsWith('_drafts/')) return 'draft';
  if (relative.startsWith('_posts/')) return 'post';
  return null;
}

hexo.on('new', result => {
  const layout = getArticleLayout(result?.path);
  if (!layout) return;

  const scaffoldPath = path.join(hexo.scaffold_dir, `${layout}.md`);
  if (!fs.existsSync(scaffoldPath) || !fs.existsSync(result.path)) return;

  const scaffold = fs.readFileSync(scaffoldPath, 'utf8');
  const scaffoldFrontmatter = scaffold.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!scaffoldFrontmatter) return;
  const reminders = scaffoldFrontmatter[1].split(/\r?\n/).filter(line => /^\s*#/.test(line));
  if (!reminders.length) return;

  const generated = fs.readFileSync(result.path, 'utf8');
  if (/^\s*# 發布前確認/m.test(generated)) return;
  const withReminders = generated.replace(/^(surfaces:\s*\[\]\s*)$/m, `${reminders.join('\n')}\n$1`);
  if (withReminders !== generated) fs.writeFileSync(result.path, withReminders, 'utf8');
});

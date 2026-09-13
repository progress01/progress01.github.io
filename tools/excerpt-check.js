'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const cheerio = require('cheerio');
const { marked } = require('marked');

const EXCERPT_LIMIT = 86;
const MORE_MARKER = /<!-- ?more ?-->/gi;
const SONG_DIRECTORY = 'source/_posts/歌曲推薦';

function usage() {
  return [
    'Usage: node tools/excerpt-check.js --post <source/_posts/post.md> [--post <...> ...]',
    '       node tools/excerpt-check.js --all',
    '',
    'Checks the real Hexo more marker before writing. --all is an explicit audit of every post.'
  ].join('\n');
}

function parseArgs(argv) {
  const posts = [];
  let all = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      if (argv.length !== 1) throw new Error('--help cannot be combined with other flags');
      return { help: true, all: false, posts: [] };
    }
    if (arg === '--all') {
      if (all || posts.length) throw new Error('--all cannot be combined with --post');
      all = true;
      continue;
    }
    if (arg === '--post') {
      const value = argv[++index];
      if (!value || value.startsWith('-')) throw new Error('--post requires a path');
      posts.push(value);
      continue;
    }
    if (arg.startsWith('--post=')) {
      const value = arg.slice('--post='.length);
      if (!value) throw new Error('--post requires a path');
      posts.push(value);
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }
  if (all && posts.length) throw new Error('--all cannot be combined with --post');
  if (!all && posts.length === 0) throw new Error('choose --post or --all');
  return { help: false, all, posts };
}

function parseFrontmatter(content, filename) {
  if (!content.startsWith('---')) {
    return { body: content, data: {}, errors: [`${filename}: missing frontmatter`] };
  }
  const lines = content.split(/\r?\n/);
  if (lines[0].trim() !== '---') {
    return { body: content, data: {}, errors: [`${filename}: missing frontmatter`] };
  }
  let closing = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === '---') {
      closing = index;
      break;
    }
  }
  if (closing < 0) return { body: content, data: {}, errors: [`${filename}: unterminated frontmatter`] };
  const frontmatter = lines.slice(1, closing).join('\n');
  let data;
  try {
    data = yaml.load(frontmatter, { schema: yaml.FAILSAFE_SCHEMA }) || {};
  } catch (error) {
    return { body: content, data: {}, errors: [`${filename}: invalid frontmatter YAML (${error.message})`] };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { body: content, data: {}, errors: [`${filename}: frontmatter must be a mapping`] };
  }
  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const bodyStart = lines.slice(0, closing + 1).join(newline).length + newline.length;
  return { body: content.slice(bodyStart), data, errors: [] };
}

function linesOutsideFences(body) {
  const lines = [];
  let offset = 0;
  let fence = null;
  const split = body.split(/(\r?\n)/);
  for (let index = 0; index < split.length; index += 2) {
    const line = split[index];
    const newline = split[index + 1] || '';
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})(?:[^`~]*)$/);
    const inFence = Boolean(fence);
    lines.push({ line, newline, offset, inFence });
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const character = marker[0];
      if (!fence) fence = { character, length: marker.length };
      else if (fence.character === character && marker.length >= fence.length) fence = null;
    }
    offset += line.length + newline.length;
  }
  return { lines, unclosed: Boolean(fence) };
}

function findSourceMoreMarkers(body) {
  const source = linesOutsideFences(body);
  const markers = [];
  for (const entry of source.lines) {
    if (entry.inFence) continue;
    MORE_MARKER.lastIndex = 0;
    let match;
    while ((match = MORE_MARKER.exec(entry.line)) !== null) {
      markers.push({ offset: entry.offset + match.index, length: match[0].length });
      if (!match[0].length) MORE_MARKER.lastIndex += 1;
    }
  }
  return { markers, unclosedFence: source.unclosed };
}

function renderMarkdown(markdown) {
  const rendered = marked.parse(markdown, { async: false });
  if (typeof rendered !== 'string') throw new Error('marked returned asynchronous output');
  return rendered;
}

function htmlRoot(rendered) {
  const $ = cheerio.load(`<div id="excerpt-root">${rendered}</div>`, null, false);
  return { $, root: $('#excerpt-root') };
}

function findMoreMarkers(rendered) {
  const markers = [];
  const markerPattern = /<!-- ?more ?-->/gi;
  let match;
  while ((match = markerPattern.exec(rendered)) !== null) {
    markers.push({ offset: match.index, length: match[0].length });
  }
  return { markers };
}

function visibleText(rendered) {
  const { root } = htmlRoot(rendered);
  root.find('img, svg, script, style, iframe').remove();
  return root.text().trim();
}

function countVisibleCharacters(text) {
  return Array.from(text.replace(/\s/gu, '')).length;
}

function countImages(rendered) {
  const { root } = htmlRoot(rendered);
  return root.find('img').length;
}

function countParagraphs(rendered) {
  const { root } = htmlRoot(rendered);
  const paragraphs = root.find('p');
  if (paragraphs.length) return paragraphs.length;
  return countVisibleCharacters(visibleText(rendered)) ? 1 : 0;
}

function inspectExcerpt(content, filename = '<post>') {
  const parsed = parseFrontmatter(content, filename);
  const errors = [...parsed.errors];
  const warnings = [];
  const risks = [];
  const body = parsed.body;
  const sourceMarkerInfo = findSourceMoreMarkers(body);
  const rendered = renderMarkdown(body);
  const renderedMarkerInfo = findMoreMarkers(rendered);
  const isSong = filename.replaceAll('\\', '/').includes(`${SONG_DIRECTORY}/`);

  if (renderedMarkerInfo.markers.length === 0) errors.push(`${filename}: missing Hexo <!-- more --> marker`);
  if (renderedMarkerInfo.markers.length > 1) errors.push(`${filename}: multiple Hexo <!-- more --> markers (${renderedMarkerInfo.markers.length})`);
  if (sourceMarkerInfo.unclosedFence) risks.push('unclosed fenced code block before or after marker');

  const marker = renderedMarkerInfo.markers[0];
  const sourceMarker = sourceMarkerInfo.markers[0];
  const sourceExcerpt = sourceMarker ? body.slice(0, sourceMarker.offset) : body;
  const renderedExcerpt = marker ? rendered.slice(0, marker.offset) : rendered;
  const text = visibleText(renderedExcerpt);
  const visibleCharacters = countVisibleCharacters(text);
  const paragraphs = countParagraphs(renderedExcerpt);
  const images = countImages(renderedExcerpt);

  if (marker && visibleCharacters === 0) errors.push(`${filename}: excerpt before marker is empty (images do not count as text)`);
  if (visibleCharacters > EXCERPT_LIMIT) errors.push(`${filename}: visible excerpt is ${visibleCharacters} Unicode characters; limit is ${EXCERPT_LIMIT}`);
  if (paragraphs > 1) risks.push(`excerpt has ${paragraphs} paragraphs; the default layout expects one`);
  const { root: excerptRoot } = htmlRoot(renderedExcerpt);
  if (excerptRoot.find('h1,h2,h3,h4,h5,h6').length) risks.push('heading appears before marker');
  if (excerptRoot.find('table').length) risks.push('table appears before marker');
  if (excerptRoot.find('pre').length) risks.push('fenced code block appears before marker');
  if (excerptRoot.find('iframe').length) risks.push('iframe appears before marker');
  if (images > 1) risks.push(`${images} images appear before marker; multiple media can change card height`);
  if (risks.length) warnings.push(...risks.map((risk) => `${filename}: structure risk: ${risk}`));

  const htmlTags = excerptRoot.find('*').map((_, element) => element.name.toLowerCase()).get();
  const complexTags = htmlTags.filter((tag) => !['a', 'br', 'div', 'img', 'p', 'span', 'strong', 'em', 'b', 'i'].includes(tag));
  const hexoTags = sourceExcerpt.match(/\{%[\s\S]*?%\}/g) || [];
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'excerpt')) {
    const frontmatterExcerptCharacters = countVisibleCharacters(visibleText(String(parsed.data.excerpt || '')));
    warnings.push(`${filename}: frontmatter excerpt overrides the marker in Hexo (${frontmatterExcerptCharacters} visible Unicode characters); inspect the generated preview`);
    if (frontmatterExcerptCharacters > EXCERPT_LIMIT) warnings.push(`${filename}: frontmatter excerpt exceeds the ${EXCERPT_LIMIT}-character guide`);
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'description')) {
    const descriptionText = visibleText(String(parsed.data.description || ''));
    const descriptionCharacters = countVisibleCharacters(descriptionText);
    warnings.push(`${filename}: frontmatter description is used by the index layout (${descriptionCharacters} visible Unicode characters); inspect the generated preview`);
    if (descriptionCharacters > EXCERPT_LIMIT) warnings.push(`${filename}: frontmatter description exceeds the ${EXCERPT_LIMIT}-character guide`);
  }
  if (hexoTags.length) warnings.push(`${filename}: Hexo tag syntax appears before marker; inspect rendered preview`);
  if (complexTags.length) warnings.push(`${filename}: complex HTML (${[...new Set(complexTags)].join(', ')}) needs rendered preview confirmation`);
  const sourceHasHtml = /<\/?[a-z][^>]*>/i.test(sourceExcerpt);
  if (isSong && sourceHasHtml && images === 1) warnings.push(`${filename}: song card HTML is allowed, but inspect the rendered cover card`);
  else if (images === 1) warnings.push(`${filename}: image affects layout but does not count as excerpt text; inspect the rendered preview`);
  if (/\bstyle\s*=/i.test(renderedExcerpt)) warnings.push(`${filename}: inline style affects layout; inspect the rendered preview`);

  return {
    filename,
    isSong,
    ok: errors.length === 0,
    errors,
    warnings,
    risks,
    visibleText: text,
    visibleCharacters,
    paragraphs,
    images,
    markerCount: renderedMarkerInfo.markers.length,
    hasFrontmatterExcerpt: Object.prototype.hasOwnProperty.call(parsed.data, 'excerpt'),
    hasFrontmatterDescription: Object.prototype.hasOwnProperty.call(parsed.data, 'description')
  };
}

function isInside(child, parent) {
  const relative = path.relative(parent, child);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function resolvePostPath(input, root) {
  const repoRoot = path.resolve(root);
  const postsRoot = path.join(repoRoot, 'source', '_posts');
  const candidate = path.resolve(repoRoot, input);
  if (!isInside(candidate, postsRoot) || path.extname(candidate).toLowerCase() !== '.md') {
    throw new Error(`post must be an existing Markdown file below source/_posts: ${input}`);
  }
  let realCandidate;
  let realPostsRoot;
  try {
    realCandidate = fs.realpathSync(candidate);
    realPostsRoot = fs.realpathSync(postsRoot);
  } catch (error) {
    throw new Error(`post does not exist: ${input}`);
  }
  if (!isInside(realCandidate, realPostsRoot)) throw new Error(`post resolves outside source/_posts: ${input}`);
  return realCandidate;
}

function listPosts(root) {
  const postsRoot = path.join(path.resolve(root), 'source', '_posts');
  const result = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && path.extname(entry.name).toLowerCase() === '.md') result.push(full);
    }
  }
  visit(postsRoot);
  return result.sort((left, right) => left.localeCompare(right, 'zh-Hant'));
}

function inspectFile(file, root) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  return inspectExcerpt(fs.readFileSync(file, 'utf8'), relative);
}

function formatReport(report) {
  const state = report.ok ? (report.warnings.length ? 'WARN' : 'PASS') : 'FAIL';
  const lines = [`${state} ${report.filename}: visible=${report.visibleCharacters}/${EXCERPT_LIMIT}, paragraphs=${report.paragraphs}, images=${report.images}, markers=${report.markerCount}`];
  for (const error of report.errors) lines.push(`  ERROR ${error}`);
  for (const warning of report.warnings) lines.push(`  WARNING ${warning}`);
  return lines.join('\n');
}

function run(options = {}) {
  const root = path.resolve(options.root || path.join(__dirname, '..'));
  const files = options.all ? listPosts(root) : [...new Set((options.posts || []).map((post) => resolvePostPath(post, root)))];
  const reports = files.map((file) => inspectFile(file, root));
  return { reports, ok: reports.every((report) => report.ok) };
}

function main(argv = process.argv.slice(2), io = console) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (error) {
    io.error(`${error.message}\n\n${usage()}`);
    return 2;
  }
  if (args.help) {
    io.log(usage());
    return 0;
  }
  try {
    const result = run({ root: path.join(__dirname, '..'), all: args.all, posts: args.posts });
    for (const report of result.reports) io.log(formatReport(report));
    return result.ok ? 0 : 1;
  } catch (error) {
    io.error(`FAIL: ${error.message}`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  EXCERPT_LIMIT,
  countImages,
  countParagraphs,
  findMoreMarkers,
  formatReport,
  inspectExcerpt,
  listPosts,
  main,
  parseArgs,
  resolvePostPath,
  run,
  visibleText
};

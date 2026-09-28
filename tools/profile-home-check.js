'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { normalizePostUrl } = require('./content-check');
const { normalizeSurfaces } = require('./lib/content-surfaces');

const DEFAULT_ROOT = path.resolve(__dirname, '..');
const PROFILE_HOME_PATH = 'source/_data/profile-home.yml';
const POSTS_PATH = 'source/_posts';
const MIN_ITEMS = 6;
const MAX_ITEMS = 10;
const EXPECTED_PATH_COUNT = 3;
const EXPECTED_FEATURED_COUNT = 4;
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COPY_STATUSES = new Set(['working/5.1-pending', 'approved/9.5', 'approved/10.6']);
const APPROVED_PATH_TITLES = ['看見現場與需求', '整理資訊與方法', '實作、驗證與修正'];
const APPROVED_PRESENTATION_KEYS = {
  'approved/9.5': ['allArticlesLabel', 'flipLabel', 'pageTitle', 'recentTitle'],
  'approved/10.6': ['flipLabel', 'pageTitle']
};

function diagnostic(code, file, url) {
  return { code, path: file, ...(url ? { url } : {}) };
}

function parseYaml(text, file, errors) {
  try {
    return yaml.load(text);
  } catch (_error) {
    errors.push(diagnostic('yaml_invalid', file));
    return undefined;
  }
}

function parsePostFrontmatter(content, source, errors) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) {
    errors.push(diagnostic('post_frontmatter_missing', source));
    return null;
  }
  const frontmatter = parseYaml(match[1], source, errors);
  if (!frontmatter || typeof frontmatter !== 'object' || Array.isArray(frontmatter)) {
    if (frontmatter !== undefined) errors.push(diagnostic('post_frontmatter_invalid', source));
    return null;
  }
  return frontmatter;
}

function walkMarkdown(directory, files = []) {
  if (!fs.existsSync(directory)) return files;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) walkMarkdown(current, files);
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) files.push(current);
  }
  return files;
}

function readPosts(root, errors) {
  const posts = [];
  const postsRoot = path.join(root, POSTS_PATH);
  for (const file of walkMarkdown(postsRoot)) {
    const source = path.relative(root, file).split(path.sep).join('/');
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch (_error) {
      errors.push(diagnostic('post_unreadable', source));
      continue;
    }
    const frontmatter = parsePostFrontmatter(content, source, errors);
    if (!frontmatter) continue;
    const url = normalizePostUrl(frontmatter.permalink);
    if (url) posts.push({ source, frontmatter, url, published: isPublished(frontmatter) });
  }
  return posts;
}

function isPublished(frontmatter) {
  const published = frontmatter.published;
  const draft = frontmatter.draft;
  return published !== false && String(published).toLowerCase() !== 'false'
    && draft !== true && String(draft).toLowerCase() !== 'true';
}

function validateProfileHome({ root = DEFAULT_ROOT, data, yamlText, posts: suppliedPosts } = {}) {
  const errors = [];
  const dataPath = path.join(root, PROFILE_HOME_PATH);
  let config = data;
  if (yamlText !== undefined) {
    config = parseYaml(yamlText, PROFILE_HOME_PATH, errors);
  } else if (config === undefined) {
    let source;
    try {
      source = fs.readFileSync(dataPath, 'utf8');
    } catch (_error) {
      errors.push(diagnostic('profile_home_unreadable', PROFILE_HOME_PATH));
      return { errors };
    }
    config = parseYaml(source, PROFILE_HOME_PATH, errors);
  }

  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    errors.push(diagnostic('schema_not_object', PROFILE_HOME_PATH));
    return { errors };
  }
  if (config.schemaVersion !== 1) errors.push(diagnostic('schema_version_invalid', PROFILE_HOME_PATH));
  if (!COPY_STATUSES.has(config.copyStatus)) errors.push(diagnostic('copy_status_invalid', PROFILE_HOME_PATH));
  if (config.copyStatus === 'approved/9.5' || config.copyStatus === 'approved/10.6') {
    const presentation = config.presentation;
    const presentationPath = `${PROFILE_HOME_PATH}#presentation`;
    if (!presentation || typeof presentation !== 'object' || Array.isArray(presentation)) {
      errors.push(diagnostic('presentation_invalid', presentationPath));
    } else {
      const expectedKeys = APPROVED_PRESENTATION_KEYS[config.copyStatus];
      const keys = Object.keys(presentation).sort();
      if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
        errors.push(diagnostic('presentation_fields_invalid', presentationPath));
      }
      for (const key of expectedKeys) {
        if (typeof presentation[key] !== 'string' || !presentation[key].trim()) {
          errors.push(diagnostic('presentation_value_invalid', `${presentationPath}.${key}`));
        }
      }
      const expectedTitle = config.copyStatus === 'approved/10.6' ? '工作與學習' : '經驗與方法';
      if (presentation.pageTitle !== expectedTitle || presentation.flipLabel !== 'SIDE B／翻到個人記憶庫'
          || (config.copyStatus === 'approved/9.5'
            && (presentation.recentTitle !== '最近正在學' || presentation.allArticlesLabel !== '看全部'))) {
        errors.push(diagnostic('presentation_copy_invalid', presentationPath));
      }
    }
    if (Object.hasOwn(config, 'intro') || Object.hasOwn(config, 'tagline')) {
      errors.push(diagnostic('presentation_explainer_forbidden', PROFILE_HOME_PATH));
    }
  }
  if (!Array.isArray(config.statusValues) || config.statusValues.length === 0
      || config.statusValues.some(value => typeof value !== 'string' || !value.trim())
      || new Set(config.statusValues).size !== config.statusValues.length) {
    errors.push(diagnostic('status_values_invalid', PROFILE_HOME_PATH));
  }
  const allowedStatuses = new Set(Array.isArray(config.statusValues) ? config.statusValues : []);

  if (!Array.isArray(config.paths) || config.paths.length !== EXPECTED_PATH_COUNT) {
    errors.push(diagnostic('path_count_invalid', PROFILE_HOME_PATH));
  }
  const paths = Array.isArray(config.paths) ? config.paths : [];
  if (['approved/9.5', 'approved/10.6'].includes(config.copyStatus)
      && paths.some((profilePath, index) => profilePath?.title !== APPROVED_PATH_TITLES[index])) {
    errors.push(diagnostic('approved_path_titles_invalid', `${PROFILE_HOME_PATH}#paths`));
  }
  const pathIds = new Set();
  const seenUrls = new Set();
  const featuredUrls = [];
  const itemUrls = [];
  const postIndex = new Map();
  const posts = suppliedPosts || readPosts(root, errors);

  for (const post of posts) {
    const url = post.url || normalizePostUrl(post.frontmatter?.permalink);
    if (!url) continue;
    const matching = postIndex.get(url) || [];
    matching.push(post);
    postIndex.set(url, matching);
  }

  paths.forEach((profilePath, pathIndex) => {
    const entryPath = `${PROFILE_HOME_PATH}#paths[${pathIndex}]`;
    if (!profilePath || typeof profilePath !== 'object' || Array.isArray(profilePath)) {
      errors.push(diagnostic('path_entry_invalid', entryPath));
      return;
    }
    if (typeof profilePath.id !== 'string' || !ID_PATTERN.test(profilePath.id)) {
      errors.push(diagnostic('path_id_invalid', entryPath));
    } else if (pathIds.has(profilePath.id)) {
      errors.push(diagnostic('path_id_duplicate', entryPath));
    } else pathIds.add(profilePath.id);
    if (typeof profilePath.title !== 'string' || !profilePath.title.trim()) errors.push(diagnostic('path_title_empty', entryPath));
    if (typeof profilePath.workingDescription !== 'string' || !profilePath.workingDescription.trim()) errors.push(diagnostic('path_description_empty', entryPath));
    if (['approved/9.5', 'approved/10.6'].includes(config.copyStatus) && profilePath.workingDescriptionVisibility !== 'internal') {
      errors.push(diagnostic('path_description_visibility_invalid', entryPath));
    }
    if (!Array.isArray(profilePath.items) || profilePath.items.length === 0) {
      errors.push(diagnostic('path_items_empty', entryPath));
      return;
    }

    profilePath.items.forEach((item, itemIndex) => {
      const itemPath = `${entryPath}.items[${itemIndex}]`;
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        errors.push(diagnostic('item_invalid', itemPath));
        return;
      }
      const rawUrl = item.url;
      const normalizedUrl = normalizePostUrl(rawUrl);
      if (!normalizedUrl || rawUrl !== normalizedUrl) {
        errors.push(diagnostic('url_invalid', itemPath, typeof rawUrl === 'string' ? rawUrl : undefined));
      } else {
        itemUrls.push(normalizedUrl);
        if (seenUrls.has(normalizedUrl)) errors.push(diagnostic('url_duplicate', itemPath, normalizedUrl));
        else seenUrls.add(normalizedUrl);

        const matches = postIndex.get(normalizedUrl) || [];
        if (matches.length > 1) {
          errors.push(diagnostic('url_multiple_posts', itemPath, normalizedUrl));
        } else if (matches.length === 0) {
          errors.push(diagnostic('url_not_published_post', itemPath, normalizedUrl));
        } else {
          const post = matches[0];
          if (!post.published) errors.push(diagnostic('url_post_unpublished', itemPath, normalizedUrl));
          else {
            try {
              const surfaces = normalizeSurfaces(post.frontmatter, { source: post.source, missingPolicy: 'legacy' }).surfaces;
              if (!surfaces.includes('profile')) errors.push(diagnostic('post_not_profile_qualified', itemPath, normalizedUrl));
            } catch (_error) {
              errors.push(diagnostic('post_surfaces_invalid', itemPath, normalizedUrl));
            }
          }
        }
      }

      if (!['featured', 'supporting'].includes(item.role)) errors.push(diagnostic('role_invalid', itemPath, normalizedUrl || undefined));
      if (typeof item.status !== 'string' || !allowedStatuses.has(item.status)) errors.push(diagnostic('status_invalid', itemPath, normalizedUrl || undefined));
      if (typeof item.selectionReason !== 'string' || !item.selectionReason.trim()) errors.push(diagnostic('selection_reason_empty', itemPath, normalizedUrl || undefined));
      if (typeof item.readerValue !== 'string' || !item.readerValue.trim()) errors.push(diagnostic('reader_value_empty', itemPath, normalizedUrl || undefined));
      if (item.role === 'featured' && normalizedUrl) featuredUrls.push(normalizedUrl);
    });
  });

  if (itemUrls.length < MIN_ITEMS || itemUrls.length > MAX_ITEMS) errors.push(diagnostic('item_count_out_of_range', PROFILE_HOME_PATH));
  if (featuredUrls.length !== EXPECTED_FEATURED_COUNT || new Set(featuredUrls).size !== EXPECTED_FEATURED_COUNT) {
    errors.push(diagnostic('featured_count_invalid', PROFILE_HOME_PATH));
  }
  return { errors, itemCount: itemUrls.length, featuredCount: featuredUrls.length };
}

function formatDiagnostics(result) {
  return result.errors.map(error => `${error.code} path=${error.path}${error.url ? ` url=${error.url}` : ''}`);
}

function runCli(root = DEFAULT_ROOT) {
  const result = validateProfileHome({ root });
  if (result.errors.length) {
    console.error('profile-home 檢查失敗：');
    formatDiagnostics(result).forEach(line => console.error(`- ${line}`));
    return 1;
  }
  console.log(`profile-home 檢查通過：3 paths、${result.itemCount} unique URLs、${result.featuredCount} featured。`);
  return 0;
}

if (require.main === module) process.exitCode = runCli();

module.exports = { validateProfileHome, formatDiagnostics, runCli };

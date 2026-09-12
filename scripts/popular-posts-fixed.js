// Render deterministic related articles without visitor tracking.
// The helper name is kept for compatibility with the existing post template.

const DEFAULT_LIMIT = 5;

function asList(value) {
  if (value == null) return [];
  if (typeof value.toArray === 'function') return value.toArray();
  return Array.isArray(value) ? value : [value];
}

function valueName(value) {
  if (value && typeof value === 'object') return value.name || value.title || value.path || '';
  return value;
}

function names(value) {
  return asList(value).map(valueName).map(item => String(item || '').trim()).filter(Boolean);
}

function normalizedPath(value) {
  let text = String(value || '').trim().replace(/\\/g, '/');
  if (!text || /^\/\//.test(text) || /^[a-z][a-z\d+.-]*:/i.test(text)) return '';
  text = text.split(/[?#]/, 1)[0].replace(/^\/+/, '');
  try {
    text = decodeURIComponent(text);
  } catch (error) {
    return '';
  }
  if (text.split('/').includes('..')) return '';
  text = text.replace(/\/index\.html$/i, '/').replace(/\/{2,}/g, '/');
  if (!text || text === 'index.html') return '/';
  return `/${text.replace(/\/+$/, '')}/`;
}

function stableHash(source, candidate) {
  let hash = 2166136261;
  for (const char of `${source}\u0000${candidate}`) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function overlap(left, right) {
  const set = new Set(right);
  return left.reduce((count, item) => count + (set.has(item) ? 1 : 0), 0);
}

function isPublished(post) {
  return Boolean(post) && post.published !== false && post.draft !== true;
}

function selectRecommendations(post, allPosts, options = {}) {
  const sourcePath = normalizedPath(post?.path);
  if (!sourcePath) return [];
  const limitValue = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.max(0, Math.min(20, Number.parseInt(limitValue, 10) || 0));
  if (!limit) return [];

  const candidateMap = new Map();
  asList(allPosts).filter(candidate => {
    const candidatePath = normalizedPath(candidate?.path);
    return isPublished(candidate) && candidatePath && candidatePath !== sourcePath && candidate.title;
  }).forEach(candidate => candidateMap.set(normalizedPath(candidate.path), candidate));
  const candidates = [...candidateMap.values()];
  const selected = [];
  const selectedPaths = new Set();

  // Explicit links are an author-controlled priority list, but still need to
  // point at a current published post and cannot point back to this post.
  for (const reference of asList(post.related_posts)) {
    const candidate = candidateMap.get(normalizedPath(valueName(reference)));
    const candidatePath = candidate && normalizedPath(candidate.path);
    if (candidate && candidatePath && !selectedPaths.has(candidatePath)) {
      selected.push(candidate);
      selectedPaths.add(candidatePath);
      if (selected.length >= limit) return selected;
    }
  }

  const sourceTopics = names(post.recommendation_topics);
  const sourceTags = names(post.tags);
  const sourceCategories = names(post.categories);
  const ranked = candidates
    .filter(candidate => !selectedPaths.has(normalizedPath(candidate.path)))
    .map(candidate => {
      const topicScore = overlap(sourceTopics, names(candidate.recommendation_topics));
      const tagScore = overlap(sourceTags, names(candidate.tags));
      const categoryScore = overlap(sourceCategories, names(candidate.categories));
      return {
        candidate,
        score: topicScore * 8 + tagScore * 3 + categoryScore,
        tie: stableHash(sourcePath, normalizedPath(candidate.path))
      };
    })
    .filter(item => item.score > 0)
    .sort((left, right) => right.score - left.score || left.tie - right.tie || normalizedPath(left.candidate.path).localeCompare(normalizedPath(right.candidate.path)));

  for (const item of ranked) {
    if (selected.length >= limit) break;
    selected.push(item.candidate);
    selectedPaths.add(normalizedPath(item.candidate.path));
  }
  return selected;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function renderRecommendations(options, post, context = {}, helperContext) {
  const config = context.config?.popular_posts || {};
  if (config.enable === false) return '';
  const limit = options && options.limit != null ? options.limit : config.limit;
  const posts = context.locals?.get('posts') || context.locals?.posts || [];
  const selected = selectRecommendations(post, posts, { limit });
  if (!selected.length) return '';
  const urlFor = context.extend?.helper?.get('url_for') || helperContext?.url_for;
  const items = selected.map(candidate => {
    const rawUrl = typeof urlFor === 'function'
      ? urlFor.call(helperContext, candidate.path)
      : `/${normalizedPath(candidate.path).replace(/^\//, '')}`;
    const title = escapeHtml(candidate.title);
    return `<li class="popular-posts-item"><div class="popular-posts-title"><h3><a href="${escapeHtml(rawUrl)}" title="${title}" rel="bookmark">${title}</a></h3></div></li>`;
  }).join('');
  return `<ul class="popular-posts">${items}</ul>`;
}

if (typeof hexo !== 'undefined' && hexo.extend?.helper) {
  hexo.extend.helper.register('popular_posts_fixed', function(options, post) {
    return renderRecommendations(options || {}, post, hexo, this);
  });
}

module.exports = {
  asList,
  escapeHtml,
  normalizedPath,
  selectRecommendations,
  stableHash,
  renderRecommendations
};

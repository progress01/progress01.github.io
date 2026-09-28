'use strict';

const { filterPostsBySurface } = require('./content-browser');

const MAX_RECENT_LEARNING_POSTS = 3;

function sourceName(post) {
  const source = String(post?.source || '').replaceAll('\\', '/').replace(/^\/+/, '');
  return source.startsWith('source/') ? source : `source/${source || '<unknown post>'}`;
}

function getRecentProfileLearningPosts({ posts, profileHome, legacyPostSources = new Set(), onWarning, limit = MAX_RECENT_LEARNING_POSTS } = {}) {
  if (!Array.isArray(posts)) throw new TypeError('profile_learning_posts_invalid');
  if (!profileHome || !Array.isArray(profileHome.paths)) throw new TypeError('profile_learning_home_invalid');
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RECENT_LEARNING_POSTS) {
    throw new RangeError(`profile_learning_limit_invalid: expected an integer from 1 to ${MAX_RECENT_LEARNING_POSTS}`);
  }

  const eligible = filterPostsBySurface(posts, 'profile', { legacyPostSources, onWarning })
    .filter(post => post.learning_status === '進行中')
    .map(post => {
      const timestamp = new Date(post.date).getTime();
      if (!Number.isFinite(timestamp)) throw new Error(`${sourceName(post)} [profile_learning_date_invalid]`);
      return { post, timestamp };
    });

  eligible.sort((left, right) => right.timestamp - left.timestamp
    || String(left.post.path || '').localeCompare(String(right.post.path || '')));
  return eligible.slice(0, limit).map(entry => entry.post);
}

module.exports = Object.freeze({ MAX_RECENT_LEARNING_POSTS, getRecentProfileLearningPosts });

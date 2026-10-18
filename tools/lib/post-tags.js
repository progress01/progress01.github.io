'use strict';

// Post.tags is a Hexo virtual relation whose query order does not follow the
// order of tag names in front matter. Keep order metadata out of serialized
// records; Hexo's page-local copy is resolved through its post ID.
const ORDERED_NAMES = Symbol('orderedPostTagNames');
const orderedNamesByPost = new WeakMap();
const orderedNamesById = new Map();

function clearPostTagOrders() {
  orderedNamesById.clear();
}

function rememberPostTagOrder(post, names) {
  if (!post || (typeof post !== 'object' && typeof post !== 'function')) return;
  const order = [...new Set((Array.isArray(names) ? names : []).map(name => String(name || '').trim()).filter(Boolean))];
  post[ORDERED_NAMES] = order;
  orderedNamesByPost.set(post, order);
  if (post._id != null) orderedNamesById.set(String(post._id), order);
}

function valuesOf(tags) {
  if (!tags) return [];
  const values = typeof tags.toArray === 'function' ? tags.toArray() : tags;
  return Array.isArray(values) ? values : [values];
}

function tagName(tag) {
  return String(tag && typeof tag === 'object' ? tag.name || '' : tag || '').trim();
}

function compareNames(left, right) {
  const a = tagName(left), b = tagName(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function getOrderedPostTags(post) {
  const values = valuesOf(post?.tags);
  const names = post?.[ORDERED_NAMES] || post?.__post?.[ORDERED_NAMES] || orderedNamesByPost.get(post) ||
    (post?._id != null ? orderedNamesById.get(String(post._id)) : undefined);
  if (!names) return post?.tags && typeof post.tags.toArray === 'function' ? [...values].sort(compareNames) : values;
  const byName = new Map(values.map(tag => [tagName(tag), tag]));
  const ordered = names.map(name => byName.get(name)).filter(Boolean);
  const included = new Set(ordered.map(tagName));
  values.filter(tag => !included.has(tagName(tag))).sort(compareNames).forEach(tag => ordered.push(tag));
  return ordered;
}

function getOrderedPostTagNames(post) {
  return getOrderedPostTags(post).map(tagName).filter(Boolean);
}

module.exports = { clearPostTagOrders, rememberPostTagOrder, getOrderedPostTags, getOrderedPostTagNames };

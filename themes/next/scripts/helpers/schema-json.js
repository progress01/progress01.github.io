/* global hexo */

'use strict';

const escapes = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};

function schemaJson(value) {
  const serialized = JSON.stringify(value);
  return (serialized === undefined ? 'null' : serialized)
    .replace(/[<>&\u2028\u2029]/g, character => escapes[character]);
}

if (typeof hexo !== 'undefined') hexo.extend.helper.register('schema_json', schemaJson);

module.exports = schemaJson;

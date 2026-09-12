// Shared tag registry. The YAML file is the only source of canonical names;
// aliases are compatibility inputs that normalize to one registered name.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const DEFAULT_PATH = path.resolve(__dirname, '..', 'source', '_data', 'content-tags.yml');

function readTagConfig(filePath = DEFAULT_PATH) {
  const source = fs.readFileSync(filePath, 'utf8');
  return yaml.load(source, { schema: yaml.FAILSAFE_SCHEMA });
}

function buildTaxonomy(config) {
  const definitions = Array.isArray(config) ? config : [];
  const errors = [];
  const canonicalNames = new Set();
  const aliasOwners = new Map();
  const aliasesByCanonical = new Map();

  definitions.forEach((definition, index) => {
    const position = `content-tags.yml 第 ${index + 1} 筆`;
    const canonical = typeof definition?.name === 'string' ? definition.name.trim() : '';
    if (!canonical) {
      errors.push(`${position} 缺少有效 name。`);
      return;
    }
    if (canonicalNames.has(canonical)) errors.push(`主標籤名稱重複：${canonical}`);
    canonicalNames.add(canonical);

    const aliases = definition.aliases == null
      ? []
      : Array.isArray(definition.aliases) ? definition.aliases : [definition.aliases];
    const cleanedAliases = [];
    aliases.forEach(aliasValue => {
      const alias = typeof aliasValue === 'string' ? aliasValue.trim() : '';
      if (!alias) {
        errors.push(`${position} 的 aliases 含有無效值。`);
        return;
      }
      if (cleanedAliases.includes(alias)) errors.push(`別名重複：${alias}（${canonical}）`);
      cleanedAliases.push(alias);
      const previous = aliasOwners.get(alias);
      if (previous && previous !== canonical) errors.push(`別名 ${alias} 同時指向 ${previous} 與 ${canonical}。`);
      aliasOwners.set(alias, canonical);
    });
    aliasesByCanonical.set(canonical, cleanedAliases);
  });

  canonicalNames.forEach(canonical => {
    const owner = aliasOwners.get(canonical);
    if (owner && owner !== canonical) errors.push(`別名 ${canonical} 指向 ${owner}，不能覆蓋主標籤。`);
  });

  const aliases = new Map();
  canonicalNames.forEach(canonical => aliases.set(canonical, canonical));
  aliasOwners.forEach((canonical, alias) => aliases.set(alias, canonical));

  return {
    definitions,
    canonicalNames,
    aliases,
    aliasesByCanonical,
    errors: [...new Set(errors)]
  };
}

function loadTaxonomy(filePath = DEFAULT_PATH) {
  return buildTaxonomy(readTagConfig(filePath));
}

module.exports = { DEFAULT_PATH, readTagConfig, buildTaxonomy, loadTaxonomy };

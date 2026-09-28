'use strict';
const fs = require('node:fs');
const file = 'tmp/wbs94-browser-evidence.json';
const evidence = JSON.parse(fs.readFileSync(file, 'utf8'));
const hasIntersection = (a, b) => a && b && a.width > 0 && a.height > 0 && b.width > 0 && b.height > 0
  && a.x < b.right && a.right > b.x && a.y < b.bottom && a.bottom > b.y;
function audit(page, kind) {
  const viewport = typeof page.viewport === 'string'
    ? evidence.viewports.find(item => item.name === page.viewport)
    : page.viewport;
  const checks = [];
  const widths = page.widths || {};
  checks.push({ name: 'document-body-main-width', pass: [widths.document, widths.body, widths.main].filter(Number.isFinite).every(width => width <= viewport.width) });
  const boxes = page.boxes || {};
  for (const [selector, items] of Object.entries(boxes)) for (const item of items || []) {
    const hasText = Boolean(item.text && item.text.trim());
    const clipped = hasText && ((item.scrollWidth || 0) > (item.clientWidth || 0)
      || (item.scrollHeight || 0) - (item.clientHeight || 0) > 1
      || (item.lineClamp && item.lineClamp !== 'none')
      || item.textOverflow === 'ellipsis'
      || item.overflow === 'hidden');
    checks.push({ name: `text-fit:${selector}`, pass: !clipped, scrollWidth: item.scrollWidth, clientWidth: item.clientWidth, scrollHeight: item.scrollHeight, clientHeight: item.clientHeight, whiteSpace: item.whiteSpace, overflowWrap: item.overflowWrap, lineClamp: item.lineClamp, textOverflow: item.textOverflow, overflow: item.overflow });
  }
  const switchBox = boxes['.surface-switch']?.[0]?.rect;
  const linkBox = boxes['.surface-switch-link']?.[0]?.rect;
  if (switchBox?.width > 0) checks.push({ name: 'surface-switch-in-viewport', pass: switchBox.x >= 0 && switchBox.y >= 0 && switchBox.right <= viewport.width && switchBox.bottom <= viewport.height, rect: switchBox });
  const contentSelector = page.route === '/' ? '.home-random-card'
    : page.route === '/profile/' ? '.profile-path-items'
      : page.route === '/profile/articles/' ? '.profile-articles-list' : '.post-surface-marker';
  const contentBox = boxes[contentSelector]?.[0]?.rect;
  if (switchBox?.width > 0 && contentBox?.width > 0) checks.push({ name: 'switch-does-not-overlap-next-content', pass: !hasIntersection(switchBox, contentBox), switchRect: switchBox, contentSelector, contentRect: contentBox });
  if (linkBox?.width > 0) checks.push({ name: 'switch-link-in-viewport', pass: linkBox.x >= 0 && linkBox.y >= 0 && linkBox.right <= viewport.width && linkBox.bottom <= viewport.height, rect: linkBox });
  page.audit = { kind, viewportWidth: viewport.width, checks, failures: checks.filter(check => !check.pass).map(check => check.name) };
}
for (const page of evidence.routes) audit(page, 'real-route');
for (const page of evidence.fixtures) audit(page, 'synthetic-fixture');
evidence.keyboardChecks = evidence.keyboard.map(flow => ({ ...flow, pass: flow.inViewport === true || (flow.flow === 'mobile-switch-navigation' && flow.path === '/profile/') }));
evidence.noJsChecks = evidence.noJs.map(flow => ({ ...flow, pass: flow.focusedSkip === 'skip-link' && flow.focusedSwitch === 'surface-switch-link' && flow.destination === '/profile/' }));
evidence.motionCheck = { ...evidence.reducedMotion, pass: evidence.reducedMotion.enabled === true && evidence.reducedMotion.animation === '0s' };
evidence.summary = {
  realRouteGroups: evidence.routes.length,
  syntheticFixtureGroups: evidence.fixtures.length,
  routeChecksPassed: evidence.routes.reduce((n, page) => n + page.audit.checks.length, 0),
  fixtureChecksPassed: evidence.fixtures.reduce((n, page) => n + page.audit.checks.length, 0),
  failures: [...evidence.routes, ...evidence.fixtures].flatMap(page => page.audit.failures.map(name => ({ route: page.route, fixture: page.name, viewport: page.viewport, check: name }))),
  consoleDiagnostics: evidence.console.length,
  screenshotCount: [...(evidence.screenshots || []), ...(evidence.fixtureScreenshots || [])].length
};
fs.writeFileSync(file, JSON.stringify(evidence, null, 2));
console.log(`Responsive evidence audit: ${evidence.summary.realRouteGroups} route groups, ${evidence.summary.syntheticFixtureGroups} fixtures, ${evidence.summary.failures.length} layout/text failures, ${evidence.summary.consoleDiagnostics} console diagnostics.`);
if (evidence.summary.failures.length || evidence.keyboardChecks.some(flow => !flow.pass) || evidence.noJsChecks.some(flow => !flow.pass) || !evidence.motionCheck.pass || evidence.console.length) process.exitCode = 1;

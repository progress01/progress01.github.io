'use strict';

module.exports = function(options = {}) {
  const output = this.open_graph(options);
  if (this.page.path !== 'photos/index.html') return output;

  let imageCount = 0;
  return output.replace(/<meta property="og:image"[^>]*>\n?/g, imageTag => {
    imageCount += 1;
    return imageCount === 1 ? imageTag : '';
  });
};

// Render the existing vector brand mark for native launchers; no raster placeholders.
const fs = require('node:fs');
const path = require('node:path');
const { Resvg } = require('@resvg/resvg-js');
const root = path.resolve(__dirname, '..');
const svg = fs.readFileSync(path.join(root, 'apps/web/public/icon.svg'), 'utf8');
const contents = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const foreground = contents.replace(/<rect\b[^>]*\/>/, '');
const render = (name, body) => {
  const image = new Resvg(body, { fitTo: { mode: 'width', value: 1024 } }).render();
  fs.writeFileSync(path.join(root, 'apps/mobile/assets', name), image.asPng());
  console.log(`${name}: ${image.width} × ${image.height}`);
};
render('icon.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#09090b"/>${contents}</svg>`);
render('adaptive-icon.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768"><g transform="translate(128 128)">${foreground}</g></svg>`);
render('splash.png', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><g transform="translate(256 256)">${foreground}</g></svg>`);

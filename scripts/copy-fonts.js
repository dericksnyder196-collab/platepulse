/* scripts/copy-fonts.js
 *
 * Copies the self-hosted font files from the @fontsource packages into
 * public/assets/fonts, so the site serves its own fonts (no third-party requests).
 *
 * Usage: npm install && npm run fonts   (then commit public/assets/fonts)
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'fonts');
const FONTS = [
    { packageName: 'barlow-condensed', weights: [500, 600] },
    { packageName: 'atkinson-hyperlegible', weights: [400, 700] }
];
const SUBSETS = ['latin', 'latin-ext'];

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

let copied = 0;
const missing = [];

for (const { packageName, weights } of FONTS) {
    const sourceDir = path.join(
        __dirname,
        '..',
        'node_modules',
        '@fontsource',
        packageName,
        'files'
    );

    for (const weight of weights) {
        for (const subset of SUBSETS) {
            const fileName = `${packageName}-${subset}-${weight}-normal.woff2`;
            const source = path.join(sourceDir, fileName);

            if (!fs.existsSync(source)) {
                missing.push(fileName);
                continue;
            }

            fs.copyFileSync(source, path.join(OUTPUT_DIR, fileName));
            copied++;
        }
    }
}

console.log(`Copied ${copied} font file(s) to public/assets/fonts.`);

if (missing.length > 0) {
    console.warn(`Not found (check the package version or file names):\n  ${missing.join('\n  ')}`);
}

if (copied === 0) {
    process.exit(1);
}

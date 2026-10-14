const path = require('node:path');
const fs = require('node:fs/promises');
const { build } = require('esbuild');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const destination = path.join(root, 'frontend/js/vendor');
    await fs.mkdir(destination, { recursive: true });
    await build({ entryPoints: [path.join(root, 'frontend/js/utils/avatarViewer.js')],
        outfile: path.join(destination, 'avatar3d.bundle.js'), bundle: true, minify: true,
        format: 'esm', target: ['es2021'], legalComments: 'external' });
    await fs.copyFile(path.join(root, 'node_modules/three/LICENSE'), path.join(destination, 'three.LICENSE.txt'));
    console.log('Built the local Three.js avatar viewer.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const projectRoot = process.cwd();
const outputDirectory = path.join(projectRoot, 'dist');
const expoCli = path.join(
  projectRoot,
  'node_modules',
  'expo',
  'bin',
  'cli'
);

await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [expoCli, 'export', '--platform', 'web', '--output-dir', 'dist'],
    {
      cwd: projectRoot,
      env: { ...process.env, GITHUB_PAGES: 'true' },
      stdio: 'inherit',
    }
  );

  child.on('error', reject);
  child.on('exit', (code) => {
    if (code === 0) {
      resolve();
      return;
    }
    reject(new Error(`Expo export exited with code ${code}`));
  });
});

await mkdir(outputDirectory, { recursive: true });
await copyFile(
  path.join(
    projectRoot,
    'node_modules',
    'coi-serviceworker',
    'coi-serviceworker.min.js'
  ),
  path.join(outputDirectory, 'coi-serviceworker.js')
);
await copyFile(
  path.join(outputDirectory, 'index.html'),
  path.join(outputDirectory, '404.html')
);
await copyFile(
  path.join(projectRoot, 'assets', 'images', 'home-manual-icon.png'),
  path.join(outputDirectory, 'home-manual-icon.png')
);
await copyFile(
  path.join(projectRoot, 'assets', 'images', 'home-manual-icon.png'),
  path.join(outputDirectory, 'apple-touch-icon.png')
);
await writeFile(path.join(outputDirectory, '.nojekyll'), '');

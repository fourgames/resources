// Screenshots live on the `screenshots` branch, which always holds exactly one commit, so the images
// never pile up in git history. This script mirrors that branch into ./images (gitignored on main).
//   node scripts/images.mjs pull   clone or refresh ./images from the branch
//   node scripts/images.mjs push   replace the branch with a single commit of ./images (if anything changed)
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, IMAGES_DIR } from './lib/data.mjs';

const BRANCH = 'screenshots';
const git = (args, cwd = IMAGES_DIR) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

// In GitHub Actions the main checkout's credentials aren't visible to a second clone, so use the token.
function remoteUrl() {
  const origin = git(['remote', 'get-url', 'origin'], ROOT);
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  return token && repo ? `https://x-access-token:${token}@github.com/${repo}.git` : origin;
}

function pull() {
  if (!existsSync(join(IMAGES_DIR, '.git'))) {
    git(['clone', '--quiet', '--depth', '1', '--branch', BRANCH, '--single-branch', remoteUrl(), IMAGES_DIR], ROOT);
  } else {
    git(['remote', 'set-url', 'origin', remoteUrl()]);
    git(['fetch', '--quiet', '--depth', '1', 'origin', BRANCH]);
    git(['reset', '--quiet', '--hard', 'FETCH_HEAD']);
    git(['clean', '--quiet', '-fd']);
  }
  console.log(`images/ is at ${BRANCH}@${git(['rev-parse', '--short', 'HEAD'])}`);
}

function push() {
  git(['add', '-A']);
  if (!git(['status', '--porcelain'])) {
    console.log('No image changes to publish.');
    return;
  }
  // A fresh parentless commit each time: the branch never grows.
  git(['checkout', '--quiet', '--orphan', 'snapshot']);
  git(['commit', '--quiet', '-m', `Screenshots ${new Date().toISOString().slice(0, 10)}`]);
  git(['push', '--quiet', '--force', 'origin', `snapshot:${BRANCH}`]);
  git(['branch', '--quiet', '-M', BRANCH]);
  console.log(`Published images to ${BRANCH}@${git(['rev-parse', '--short', 'HEAD'])}`);
}

const command = process.argv[2];
if (command === 'pull') pull();
else if (command === 'push') push();
else {
  console.error('Usage: node scripts/images.mjs pull|push');
  process.exit(1);
}

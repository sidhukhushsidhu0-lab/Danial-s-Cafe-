/**
 * Full GitHub project uploader
 * Directly uploads all 97 project files to https://github.com/sidhukhushsidhu0-lab/Ai-Website-Design
 * using GitHub Git Database REST API.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const OWNER = 'sidhukhushsidhu0-lab';
const REPO = 'Final-website';
const PROJECT_DIR = __dirname;
const IGNORE = [
  'node_modules',
  '.git',
  'dist',
  'dist-ssr',
  '.output',
  '.vinxi',
  '.tanstack',
  '.nitro',
  '.wrangler',
  '.vscode',
  '.idea',
  'upload_to_github.js'
];

function apiRequest(token, method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: endpoint,
      method: method,
      headers: {
        'User-Agent': 'NodeGitHubUploader',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    };
    if (dataString) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(dataString);
    }

    const req = https.request(options, (res) => {
      let chunks = '';
      res.on('data', chunk => { chunks += chunk; });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = chunks ? JSON.parse(chunks) : {};
        } catch (e) {
          parsed = { raw: chunks };
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`GitHub API Error [${res.statusCode} ${method} ${endpoint}]: ${parsed.message || chunks}`));
        }
      });
    });

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

function scanFiles(dir, base = '') {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (IGNORE.includes(item)) continue;
    const full = path.join(dir, item);
    const rel = path.join(base, item).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results = results.concat(scanFiles(full, rel));
    } else {
      results.push({ fullPath: full, relPath: rel, size: stat.size });
    }
  }
  return results;
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.argv[2];
  if (!token) {
    console.error('ERROR: No GitHub token provided.');
    console.error('Usage: node upload_to_github.js <YOUR_GITHUB_PERSONAL_ACCESS_TOKEN>');
    process.exit(1);
  }

  console.log(`===============================================`);
  console.log(`Starting GitHub Upload to ${OWNER}/${REPO}`);
  console.log(`===============================================`);

  // 1. Verify token & get authenticated user
  console.log('\n[1/6] Verifying GitHub token...');
  const user = await apiRequest(token, 'GET', '/user');
  console.log(` Authenticated as: ${user.login} (${user.email || 'No public email'})`);

  // 2. Check if repository exists or create it
  console.log('\n[2/6] Checking repository status...');
  let repoExists = false;
  try {
    await apiRequest(token, 'GET', `/repos/${OWNER}/${REPO}`);
    repoExists = true;
    console.log(` Repository https://github.com/${OWNER}/${REPO} exists.`);
  } catch (err) {
    console.log(` Repository not found or not initialized. Creating repository ${REPO}...`);
    await apiRequest(token, 'POST', '/user/repos', {
      name: REPO,
      description: 'AI Website Design - Cafe & Bistro Modern Web Application',
      private: false,
      auto_init: false
    });
    console.log(` Repository created successfully!`);
  }

  // 3. Scan local files
  console.log('\n[3/6] Scanning local files in project directory...');
  const files = scanFiles(PROJECT_DIR);
  console.log(` Found ${files.length} project files to upload.`);

  // 4. Upload blobs
  console.log('\n[4/6] Creating Git blobs for all files...');
  const treeItems = [];
  let count = 0;
  for (const file of files) {
    count++;
    process.stdout.write(`\r[${count}/${files.length}] Uploading ${file.relPath}...`);
    const contentBuffer = fs.readFileSync(file.fullPath);
    const isBinary = /[\x00-\x08\x0E-\x1F]/.test(contentBuffer.slice(0, 8000));
    
    let blobData;
    if (isBinary || file.relPath.endsWith('.ico') || file.relPath.endsWith('.jpg') || file.relPath.endsWith('.png')) {
      blobData = {
        content: contentBuffer.toString('base64'),
        encoding: 'base64'
      };
    } else {
      blobData = {
        content: contentBuffer.toString('utf8'),
        encoding: 'utf-8'
      };
    }

    const blobRes = await apiRequest(token, 'POST', `/repos/${OWNER}/${REPO}/git/blobs`, blobData);
    treeItems.push({
      path: file.relPath,
      mode: '100644',
      type: 'blob',
      sha: blobRes.sha
    });
  }
  console.log(`\n All ${treeItems.length} blobs successfully created.`);

  // 5. Create Git Tree and Commit
  console.log('\n[5/6] Creating Git Tree and Commit...');
  const treeRes = await apiRequest(token, 'POST', `/repos/${OWNER}/${REPO}/git/trees`, {
    tree: treeItems
  });
  console.log(` Git Tree created (SHA: ${treeRes.sha})`);

  let parentCommitSha = null;
  try {
    const ref = await apiRequest(token, 'GET', `/repos/${OWNER}/${REPO}/git/ref/heads/main`);
    parentCommitSha = ref.object.sha;
  } catch (e) {
    // Branch may not exist yet
  }

  const commitData = {
    message: 'Upload complete website project: Cafe & Bistro web application with active navigation, email dialogs, and admin store',
    tree: treeRes.sha,
    parents: parentCommitSha ? [parentCommitSha] : []
  };

  const commitRes = await apiRequest(token, 'POST', `/repos/${OWNER}/${REPO}/git/commits`, commitData);
  console.log(` Git Commit created (SHA: ${commitRes.sha})`);

  // 6. Update reference to point to new commit
  console.log('\n[6/6] Updating "main" branch reference...');
  try {
    await apiRequest(token, 'PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/main`, {
      sha: commitRes.sha,
      force: true
    });
    console.log(` Branch "main" updated to ${commitRes.sha}`);
  } catch (e) {
    // If ref doesn't exist, create it
    await apiRequest(token, 'POST', `/repos/${OWNER}/${REPO}/git/refs`, {
      ref: 'refs/heads/main',
      sha: commitRes.sha
    });
    console.log(` Branch "main" created pointing to ${commitRes.sha}`);
  }

  console.log(`\n================================================================`);
  console.log(` SUCCESS! All ${files.length} project files uploaded with ZERO pending!`);
  console.log(` Repository URL: https://github.com/${OWNER}/${REPO}`);
  console.log(`================================================================`);
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});

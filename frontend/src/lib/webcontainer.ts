// ============================================================
// WebContainer Runtime — 생성된 코드를 브라우저에서 실행
// @webcontainer/api를 사용해 Node.js 환경을 브라우저 내에서 부트
// ============================================================

import { WebContainer, type FileSystemTree } from '@webcontainer/api';
import type { VirtualFile } from './code-generator';

let instance: WebContainer | null = null;
let booting = false;

export type ContainerStatus = 'idle' | 'booting' | 'ready' | 'installing' | 'running' | 'error';

export interface ContainerState {
  status: ContainerStatus;
  previewUrl: string | null;
  logs: string[];
  error: string | null;
}

// ── Boot (singleton) ────────────────────────────────────────────

export async function bootContainer(): Promise<WebContainer> {
  if (instance) return instance;
  if (booting) {
    // Wait for existing boot
    while (booting) await new Promise(r => setTimeout(r, 100));
    if (instance) return instance;
  }

  booting = true;
  try {
    instance = await WebContainer.boot();
    booting = false;
    return instance;
  } catch (err) {
    booting = false;
    throw err;
  }
}

// ── Convert VirtualFile[] to FileSystemTree ─────────────────────

export function filesToTree(files: VirtualFile[]): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const file of files) {
    const parts = file.path.split('/');
    let current: any = tree;

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i];
      if (!current[dir]) {
        current[dir] = { directory: {} };
      }
      current = current[dir].directory;
    }

    const fileName = parts[parts.length - 1];
    current[fileName] = { file: { contents: file.content } };
  }

  return tree;
}

// ── Ensure package.json exists ──────────────────────────────────

function ensurePackageJson(files: VirtualFile[], lang: string, lib: string): VirtualFile[] {
  const hasPackageJson = files.some(f => f.path === 'package.json');
  if (hasPackageJson || lang !== 'TypeScript') return files;

  // Generate a basic package.json for TypeScript/React projects
  const deps: Record<string, string> = { react: '^19.0.0', 'react-dom': '^19.0.0' };
  const devDeps: Record<string, string> = {
    vite: '^6.0.0',
    typescript: '^5.6.0',
    '@vitejs/plugin-react': '^4.3.0',
    '@types/react': '^19.0.0',
    '@types/react-dom': '^19.0.0',
  };

  if (lib.toLowerCase().includes('next')) {
    delete deps.react; // Next includes react
    deps.next = '^15.0.0';
  } else if (lib.toLowerCase().includes('express')) {
    deps.express = '^4.19.0';
    devDeps['@types/express'] = '^4.17.0';
  }

  const pkgJson: VirtualFile = {
    path: 'package.json',
    content: JSON.stringify({
      name: 'govibe-project',
      private: true,
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: deps,
      devDependencies: devDeps,
    }, null, 2),
    language: 'json',
    stepIndex: 0,
  };

  // Also ensure vite.config
  const hasViteConfig = files.some(f => f.path.includes('vite.config'));
  const extras = [pkgJson];
  if (!hasViteConfig) {
    extras.push({
      path: 'vite.config.ts',
      content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n`,
      language: 'typescript',
      stepIndex: 0,
    });
  }

  // Ensure index.html
  const hasIndexHtml = files.some(f => f.path === 'index.html');
  if (!hasIndexHtml) {
    extras.push({
      path: 'index.html',
      content: `<!DOCTYPE html>\n<html lang="ko">\n<head>\n  <meta charset="UTF-8" />\n  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n  <title>GoVibe Project</title>\n</head>\n<body>\n  <div id="root"></div>\n  <script type="module" src="/src/main.tsx"></script>\n</body>\n</html>`,
      language: 'html',
      stepIndex: 0,
    });
  }

  return [...extras, ...files];
}

// ── Mount + Install + Run ───────────────────────────────────────

export async function runProject(
  files: VirtualFile[],
  lang: string,
  lib: string,
  onLog: (msg: string) => void,
  onStatus: (status: ContainerStatus) => void,
  onPreviewUrl: (url: string) => void,
): Promise<void> {
  onStatus('booting');
  onLog('🔄 WebContainer 부팅 중...');

  let wc: WebContainer;
  try {
    wc = await bootContainer();
  } catch (err: any) {
    onStatus('error');
    onLog(`✗ WebContainer 부팅 실패: ${err.message}`);
    onLog('COOP/COEP 헤더가 필요합니다. Vercel 배포 환경에서만 작동합니다.');
    return;
  }

  onLog('✓ WebContainer 부팅 완료');
  onStatus('ready');

  // Prepare files
  const allFiles = ensurePackageJson(files, lang, lib);
  const tree = filesToTree(allFiles);

  onLog(`📁 ${allFiles.length}개 파일 마운트 중...`);
  await wc.mount(tree);
  onLog('✓ 파일 마운트 완료');

  // Check if it's a Node.js project (has package.json)
  const hasPackageJson = allFiles.some(f => f.path === 'package.json');

  if (hasPackageJson) {
    // npm install
    onStatus('installing');
    onLog('📦 npm install 실행 중... (1-2분 소요)');

    const installProcess = await wc.spawn('npm', ['install']);

    installProcess.output.pipeTo(new WritableStream({
      write(data) { onLog(`  ${data}`); },
    }));

    const installExitCode = await installProcess.exit;
    if (installExitCode !== 0) {
      onStatus('error');
      onLog(`✗ npm install 실패 (exit code: ${installExitCode})`);
      return;
    }
    onLog('✓ npm install 완료');

    // Start dev server
    onStatus('running');
    onLog('🚀 개발 서버 시작 중...');

    const devProcess = await wc.spawn('npm', ['run', 'dev']);

    devProcess.output.pipeTo(new WritableStream({
      write(data) { onLog(`  ${data}`); },
    }));

    // Listen for server ready
    wc.on('server-ready', (port, url) => {
      onLog(`✓ 서버 시작! 포트 ${port}: ${url}`);
      onPreviewUrl(url);
    });

  } else if (allFiles.some(f => f.path.endsWith('.html'))) {
    // Static HTML — use simple server
    onStatus('running');
    onLog('📄 정적 파일 서빙 중...');

    await wc.spawn('npx', ['serve', '.', '-l', '3000']);
    wc.on('server-ready', (port, url) => {
      onLog(`✓ 서버 시작! ${url}`);
      onPreviewUrl(url);
    });

  } else {
    // Python or other — just show files
    onStatus('ready');
    onLog('ℹ️ Node.js 프로젝트가 아닙니다. 코드 미리보기만 가능합니다.');
  }
}

// ── Teardown ────────────────────────────────────────────────────

export async function teardown() {
  if (instance) {
    instance.teardown();
    instance = null;
  }
}

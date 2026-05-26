// ============================================================
// API Client — connects frontend to backend
// ============================================================

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface AnalyzeRequest {
  githubUrl?: string;
  files?: { path: string; content: string }[];
}

export interface Stone {
  x: number; y: number; health: number;
  inAtari: boolean; label: string;
  lines?: number; complexity?: number; pageRank?: number;
}

export interface Candidate {
  rank: number; actionId: string; intent: string; type: string;
  badge: '★묘수' | '○선수' | '○정석' | '△후수' | '✗실착';
  probability: number; qValue: number; visits: number;
  deltaHealth: number; deltaWinRate: number; targetFile: string;
  myoReasons: string[]; boardX?: number; boardY?: number;
}

export interface MctsNode {
  id: string; intent: string; type: string; badge: string;
  q: number; prior: number; visits: number; depth: number;
  isMyo: boolean; children: MctsNode[];
}

export interface AnalyzeResponse {
  ok: boolean;
  analysis: {
    totalFiles: number; totalLines: number; avgComplexity: number;
    avgHealth: number; winRate: number; testCoverage: number;
    cycleCount: number; riskModules: string[];
  };
  stones: Stone[];
  candidates: Candidate[];
  mctsTree: MctsNode;
}

export async function analyzeProject(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  const res = await fetch(`${API_BASE}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Network error' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function pingBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

// ── File System Access API (로컬 폴더 읽기) ──────────────────

export interface LocalFile { path: string; content: string; }

export async function readLocalFolder(): Promise<LocalFile[]> {
  if (!('showDirectoryPicker' in window)) {
    throw new Error('이 브라우저는 폴더 선택을 지원하지 않습니다. Chrome/Edge를 사용해주세요.');
  }

  const dirHandle = await (window as any).showDirectoryPicker({ mode: 'read' });
  const files: LocalFile[] = [];
  const CODE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.cs', '.rb', '.vue']);
  const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'vendor']);
  const MAX_FILES = 150;
  const MAX_SIZE = 150_000;

  async function walk(handle: any, prefix = '') {
    if (files.length >= MAX_FILES) return;
    for await (const [name, entry] of handle.entries()) {
      if (files.length >= MAX_FILES) break;
      if (IGNORE.has(name)) continue;

      const relPath = prefix ? `${prefix}/${name}` : name;

      if (entry.kind === 'directory') {
        await walk(entry, relPath);
      } else {
        const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
        if (!CODE_EXTS.has(ext)) continue;
        try {
          const file = await entry.getFile();
          if (file.size > MAX_SIZE) continue;
          const content = await file.text();
          files.push({ path: relPath, content });
        } catch {}
      }
    }
  }

  await walk(dirHandle);
  return files;
}

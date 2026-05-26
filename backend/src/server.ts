// ============================================================
// Baduck Backend API Server
// POST /api/analyze — 실제 코드 분석 + Claude AI 묘수 생성
// ============================================================

import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as https from 'https';
import { exec } from 'child_process';
import { promisify } from 'util';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';
import { collectFiles, analyzeFiles } from './analyzer';

const execAsync = promisify(exec);

// Download file via HTTPS with redirect following (Node.js native)
function httpsDownload(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string, redirects = 0) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      https.get(reqUrl, { headers: { 'User-Agent': 'BaduckCoding/2.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return doRequest(res.headers.location, redirects + 1);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(destPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => { fileStream.close(); resolve(); });
        fileStream.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}
import { generateCandidates, buildMctsTree } from './candidates';
import { generateLLMCandidates } from './llm';
import { checkRateLimit } from './rate-limiter';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '20mb' }));

function safeRm(dir: string) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    version: '2.0.0',
    features: ['analyze', 'ai-candidates'],
  });
});

// Main analysis endpoint
app.post('/api/analyze', async (req, res) => {
  // Rate limiting by IP
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.socket.remoteAddress ?? 'unknown';
  const rate = checkRateLimit(ip);
  res.setHeader('X-RateLimit-Remaining', rate.remaining);

  if (!rate.allowed) {
    const mins = Math.ceil(rate.resetInMs / 60000);
    return res.status(429).json({
      error: `요청 한도 초과입니다. ${mins}분 후에 다시 시도해주세요. (시간당 10회 제한)`,
    });
  }

  const { githubUrl, files: uploadedFiles } = req.body as {
    githubUrl?: string;
    files?: { path: string; content: string }[];
  };

  let tempDir: string | null = null;

  try {
    let fileEntries: { path: string; content: string; lines: number }[] = [];

    // GitHub URL — download tarball via GitHub API (no git needed)
    if (githubUrl) {
      const ghMatch = githubUrl.match(/github\.com\/([^\/]+)\/([^\/\s.]+)/);
      if (!ghMatch) {
        return res.status(400).json({ error: 'GitHub URL 형식이 올바르지 않습니다. (예: https://github.com/user/repo)' });
      }
      const [, owner, repo] = ghMatch;
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'baduck-'));
      const tarPath = path.join(tempDir, 'repo.tar.gz');

      console.log(`[analyze] Downloading: ${owner}/${repo}`);

      // Try multiple download strategies
      let downloaded = false;

      // Strategy 1: codeload.github.com (direct, no redirect)
      for (const branch of ['main', 'master']) {
        if (downloaded) break;
        const url = `https://codeload.github.com/${owner}/${repo}/tar.gz/${branch}`;
        try {
          console.log(`[analyze] Trying codeload (${branch})...`);
          await httpsDownload(url, tarPath);
          const sz = fs.statSync(tarPath).size;
          if (sz > 100) { downloaded = true; console.log(`[analyze] Downloaded ${sz} bytes`); }
          else { fs.unlinkSync(tarPath); }
        } catch { /* try next */ }
      }

      // Strategy 2: GitHub API tarball
      if (!downloaded) {
        try {
          console.log('[analyze] Trying GitHub API tarball...');
          await httpsDownload(`https://api.github.com/repos/${owner}/${repo}/tarball`, tarPath);
          if (fs.statSync(tarPath).size > 100) downloaded = true;
        } catch { /* try next */ }
      }

      if (!downloaded) {
        return res.status(400).json({ error: '저장소를 다운로드할 수 없습니다. 공개 저장소인지 확인해주세요.' });
      }

      // Extract
      try {
        await execAsync(`tar -xzf "${tarPath}" -C "${tempDir}" --strip-components=1`, { timeout: 30000 });
        fs.unlinkSync(tarPath);
      } catch (extractErr: any) {
        console.error('[analyze] tar extract failed:', extractErr.message);
        return res.status(500).json({ error: '다운로드한 파일 압축 해제 실패' });
      }

      fileEntries = collectFiles(tempDir);
    }

    // Uploaded files
    else if (uploadedFiles?.length) {
      fileEntries = uploadedFiles.map(f => ({
        path: f.path,
        content: f.content,
        lines: f.content.split('\n').length,
      }));
    }

    else {
      return res.status(400).json({ error: 'githubUrl 또는 files가 필요합니다.' });
    }

    if (fileEntries.length === 0) {
      return res.status(400).json({ error: '코드 파일을 찾을 수 없습니다. (.ts .tsx .js .py .go .java 등)' });
    }

    console.log(`[analyze] ${fileEntries.length}개 파일 분석 시작`);

    // Core analysis (always runs)
    const result = analyzeFiles(fileEntries);

    // LLM candidates (Claude API — if key available)
    let candidates = await generateLLMCandidates(result, fileEntries);
    const usedLLM = candidates !== null;

    // Fallback to heuristics if LLM unavailable or failed
    if (!candidates) {
      candidates = generateCandidates(result);
    }

    const mctsTree = buildMctsTree(candidates as any);

    // Go coordinate system (A-T, skipping I) + SGF format
    const GO_COLS = 'ABCDEFGHJKLMNOPQRST';
    function toGoCoord(x: number, y: number): string {
      return `${GO_COLS[Math.min(x, 18)] ?? '?'}${19 - Math.min(y, 18)}`;
    }
    function toSgfCoord(x: number, y: number): string {
      const a = 'a'.charCodeAt(0);
      return String.fromCharCode(a + Math.min(x, 18)) + String.fromCharCode(a + Math.min(y, 18));
    }

    // Board stones with Go/SGF coordinates
    const stones = result.modules
      .filter(m => !/\.(test|spec)\./.test(m.path))
      .sort((a, b) => b.pageRank - a.pageRank)
      .slice(0, 35)
      .map(m => ({
        x: m.boardX,
        y: m.boardY,
        health: Math.round(m.health * 100) / 100,
        inAtari: m.inAtari,
        label: m.path,
        lines: m.lines,
        complexity: m.complexity,
        pageRank: Math.round(m.pageRank * 100) / 100,
        goCoord: toGoCoord(m.boardX, m.boardY),
        sgfCoord: toSgfCoord(m.boardX, m.boardY),
      }));

    console.log(`[analyze] 완료. Win-Rate=${result.winRate}%, LLM=${usedLLM}, 묘수=${candidates.filter((c: any) => c.badge === '★묘수').length}개`);

    res.json({
      ok: true,
      usedLLM,
      analysis: {
        totalFiles: result.totalFiles,
        totalLines: result.totalLines,
        avgComplexity: Math.round(result.avgComplexity * 10) / 10,
        avgHealth: Math.round(result.avgHealth * 100) / 100,
        winRate: result.winRate,
        testCoverage: Math.round(result.testCoverage * 100),
        cycleCount: result.cycles.length,
        riskModules: result.riskModules,
      },
      stones,
      candidates,
      mctsTree,
    });

  } catch (err: any) {
    console.error('[analyze] Error:', err.message);
    const msg = err.message?.includes('not found') || err.message?.includes('Repository')
      ? '저장소를 찾을 수 없습니다. URL을 확인해주세요.'
      : err.message?.includes('authentication') || err.message?.includes('403')
      ? '비공개 저장소는 지원하지 않습니다. 공개 저장소 URL을 입력해주세요.'
      : `분석 중 오류가 발생했습니다: ${err.message}`;
    res.status(500).json({ error: msg });
  } finally {
    if (tempDir) safeRm(tempDir);
  }
});

app.listen(PORT, () => {
  console.log(`Baduck API v2 (LLM=${!!process.env.ANTHROPIC_API_KEY}) running on port ${PORT}`);
});

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Sedol Maestro: Codebase-to-Baduck Spec Bridge (maestro-bridge.py)

Scans a codebase, calculates file metrics, and encodes the directory
into a 19x19 Go (Baduck) board state JSON (board_state.json).
"""

import os
import json
import hashlib
import argparse
import pathlib

GO_COLS = "ABCDEFGHJKLMNOPQRST"

def to_go_coord(x: int, y: int) -> str:
    col = GO_COLS[min(x, 18)]
    row = 19 - min(y, 18)
    return f"{col}{row}"

def get_file_health_and_complexity(filepath: pathlib.Path) -> tuple[float, float]:
    """Calculates code complexity and health based on simple line scans."""
    try:
        content = filepath.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return 0.5, 5.0

    lines = content.splitlines()
    total_lines = len(lines)
    if total_lines == 0:
        return 1.0, 0.0

    # Simple heuristic complexity: count control keywords
    complexity_keywords = ["if ", "for ", "while ", "function ", "const ", "class ", "interface "]
    complexity_count = sum(content.count(kw) for kw in complexity_keywords)
    avg_complexity = (complexity_count / total_lines) * 100.0

    # Health deduction for too long files or deep nestings
    health = 1.0
    if total_lines > 500:
        health -= 0.2
    if total_lines > 1000:
        health -= 0.2
    
    # Check for potential bad smells
    bad_smells = ["console.log", "TODO", "FIXME", "any", "as any"]
    smell_count = sum(content.count(smell) for smell in bad_smells)
    health -= min(0.4, smell_count * 0.05)

    return max(0.2, min(1.0, health)), max(1.0, min(50.0, avg_complexity))

def scan_codebase(target_dir: str) -> dict:
    """Scans target directory and outputs board stones and analysis metrics."""
    target_path = pathlib.Path(target_dir)
    if not target_path.exists():
        raise FileNotFoundError(f"Target directory {target_dir} not found.")

    stones = []
    total_files = 0
    total_lines = 0
    sum_health = 0.0
    sum_complexity = 0.0
    test_files_count = 0

    # Extensions to track
    valid_exts = {".ts", ".tsx", ".js", ".jsx", ".py", ".json", ".html", ".css"}
    ignored_dirs = {"node_modules", ".git", "dist", ".vercel", ".remember"}

    for root, dirs, files in os.walk(target_path):
        # Prune ignored directories in-place
        dirs[:] = [d for d in dirs if d not in ignored_dirs]

        for file in files:
            file_path = pathlib.Path(root) / file
            if file_path.suffix not in valid_exts:
                continue

            # Skip locks
            if "lock" in file.lower():
                continue

            total_files += 1
            try:
                lines_count = len(file_path.read_text(encoding="utf-8", errors="ignore").splitlines())
            except Exception:
                lines_count = 0
            total_lines += lines_count

            if "test" in file.lower() or "spec" in file.lower():
                test_files_count += 1

            health, complexity = get_file_health_and_complexity(file_path)
            sum_health += health
            sum_complexity += complexity

            # Deterministic coordinate mapping using MD5 hash of filename
            rel_path = file_path.relative_to(target_path).as_posix()
            hasher = hashlib.md5(rel_path.encode("utf-8"))
            hash_bytes = hasher.digest()
            
            # Map x, y securely within [0, 18]
            x = hash_bytes[0] % 19
            y = hash_bytes[1] % 19

            stones.append({
                "x": x,
                "y": y,
                "health": round(health, 2),
                "inAtari": health < 0.45,
                "label": file,
                "path": rel_path
            })

    # Avoid zero division
    avg_health = sum_health / total_files if total_files > 0 else 1.0
    avg_complexity = sum_complexity / total_files if total_files > 0 else 1.0
    test_coverage = int((test_files_count / total_files) * 100) if total_files > 0 else 0

    # Scientific win-rate formula based on health, complexity and test pass
    win_rate = int((avg_health * 0.5 + (1.0 - (avg_complexity / 50.0)) * 0.3 + (test_coverage / 100.0) * 0.2) * 100)
    win_rate = max(10, min(99, win_rate))

    return {
        "stones": stones,
        "analysis": {
            "winRate": win_rate,
            "totalFiles": total_files,
            "totalLines": total_lines,
            "avgHealth": round(avg_health, 2),
            "avgComplexity": round(avg_complexity, 2),
            "testCoverage": test_coverage
        }
    }

def main():
    parser = argparse.ArgumentParser(description="Sedol Maestro Codebase Spec Scan Bridge")
    parser.add_argument("target", help="Directory path to scan")
    parser.add_argument("--out", "-o", default="board_state.json", help="Output JSON path")
    args = parser.parse_args()

    try:
        print(f"Scanning Codebase: {args.target}...")
        result = scan_codebase(args.target)
        
        # Write to JSON
        with open(args.out, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"Success! Mapped {result['analysis']['totalFiles']} files to Baduck stones.")
        print(f"  Win-Rate Calculated: {result['analysis']['winRate']}%")
        print(f"  Output saved to: {args.out}")
    except Exception as e:
        print(f"Failed to scan: {e}")
        raise SystemExit(1)

if __name__ == "__main__":
    main()

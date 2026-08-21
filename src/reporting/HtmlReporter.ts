import * as fs from 'fs';
import * as path from 'path';
import type { ExecutionSummary, CategorySummary, TestResult } from '../types';
import { getLocalDateStr } from '../utils/audioHelper';

export class HtmlReporter {
  private outputDir: string;

  constructor(outputDir?: string) {
    this.outputDir = outputDir || path.resolve(process.cwd(), 'reports');
  }

  generate(summary: ExecutionSummary): string {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const passRate = (summary.passRate * 100).toFixed(1);
    const overallStatus = summary.passRate >= 0.8 ? 'PASS' : 'FAIL';
    const overallColor = summary.passRate >= 0.8 ? '#22c55e' : '#ef4444';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shunya Labs STT & TTS Test Report — ${summary.date}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 2rem; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    h2 { font-size: 1.2rem; margin: 2rem 0 1rem; color: #94a3b8; }
    .banner { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; border-radius: 0.75rem; margin-bottom: 2rem; }
    .banner.pass { background: linear-gradient(135deg, #064e3b, #065f46); }
    .banner.fail { background: linear-gradient(135deg, #7f1d1d, #991b1b); }
    .banner h2 { margin: 0; color: white; font-size: 1.8rem; }
    .banner .stats { margin-left: auto; text-align: right; }
    .banner .stats span { display: inline-block; margin-left: 1.5rem; font-size: 0.9rem; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
    .kpi { background: #1e293b; border-radius: 0.75rem; padding: 1.25rem; border: 1px solid #334155; }
    .kpi .label { font-size: 0.8rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
    .kpi .value { font-size: 1.5rem; font-weight: 700; margin-top: 0.25rem; }
    .kpi .value.green { color: #22c55e; }
    .kpi .value.red { color: #ef4444; }
    .kpi .value.yellow { color: #eab308; }
    .kpi .value.cyan { color: #06b6d4; }
    table { width: 100%; border-collapse: collapse; background: #1e293b; border-radius: 0.75rem; overflow: hidden; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid #334155; font-size: 0.9rem; }
    th { background: #334155; color: #94a3b8; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
    td.pass { color: #22c55e; }
    td.fail { color: #ef4444; }
    td.error { color: #f97316; }
    tr:hover { background: #1e293b; }
    .module-row { cursor: pointer; }
    .module-row:hover { background: #334155; }
    .detail-row { display: none; }
    .detail-row.open { display: table-row; }
    .detail-cell { padding: 0 !important; }
    .detail-inner { padding: 0 1rem 1rem; }
    .summary-row { font-weight: 600; background: #1e293b; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge.pass { background: #065f46; color: #22c55e; }
    .badge.fail { background: #7f1d1d; color: #ef4444; }
    .badge.skip { background: #713f12; color: #eab308; }
    .badge.tts { background: #4338ca; color: #a5b4fc; }
    .badge.stt { background: #0e7490; color: #67e8f9; }
    .failed-tests { margin-top: 2rem; }
    .failed-item { background: #1e293b; border-radius: 0.5rem; padding: 1rem; margin-bottom: 0.75rem; border: 1px solid #7f1d1d; }
    .failed-item .test-id { font-weight: 600; color: #f87171; }
    .failed-item .reason { margin-top: 0.5rem; color: #94a3b8; font-family: monospace; font-size: 0.85rem; white-space: pre-wrap; }
  </style>
</head>
<body>
  <div class="banner ${overallStatus === 'PASS' ? 'pass' : 'fail'}">
    <div>
      <h1 style="font-size: 1.8rem; margin:0;">🎙️ Shunya Labs STT & TTS Test Execution</h1>
      <div style="font-size: 0.9rem; opacity: 0.9; margin-top: 0.25rem;">Overall Status: <strong>${overallStatus}</strong></div>
    </div>
    <div class="stats">
      <span>${summary.date}</span>
      <span>${summary.totalTests} tests</span>
      <span>${summary.durationMs > 0 ? (summary.durationMs / 1000).toFixed(1) + 's' : ''}</span>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi">
      <div class="label">Pass Rate</div>
      <div class="value ${passRate >= '80' ? 'green' : 'red'}">${passRate}%</div>
    </div>
    <div class="kpi">
      <div class="label">Passed / Total</div>
      <div class="value">${summary.passed} / ${summary.totalTests}</div>
    </div>
    <div class="kpi">
      <div class="label">Failed</div>
      <div class="value red">${summary.failed}</div>
    </div>
    <div class="kpi">
      <div class="label">Skipped</div>
      <div class="value yellow">${summary.skipped}</div>
    </div>
  </div>

  <h2>Per-Module Summary</h2>
  <table>
    <thead>
      <tr><th>Module</th><th>Total</th><th>Passed</th><th>Failed</th><th>Skipped</th><th>Avg Latency</th><th>P50</th><th>P95</th></tr>
    </thead>
    <tbody>
      ${summary.categories.map(c => `<tr>
        <td><strong>${c.module}</strong></td>
        <td>${c.total}</td>
        <td class="pass">${c.passed}</td>
        <td class="fail">${c.failed}</td>
        <td>${c.skipped}</td>
        <td>${c.avgLatencyMs.toFixed(0)}ms</td>
        <td>${c.p50LatencyMs.toFixed(0)}ms</td>
        <td>${c.p95LatencyMs.toFixed(0)}ms</td>
      </tr>`).join('')}
      <tr class="summary-row">
        <td><strong>TOTAL</strong></td>
        <td>${summary.totalTests}</td>
        <td class="pass">${summary.passed}</td>
        <td class="fail">${summary.failed}</td>
        <td>${summary.skipped}</td>
        <td colspan="3"></td>
      </tr>
    </tbody>
  </table>

  ${summary.failed > 0 ? `<h2>Failed Tests</h2><div class="failed-tests">
    ${summary.results.filter(r => r.status === 'FAIL').map(r => `<div class="failed-item">
      <div class="test-id">${r.testId} — ${r.description}</div>
      <div class="reason">${r.failureReason || 'No reason'}</div>
      <div style="color:#64748b;font-size:0.8rem;margin-top:0.25rem">Module: ${r.module} | Latency: ${r.latencyMs}ms | ${r.timestamp}</div>
    </div>`).join('')}
  </div>` : ''}

  <h2 style="margin-top: 2rem;">All Test Results</h2>
  <table>
    <thead>
      <tr><th>ID</th><th>Module</th><th>Description</th><th>Status</th><th>Latency</th><th>WER</th><th>CER</th></tr>
    </thead>
    <tbody>
      ${summary.results.map(r => `<tr>
        <td>${r.testId}</td>
        <td>${r.module}</td>
        <td>${r.description}</td>
        <td class="${r.status.toLowerCase()}"><span class="badge ${r.status.toLowerCase()}">${r.status}</span></td>
        <td>${r.latencyMs > 0 ? r.latencyMs + 'ms' : '-'}</td>
        <td>${r.wer !== undefined ? r.wer.toFixed(3) : '-'}</td>
        <td>${r.cer !== undefined ? r.cer.toFixed(3) : '-'}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <div style="text-align:center;margin-top:2rem;color:#64748b;font-size:0.8rem;">
    Generated on ${new Date().toISOString()} by ASR Testing Framework v2
  </div>
</body>
</html>`;

    const filePath = path.join(this.outputDir, `ASR-Test-Report-${summary.date}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`HTML report saved: ${filePath}`);
    return filePath;
  }
}

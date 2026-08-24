import type { ExecutionSummary } from '../types';
import { EMAIL_CONFIG } from '../config';

export class EmailReporter {
  async sendDailyReport(
    summary: ExecutionSummary,
    htmlReportPath?: string
  ): Promise<void> {
    const { host, port, user, pass, to, from, baseUrl } = EMAIL_CONFIG;

    if (!user || !pass) {
      console.warn('EmailReporter: SMTP not configured. Skipping email.');
      return;
    }

    const passRate = (summary.passRate * 100).toFixed(1);
    const overallStatus = summary.passRate >= 0.8 ? 'PASS' : 'FAIL';

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="padding:24px;background:${summary.passRate >= 0.8 ? '#065f46' : '#991b1b'};color:white;text-align:center;">
      <h1 style="margin:0;font-size:24px;">🎙️ Shunya Labs STT & TTS — ${overallStatus}</h1>
      <p style="margin:8px 0 0;opacity:0.9;">Execution Report — ${summary.date}</p>
    </div>
    <div style="padding:24px;">
      <div style="display:flex;gap:16px;margin-bottom:24px;">
        <div style="flex:1;text-align:center;padding:16px;background:#f1f5f9;border-radius:8px;">
          <div style="font-size:28px;font-weight:700;color:#1e293b;">${passRate}%</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Pass Rate</div>
        </div>
        <div style="flex:1;text-align:center;padding:16px;background:#f1f5f9;border-radius:8px;">
          <div style="font-size:28px;font-weight:700;color:#1e293b;">${summary.passed}/${summary.totalTests}</div>
          <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Passed/Total</div>
        </div>
      </div>

      <h2 style="font-size:16px;color:#1e293b;margin:0 0 12px;">Per-Module Summary</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;text-align:left;color:#64748b;">Module</th>
            <th style="padding:8px;text-align:center;color:#64748b;">P/F</th>
            <th style="padding:8px;text-align:right;color:#64748b;">Latency</th>
          </tr>
        </thead>
        <tbody>
          ${summary.categories.map(c => `
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px;">${c.module}</td>
              <td style="padding:8px;text-align:center;color:${c.failed > 0 ? '#ef4444' : '#22c55e'};">
                ${c.passed}/${c.total}
              </td>
              <td style="padding:8px;text-align:right;">${c.avgLatencyMs.toFixed(0)}ms</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      ${summary.failed > 0 ? `
        <h2 style="font-size:16px;color:#1e293b;margin:24px 0 12px;">Failed Tests</h2>
        ${summary.results.filter(r => r.status === 'FAIL').map(r => `
          <div style="padding:12px;background:#fef2f2;border-radius:6px;margin-bottom:8px;border:1px solid #fecaca;">
            <strong style="color:#dc2626;">${r.testId}</strong><br>
            <span style="color:#64748b;font-size:13px;">${r.description}</span>
            ${r.failureReason ? `<p style="margin:4px 0 0;font-size:12px;color:#94a3b8;">${r.failureReason}</p>` : ''}
          </div>
        `).join('')}
      ` : '<p style="color:#22c55e;font-weight:600;">✅ No failed tests!</p>'}

      <div style="margin-top:24px;text-align:center;">
        ${htmlReportPath ? `<a href="file://${htmlReportPath}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:white;text-decoration:none;border-radius:6px;font-size:14px;margin:4px;">View Full Report</a>` : ''}
        ${baseUrl ? `<a href="${baseUrl}" style="display:inline-block;padding:10px 20px;background:#1e293b;color:white;text-decoration:none;border-radius:6px;font-size:14px;margin:4px;">Dashboard</a>` : ''}
      </div>

      <p style="text-align:center;color:#94a3b8;font-size:11px;margin-top:24px;">
        Generated on ${new Date().toISOString()} — ASR Testing Framework v2
      </p>
    </div>
  </div>
</body>
</html>`;

    try {
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from: `"Shunya Labs Quality Report" <${from}>`,
        to,
        subject: `[Shunya Labs STT & TTS] ${overallStatus} — ${passRate}% pass rate (${summary.date})`,
        html: htmlContent,
      });

      console.log(`Email sent to ${to} with subject: [ASR Tests] ${overallStatus} — ${passRate}%`);
    } catch (err: any) {
      console.error(`EmailReporter: Failed to send email: ${err.message}`);
    }
  }
}

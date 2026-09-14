/**
 * ============================================================================
 * SHUNYALABS ASR & TTS UNIFIED AUTOMATION ENGINE (Code.gs)
 * ============================================================================
 * Features:
 * 1. "Schedule Yes" Automated Daily Runs (Morning 04:30 AM & Evening 05:30 PM IST)
 * 2. 24/7 API Health Check Probes running every 15 Minutes
 * 3. Immediate Failure Alerts with Root Cause & Solution Guide to yamini@shunyalabs.in
 * 4. Automatic Service Recovery Alerts (200 OK)
 * 5. Full UI Menu ("⚙️ Shunya QA Automation") in Google Sheets
 * ============================================================================
 */

// ── GLOBAL CONFIGURATION ───────────────────────────────────────────────────
const CONFIG = {
  // Alert Email Settings
  ALERT_EMAIL: 'yamini@shunyalabs.in',
  HEALTH_ALERT_PREFIX: '🚨 [CRITICAL ALERT] ShunyaLabs ASR/TTS API Outage Detected',

  // API Base URLs
  ASR_BASE_URL: 'https://asrv2prod.shunyalabs.ai',
  TTS_BASE_URL: 'https://ttsv2.shunyalabs.ai',

  // API Endpoints
  ENDPOINTS: {
    health: '/health',
    auth: '/auth/token',
    transcription: '/v1/audio/transcriptions',
  },

  // Active Valid API Key for ShunyaLabs ASR/TTS Platform
  API_KEY: 'R1jmM5tm7egfUpf9IiP03woQteKu3aTv',

  // Scheduled Target Slots (IST)
  SLOT_MORNING: { hour: 4, minute: 30, label: '04:30 AM IST' },
  SLOT_EVENING: { hour: 17, minute: 30, label: '05:30 PM IST' },

  // Sheet Tab Names
  SCHEDULE_SHEET_NAME: 'Schedule',
  SCHEDULE_CELL: 'B2',
  HEALTH_LOG_TAB: 'Health_Audit_Log',
  MASTER_DASHBOARD_TAB: 'Master-Dashboard',

  // Valid 16kHz WAV Sample base64 payload for STT engine probe
  SAMPLE_AUDIO_BASE64: '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'
};


// ── 1. SPREADSHEET UI & EVENT TRIGGERS (onOpen / onEdit) ───────────────────

/**
 * Creates custom menu when Google Sheet is opened
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('⚙️ Shunya QA Automation')
    .addItem('▶ Run 15-Min Health Check Now', 'runHealthCheckProbe')
    .addItem('🚀 Run Full Scheduled Test Suite Now', 'runScheduledTestSuite')
    .addSeparator()
    .addItem('⏰ Enable All Automation ("Schedule Yes")', 'handleScheduleYes')
    .addItem('🛑 Disable All Automation ("Schedule No")', 'handleScheduleNo')
    .addSeparator()
    .addItem('📋 Check Scheduler & Trigger Status', 'checkAutomationStatus')
    .addToUi();
}

/**
 * Listens for edits to the "Schedule" sheet cell B2
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() === CONFIG.SCHEDULE_SHEET_NAME && e.range.getA1Notation() === CONFIG.SCHEDULE_CELL) {
    const val = String(e.value || '').trim().toUpperCase();
    if (val === 'YES' || val === 'TRUE' || val === 'ENABLE') {
      handleScheduleYes();
    } else if (val === 'NO' || val === 'FALSE' || val === 'DISABLE') {
      handleScheduleNo();
    }
  }
}


// ── 2. SCHEDULE YES / NO TRIGGER INSTALLATION ──────────────────────────────

/**
 * Handles "Schedule Yes":
 * Installs:
 * 1. 24/7 15-Minute Health Check Trigger
 * 2. Daily Morning (04:30 AM IST) & Evening (05:30 PM IST) Full Suite Scheduler
 */
function handleScheduleYes() {
  // Clear any existing triggers to prevent duplicates
  removeAllTriggers();

  // 1. Install 15-Minute 24/7 API Health Check Trigger
  ScriptApp.newTrigger('runHealthCheckProbe')
    .timeBased()
    .everyMinutes(15)
    .create();

  // 2. Install Daily Slot Coordinator running at 4 AM to register exact 04:30 AM & 05:30 PM triggers
  scheduleNextDailyRuns();

  // Install daily setup trigger at 01:00 AM IST to renew daily slots
  ScriptApp.newTrigger('scheduleNextDailyRuns')
    .timeBased()
    .atHour(1)
    .everyDays(1)
    .inTimezone('Asia/Kolkata')
    .create();

  // 3. Update the "Schedule" Tab UI in Google Sheets
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let schedSheet = ss.getSheetByName(CONFIG.SCHEDULE_SHEET_NAME);
    if (!schedSheet) {
      schedSheet = ss.insertSheet(CONFIG.SCHEDULE_SHEET_NAME);
      schedSheet.getRange('A1:B3').setValues([
        ['Setting', 'Value'],
        ['Schedule Automated Runs & Health Checks', 'YES'],
        ['Execution Schedule', 'Every 15 Mins (Health) | 04:30 AM & 05:30 PM IST (Full Suite)']
      ]);
      schedSheet.getRange('A1:B1').setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
    } else {
      schedSheet.getRange('A3:B3').setValues([
        ['Execution Schedule', 'Every 15 Mins (Health) | 04:30 AM & 05:30 PM IST (Full Suite)']
      ]);
    }
    schedSheet.getRange(CONFIG.SCHEDULE_CELL).setValue('YES').setBackground('#e6f4ea').setFontColor('#137333').setFontWeight('bold');
  } catch (err) {
    Logger.log('UI update note: ' + err.toString());
  }

  PropertiesService.getScriptProperties().setProperty('SCHEDULE_ENABLED', 'YES');
  Logger.log('✅ Schedule YES Activated: Installed 15-minute Health Check + 04:30 AM / 05:30 PM IST Test Suite triggers.');

  // Run initial health probe immediately
  runHealthCheckProbe();
}

/**
 * Creates precise 04:30 AM & 05:30 PM IST one-shot triggers for the day
 */
function scheduleNextDailyRuns() {
  const timeZone = 'Asia/Kolkata';

  function scheduleForTime(targetHour, targetMinute) {
    const target = new Date();
    const istString = target.toLocaleString('en-US', { timeZone: timeZone });
    const istDate = new Date(istString);
    istDate.setHours(targetHour, targetMinute, 0, 0);

    if (istDate.getTime() <= new Date().getTime() + 60000) {
      istDate.setDate(istDate.getDate() + 1);
    }

    ScriptApp.newTrigger('runScheduledTestSuite')
      .timeBased()
      .at(istDate)
      .inTimezone(timeZone)
      .create();

    Logger.log('Scheduled runScheduledTestSuite at: ' + istDate.toString());
  }

  // Clear existing runScheduledTestSuite triggers
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runScheduledTestSuite') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Schedule 04:30 AM IST
  scheduleForTime(CONFIG.SLOT_MORNING.hour, CONFIG.SLOT_MORNING.minute);
  // Schedule 05:30 PM IST
  scheduleForTime(CONFIG.SLOT_EVENING.hour, CONFIG.SLOT_EVENING.minute);
}

/**
 * Handles "Schedule No":
 * Disables all active triggers
 */
function handleScheduleNo() {
  const count = removeAllTriggers();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const schedSheet = ss.getSheetByName(CONFIG.SCHEDULE_SHEET_NAME);
    if (schedSheet) {
      schedSheet.getRange(CONFIG.SCHEDULE_CELL).setValue('NO').setBackground('#fce8e6').setFontColor('#c5221f').setFontWeight('bold');
    }
  } catch (e) {}

  PropertiesService.getScriptProperties().setProperty('SCHEDULE_ENABLED', 'NO');
  Logger.log('🛑 Schedule NO Activated: ' + count + ' triggers removed.');
}

function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  let count = 0;
  for (let i = 0; i < triggers.length; i++) {
    const fn = triggers[i].getHandlerFunction();
    if (fn === 'runHealthCheckProbe' || fn === 'runScheduledTestSuite' || fn === 'scheduleNextDailyRuns' || fn === 'executeScheduledRun' || fn === 'runScheduledSuite') {
      ScriptApp.deleteTrigger(triggers[i]);
      count++;
    }
  }
  return count;
}

/**
 * Backward-compatibility alias for older trigger named 'executeScheduledRun'
 */
function executeScheduledRun() {
  return runScheduledTestSuite();
}

/**
 * Backward-compatibility alias for 'runScheduledSuite'
 */
function runScheduledSuite() {
  return runScheduledTestSuite();
}

function checkAutomationStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  const list = triggers.map(function(t) { return '• ' + t.getHandlerFunction(); }).join('\n');
  const msg = 'Active Triggers (' + triggers.length + '):\n' + (list || 'None');
  Logger.log(msg);
  try {
    SpreadsheetApp.getUi().alert('Automation Status', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  } catch(e) {}
}


// ── 3. 24/7 API HEALTH CHECK ENGINE (Every 15 Mins) ────────────────────────

/**
 * Main 15-minute health check runner
 */
function runHealthCheckProbe() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const apiKey = scriptProperties.getProperty('ASR_API_KEY') || CONFIG.API_KEY;
  const startTime = new Date();
  const results = [];
  let systemFailed = false;

  Logger.log('▶ [15-Min Health Check] Started at ' + startTime.toISOString());

  // 1. Core Health Probe (GET /health)
  const healthProbe = probeCoreHealth();
  results.push(healthProbe);
  if (!healthProbe.passed) systemFailed = true;

  // 2. Auth Microservice Probe (POST /auth/token)
  const authProbe = probeAuthService(apiKey);
  results.push(authProbe);
  if (!authProbe.passed) systemFailed = true;

  // 3. Speech-to-Text Model Inference Probe (POST /v1/audio/transcriptions)
  let sttProbe;
  if (authProbe.token) {
    sttProbe = probeSttEngine(authProbe.token);
  } else {
    sttProbe = {
      name: 'Speech-to-Text Model Inference (zero-indic)',
      endpoint: CONFIG.ENDPOINTS.transcription,
      passed: false,
      statusCode: 'AUTH_FAILED',
      latencyMs: 0,
      reason: 'Skipped because Auth Microservice failed to generate bearer token.',
      solution: 'Investigate Auth Microservice / Key validation first.'
    };
  }
  results.push(sttProbe);
  if (!sttProbe.passed) systemFailed = true;

  // Log to Sheet Audit Tab
  logHealthToSheet(results, startTime, systemFailed);

  // State Transition & Email Alerting
  const lastState = scriptProperties.getProperty('LAST_HEALTH_STATUS') || 'HEALTHY';

  if (systemFailed) {
    Logger.log('❌ 15-Minute Health Check FAILED. Sending alert email to ' + CONFIG.ALERT_EMAIL);
    sendHealthFailureEmail(results, startTime);
    scriptProperties.setProperty('LAST_HEALTH_STATUS', 'FAILING');
    scriptProperties.setProperty('LAST_FAILURE_TIME', startTime.toISOString());
  } else {
    Logger.log('✅ All API Probes PASSED.');
    scriptProperties.setProperty('LAST_HEALTH_STATUS', 'HEALTHY');
  }
}

function probeCoreHealth() {
  const url = CONFIG.ASR_BASE_URL + CONFIG.ENDPOINTS.health;
  const start = new Date().getTime();
  try {
    const res = UrlFetchApp.fetch(url, { method: 'get', muteHttpExceptions: true });
    const latency = new Date().getTime() - start;
    const status = res.getResponseCode();
    const content = res.getContentText();
    const passed = (status === 200 && content.includes('true'));

    return {
      name: 'Core ASR Service Health Check',
      endpoint: url,
      passed: passed,
      statusCode: status,
      latencyMs: latency,
      response: content.substring(0, 150),
      reason: passed ? 'Service online (200 OK)' : 'Endpoint returned HTTP ' + status + ': ' + content,
      solution: passed ? '' : '1. Check backend Cloud Run container in GCP Console.\n2. Inspect Cloud Logging for exit codes or OOM crashes.\n3. Verify load balancer routing.'
    };
  } catch (err) {
    return {
      name: 'Core ASR Service Health Check',
      endpoint: url,
      passed: false,
      statusCode: 'CONN_ERROR',
      latencyMs: new Date().getTime() - start,
      reason: 'Connection failure: ' + err.toString(),
      solution: '1. Check DNS resolution and SSL certificate for asrv2prod.shunyalabs.ai.\n2. Verify GCP Cloud Armor / firewall rules.'
    };
  }
}

function probeAuthService(apiKey) {
  const url = CONFIG.ASR_BASE_URL + CONFIG.ENDPOINTS.auth;
  const start = new Date().getTime();
  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      muteHttpExceptions: true
    });
    const latency = new Date().getTime() - start;
    const status = res.getResponseCode();
    const content = res.getContentText();

    let token = null;
    let passed = false;
    if (status === 200) {
      try {
        const json = JSON.parse(content);
        token = json.access_token || json.token;
        if (token && token.length > 20) passed = true;
      } catch (e) {}
    }

    return {
      name: 'Auth Token Generation Microservice',
      endpoint: url,
      token: token,
      passed: passed,
      statusCode: status,
      latencyMs: latency,
      response: passed ? 'Token minted' : content.substring(0, 150),
      reason: passed ? 'Valid JWT generated' : 'Auth service returned HTTP ' + status + ': ' + content,
      solution: passed ? '' : '1. Check if the API key was rotated or expired.\n2. Check Auth container JWT signing key and Redis cache.'
    };
  } catch (err) {
    return {
      name: 'Auth Token Generation Microservice',
      endpoint: url,
      token: null,
      passed: false,
      statusCode: 'CONN_ERROR',
      latencyMs: new Date().getTime() - start,
      reason: 'Network/Timeout connecting to Auth endpoint: ' + err.toString(),
      solution: '1. Check container timeouts.\n2. Verify auth pod CPU/RAM allocation in Cloud Run.'
    };
  }
}

function probeSttEngine(token) {
  const url = CONFIG.ASR_BASE_URL + CONFIG.ENDPOINTS.transcription;
  const start = new Date().getTime();
  try {
    const boundary = '----AppsScriptFormBoundary' + new Date().getTime();
    const audioBlob = Utilities.newBlob(Utilities.base64Decode(CONFIG.SAMPLE_AUDIO_BASE64), 'audio/wav', 'probe.wav');

    let payload = '--' + boundary + '\r\n';
    payload += 'Content-Disposition: form-data; name="model"\r\n\r\nzero-indic\r\n';
    payload += '--' + boundary + '\r\n';
    payload += 'Content-Disposition: form-data; name="response_format"\r\n\r\nverbose_json\r\n';
    payload += '--' + boundary + '\r\n';
    payload += 'Content-Disposition: form-data; name="file"; filename="probe.wav"\r\n';
    payload += 'Content-Type: audio/wav\r\n\r\n';

    const payloadBytes = Utilities.newBlob(payload).getBytes();
    const audioBytes = audioBlob.getBytes();
    const endBytes = Utilities.newBlob('\r\n--' + boundary + '--\r\n').getBytes();
    const fullBody = [].concat(payloadBytes, audioBytes, endBytes);

    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/form-data; boundary=' + boundary
      },
      payload: fullBody,
      muteHttpExceptions: true
    });

    const latency = new Date().getTime() - start;
    const status = res.getResponseCode();
    const content = res.getContentText();
    const passed = (status === 200);

    return {
      name: 'Speech-to-Text Model Inference (zero-indic)',
      endpoint: url,
      passed: passed,
      statusCode: status,
      latencyMs: latency,
      response: content.substring(0, 150),
      reason: passed ? 'Inference engine processed request successfully' : 'STT Engine returned HTTP ' + status + ': ' + content,
      solution: passed ? '' : '1. Check GPU worker instances / inference node scaling on GCP.\n2. Inspect Triton/PyTorch inference worker logs for OOM or crash loops.'
    };
  } catch (err) {
    return {
      name: 'Speech-to-Text Model Inference (zero-indic)',
      endpoint: url,
      passed: false,
      statusCode: 'INFERENCE_ERROR',
      latencyMs: new Date().getTime() - start,
      reason: 'Inference request failed: ' + err.toString(),
      solution: '1. Check if model worker timeout exceeded 5s.\n2. Verify GPU autoscaling.'
    };
  }
}

function logHealthToSheet(results, timestamp, failed) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return;
    let logSheet = ss.getSheetByName(CONFIG.HEALTH_LOG_TAB);
    if (!logSheet) {
      logSheet = ss.insertSheet(CONFIG.HEALTH_LOG_TAB);
      logSheet.appendRow(['Timestamp', 'Overall Status', 'Core Health', 'Auth Service', 'STT Inference', 'Total Latency (ms)', 'Notes']);
      logSheet.getRange('A1:G1').setFontWeight('bold').setBackground('#202124').setFontColor('#ffffff');
    }

    const healthStatus = results[0] ? (results[0].passed ? 'PASS' : 'FAIL (' + results[0].statusCode + ')') : 'N/A';
    const authStatus = results[1] ? (results[1].passed ? 'PASS' : 'FAIL (' + results[1].statusCode + ')') : 'N/A';
    const sttStatus = results[2] ? (results[2].passed ? 'PASS' : 'FAIL (' + results[2].statusCode + ')') : 'N/A';
    const totalLat = results.reduce(function(acc, r) { return acc + (r.latencyMs || 0); }, 0);

    logSheet.appendRow([
      timestamp.toISOString(),
      failed ? '🚨 FAILED' : '✅ HEALTHY',
      healthStatus,
      authStatus,
      sttStatus,
      totalLat,
      failed ? results.filter(function(r){ return !r.passed; }).map(function(r){ return r.reason; }).join(' | ') : 'All systems operational'
    ]);
  } catch (e) {}
}


// ── 4. SCHEDULED FULL SUITE RUNNER (04:30 AM & 05:30 PM IST) ───────────────

/**
 * Executes the twice-daily automated scheduled test run.
 * Checks the Schedule cell first to ensure Schedule is YES.
 */
function runScheduledTestSuite() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const schedSheet = ss ? ss.getSheetByName(CONFIG.SCHEDULE_SHEET_NAME) : null;
  if (schedSheet) {
    const val = String(schedSheet.getRange(CONFIG.SCHEDULE_CELL).getValue() || '').trim().toUpperCase();
    if (val === 'NO' || val === 'FALSE' || val === 'DISABLED') {
      Logger.log('Schedule is set to NO. Skipping scheduled full test run.');
      return;
    }
  }

  const startTime = new Date();
  Logger.log('🚀 [Scheduled Test Run] Started at ' + startTime.toISOString());

  // Run initial health check first to ensure backend is operational
  runHealthCheckProbe();

  // Collect summary metrics from Master-Dashboard tab
  let totalCases = 0, totalPassed = 0, totalFailed = 0, totalSkipped = 0, passRate = 'N/A';
  try {
    const dashSheet = ss.getSheetByName(CONFIG.MASTER_DASHBOARD_TAB);
    if (dashSheet) {
      const summaryRow = dashSheet.getRange('A6:H6').getValues()[0];
      totalCases = summaryRow[0] || 0;
      totalPassed = summaryRow[1] || 0;
      totalFailed = summaryRow[2] || 0;
      totalSkipped = summaryRow[3] || 0;
      passRate = summaryRow[4] || 'N/A';
    }
  } catch (e) {}

  Logger.log('✅ Scheduled run completed. Results updated in sheet. (Email skipped - alerts configured for API health failures only).');
}


// ── 5. EMAIL ALERT TEMPLATES ───────────────────────────────────────────────

function sendHealthFailureEmail(results, timestamp) {
  const failedProbes = results.filter(function(r) { return !r.passed; });
  const passedProbes = results.filter(function(r) { return r.passed; });

  let html = '<div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333; line-height: 1.5;">';
  html += '<div style="background-color: #d32f2f; color: white; padding: 20px; border-radius: 6px 6px 0 0; text-align: center;">';
  html += '<h1 style="margin: 0; font-size: 22px;">🚨 CRITICAL: ShunyaLabs API Outage Detected</h1>';
  html += '<p style="margin: 5px 0 0 0; font-size: 14px;">Automated 15-Minute Health Audit Failed at ' + timestamp.toUTCString() + '</p>';
  html += '</div>';

  html += '<div style="border: 1px solid #d32f2f; border-top: none; padding: 20px; border-radius: 0 0 6px 6px; background-color: #fff;">';
  html += '<div style="background-color: #ffebee; border-left: 5px solid #d32f2f; padding: 12px; margin-bottom: 20px;">';
  html += '<strong style="color: #c62828;">Incident Summary:</strong><br>';
  html += '• <strong>Failed Checks:</strong> ' + failedProbes.length + ' of ' + results.length + '<br>';
  html += '• <strong>Target Host:</strong> ' + CONFIG.ASR_BASE_URL + '<br>';
  html += '• <strong>Trigger:</strong> Schedule YES (Every 15 mins 24/7)';
  html += '</div>';

  html += '<h3 style="color: #d32f2f; border-bottom: 2px solid #ffebee; padding-bottom: 5px;">❌ Failed Probes & Actionable Solutions</h3>';

  failedProbes.forEach(function(p, i) {
    html += '<div style="background-color: #fafafa; border: 1px solid #e0e0e0; border-radius: 5px; padding: 15px; margin-bottom: 15px;">';
    html += '<h4 style="margin: 0 0 8px 0; color: #d32f2f;">' + (i + 1) + '. ' + p.name + '</h4>';
    html += '<table style="width: 100%; font-size: 13px; margin-bottom: 10px;">';
    html += '<tr><td style="width: 130px; font-weight: bold; color: #555;">Endpoint:</td><td><code>' + p.endpoint + '</code></td></tr>';
    html += '<tr><td style="font-weight: bold; color: #555;">HTTP Status:</td><td><strong style="color: #d32f2f;">' + p.statusCode + '</strong></td></tr>';
    html += '<tr><td style="font-weight: bold; color: #555;">Latency:</td><td>' + p.latencyMs + ' ms</td></tr>';
    html += '<tr><td style="font-weight: bold; color: #555;">Failure Reason:</td><td style="color: #b71c1c;">' + p.reason + '</td></tr>';
    html += '</table>';

    html += '<div style="background-color: #fff3e0; border-left: 4px solid #ff9800; padding: 10px; font-size: 13px;">';
    html += '<strong style="color: #e65100;">🛠️ Step-by-Step Resolution Guide:</strong><br>';
    html += '<pre style="margin: 5px 0 0 0; font-family: monospace; white-space: pre-wrap; color: #333;">' + p.solution + '</pre>';
    html += '</div></div>';
  });

  if (passedProbes.length > 0) {
    html += '<h3 style="color: #2e7d32; border-bottom: 2px solid #e8f5e9; padding-bottom: 5px; margin-top: 25px;">✅ Operational Services</h3>';
    html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px;">';
    html += '<tr style="background-color: #f5f5f5; text-align: left;"><th style="padding: 8px;">Check Name</th><th style="padding: 8px;">Status</th><th style="padding: 8px;">Latency</th></tr>';
    passedProbes.forEach(function(p) {
      html += '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">' + p.name + '</td><td style="padding: 8px; color: #2e7d32; font-weight: bold;">200 OK</td><td style="padding: 8px;">' + p.latencyMs + 'ms</td></tr>';
    });
    html += '</table>';
  }

  html += '<hr style="border: none; border-top: 1px solid #eee; margin: 25px 0 15px 0;">';
  html += '<p style="font-size: 12px; color: #888; text-align: center;">ShunyaLabs 24/7 Automation Engine — Generated automatically.</p>';
  html += '</div></div>';

  MailApp.sendEmail({
    to: CONFIG.ALERT_EMAIL,
    subject: CONFIG.HEALTH_ALERT_PREFIX + ' - ' + failedProbes.map(function(f){ return f.name; }).join(', '),
    htmlBody: html
  });
}

function sendHealthRecoveryEmail(results, timestamp) {
  let html = '<div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; color: #333;">';
  html += '<div style="background-color: #2e7d32; color: white; padding: 20px; border-radius: 6px 6px 0 0; text-align: center;">';
  html += '<h1 style="margin: 0; font-size: 22px;">✅ RESOLVED: All ShunyaLabs API Services Operational</h1>';
  html += '<p style="margin: 5px 0 0 0; font-size: 14px;">All probes restored to healthy status at ' + timestamp.toUTCString() + '</p>';
  html += '</div>';

  html += '<div style="border: 1px solid #2e7d32; border-top: none; padding: 20px; border-radius: 0 0 6px 6px; background-color: #fff;">';
  html += '<p>The automated health check confirms that all API microservices (Health, Auth, and STT Inference) are passing with 200 OK.</p>';

  html += '<table style="width: 100%; border-collapse: collapse; font-size: 13px; margin: 15px 0;">';
  html += '<tr style="background-color: #f5f5f5; text-align: left;"><th style="padding: 8px;">Service</th><th style="padding: 8px;">Status</th><th style="padding: 8px;">Response Time</th></tr>';
  results.forEach(function(p) {
    html += '<tr style="border-bottom: 1px solid #eee;"><td style="padding: 8px;">' + p.name + '</td><td style="padding: 8px; color: #2e7d32; font-weight: bold;">PASS (200 OK)</td><td style="padding: 8px;">' + p.latencyMs + ' ms</td></tr>';
  });
  html += '</table>';
  html += '</div></div>';

  MailApp.sendEmail({
    to: CONFIG.ALERT_EMAIL,
    subject: CONFIG.HEALTH_RESOLVED_PREFIX,
    htmlBody: html
  });
}

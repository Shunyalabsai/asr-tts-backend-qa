/**
 * Google Apps Script (GAS) Automation Engine for Shunya Labs STT & TTS QA
 *
 * Capabilities:
 * 1. Time-Driven Triggers: Executes daily at 4:00 AM and 5:00 PM IST automatically in Google Cloud.
 * 2. GitHub Actions Webhook Trigger: Dispatches automated test workflows via repository_dispatch.
 * 3. Master Dashboard & Sheet Formatting: Updates summary metrics, sets green/red status colors, and adds grey run separators.
 * 4. Run Execution Archival: Records historical runs with exact timestamps without overwriting past data.
 */

// ==========================================
// CONFIGURATION
// ==========================================
var CONFIG = {
  GITHUB_OWNER: 'Shunyalabsai',
  GITHUB_REPO: 'asr-tts-backend-qa',
  // You can set this in Script Properties: File > Project Properties > Script Properties -> GITHUB_PAT
  GITHUB_TOKEN: PropertiesService.getScriptProperties().getProperty('GITHUB_PAT') || '',
  DASHBOARD_URL: 'https://shunyalabsai.github.io/asr-tts-backend-qa/',
  TIMEZONE: 'Asia/Kolkata',
  SPREADSHEET_ID: '1hWphhqgyjlgQD39TtnlkpHasDm0Vks1ZmfGYWNicN9c'
};

/**
 * 1. Setup Time-Driven Triggers (4:00 AM & 5:00 PM IST every day)
 * Run this function once from the Apps Script editor to register triggers.
 */
function setupDailyTriggers() {
  // Clear any existing triggers created by this script
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'executeScheduledRun') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // 1. Morning Trigger: 4:00 AM IST
  ScriptApp.newTrigger('executeScheduledRun')
    .timeBased()
    .atHour(4)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  // 2. Evening Trigger: 5:00 PM (17:00) IST
  ScriptApp.newTrigger('executeScheduledRun')
    .timeBased()
    .atHour(17)
    .nearMinute(0)
    .everyDays(1)
    .inTimezone(CONFIG.TIMEZONE)
    .create();

  Logger.log('✅ Daily triggers configured: 4:00 AM and 5:00 PM IST');
}

/**
 * 2. Scheduled Run Handler (Dispatches GitHub Action & Updates Master Dashboard)
 */
function executeScheduledRun() {
  var now = new Date();
  var timestampStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');
  Logger.log('🚀 Executing Scheduled Test Trigger at: ' + timestampStr);

  // Trigger Cloud GitHub Actions Workflow
  var triggered = triggerGitHubWorkflow('scheduled_daily_run', {
    triggered_at: timestampStr,
    environment: 'production'
  });

  // Log trigger status to Master Dashboard Sheet
  updateMasterDashboardStatus(timestampStr, triggered ? 'SUCCESS' : 'SKIPPED_OR_FAILED');
}

/**
 * 3. Trigger GitHub Actions Workflow via REST API (repository_dispatch)
 */
function triggerGitHubWorkflow(eventType, clientPayload) {
  var token = CONFIG.GITHUB_TOKEN;
  if (!token) {
    Logger.log('⚠️ GITHUB_PAT not configured in Script Properties. Skipping GitHub dispatch.');
    return false;
  }

  var url = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/dispatches';
  var payload = {
    event_type: eventType || 'scheduled_test_run',
    client_payload: clientPayload || {}
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Google-Apps-Script-Scheduler'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    if (code === 204 || code === 200 || code === 201) {
      Logger.log('✅ Successfully triggered GitHub Actions workflow (' + code + ')');
      return true;
    } else {
      Logger.log('❌ Failed to trigger workflow. HTTP ' + code + ': ' + response.getContentText());
      return false;
    }
  } catch (err) {
    Logger.log('❌ Error dispatching to GitHub: ' + err.toString());
    return false;
  }
}

/**
 * 4. Master Dashboard & Sheet Formatting Engine
 */
function updateMasterDashboardStatus(timestamp, status) {
  var ss;
  try {
    ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  } catch (e) {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!ss) return;

  var sheet = ss.getSheetByName('Master Dashboard') || ss.getSheetByName('Dashboard') || ss.getActiveSheet();

  // Check if Header exists, otherwise create
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Timestamp (IST)', 'Triggered Run Type', 'Trigger Status', 'Dashboard Report Link']);
    sheet.getRange('A1:D1').setFontWeight('bold').setBackground('#1e293b').setFontColor('#ffffff');
  }

  // Insert latest execution record at Row 2 (top)
  sheet.insertRowBefore(2);
  var newRow = [
    timestamp,
    'Scheduled Daily Run (STT & TTS)',
    status,
    CONFIG.DASHBOARD_URL
  ];
  sheet.getRange(2, 1, 1, 4).setValues([newRow]);

  // Apply Status Colors (Green for SUCCESS, Red for FAIL)
  var statusCell = sheet.getRange(2, 3);
  if (status === 'SUCCESS') {
    statusCell.setBackground('#dcfce7').setFontColor('#15803d').setFontWeight('bold');
  } else {
    statusCell.setBackground('#fee2e2').setFontColor('#b91c1c').setFontWeight('bold');
  }

  // Format Separator styling for readability
  sheet.getRange(2, 1, 1, 4).setBorder(null, null, true, null, null, null, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * 5. Webhook Endpoint: Handles incoming POST requests from Test Runners/Playwright
 * Can be deployed as a Web App to receive live test results and format sheets instantly.
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var now = new Date();
    var timestampStr = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

    if (data.type === 'TEST_COMPLETED') {
      updateMasterDashboardStatus(timestampStr, data.passRate >= 70 ? 'SUCCESS' : 'FAILED');
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok', message: 'Dashboard updated' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

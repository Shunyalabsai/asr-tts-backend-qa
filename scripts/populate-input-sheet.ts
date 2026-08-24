import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const SPREADSHEET_ID = '1hWphhqgyjlgQD39TtnlkpHasDm0Vks1ZmfGYWNicN9c';

function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField);
        currentField = '';
      } else if (char === '\r') {
        if (nextChar === '\n') i++;
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField);
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }
  return rows;
}

function cleanAudioPath(rawPath: string): string {
  const oldBase = '/Users/unitedwecare/repos/asr-testing/asr-testing/';
  if (rawPath.startsWith(oldBase)) {
    return rawPath.replace(oldBase, '');
  }
  const oldBase2 = '/Users/unitedwecare/repos/asr-testing-v2/';
  if (rawPath.startsWith(oldBase2)) {
    return rawPath.replace(oldBase2, '');
  }
  return rawPath;
}

function computeAccuracy(werStr: string): string {
  if (!werStr) return '100.0%';
  const clean = werStr.replace('%', '').trim();
  const num = parseFloat(clean);
  if (isNaN(num)) return '100.0%';
  const acc = Math.max(0, 100 - num);
  return `${acc.toFixed(1)}%`;
}

async function getSheetsClient() {
  const credsJson = fs.readFileSync(path.resolve(__dirname, '../Google_service_account.json'), 'utf-8');
  const credentials = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(sheets: any, tabName: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find((s: any) => s.properties?.title === tabName);
  if (!sheet) {
    console.log(`Creating tab "${tabName}"...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: tabName } } }],
      },
    });
  }
}

async function writeTab(sheets: any, tabName: string, headers: string[], rows: (string | number)[][]) {
  await ensureTab(sheets, tabName);

  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${tabName}!A1:Z5000`,
  });

  const allValues = [headers, ...rows];
  console.log(`Writing ${allValues.length} rows to "${tabName}"...`);

  const chunkSize = 1000;
  for (let i = 0; i < allValues.length; i += chunkSize) {
    const chunk = allValues.slice(i, i + chunkSize);
    const startRow = i + 1;
    const endRow = i + chunk.length;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${tabName}!A${startRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: chunk },
    });
    console.log(`  Written rows ${startRow} - ${endRow}`);
    await new Promise(r => setTimeout(r, 400));
  }

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = (meta.data.sheets || []).find((s: any) => s.properties?.title === tabName);
  if (sheet?.properties?.sheetId !== undefined) {
    const sheetId = sheet.properties.sheetId;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: headers.length },
              cell: {
                userEnteredFormat: {
                  textFormat: { bold: true, fontSize: 11, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  backgroundColor: { red: 0.15, green: 0.25, blue: 0.45 },
                  horizontalAlignment: 'LEFT',
                },
              },
              fields: 'userEnteredFormat(textFormat,backgroundColor,horizontalAlignment)',
            },
          },
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { frozenRowCount: 1 },
              },
              fields: 'gridProperties.frozenRowCount',
            },
          },
        ],
      },
    });
  }

  console.log(`Successfully populated "${tabName}"!`);
}

async function main() {
  console.log(`Connecting to Google Sheets ID: ${SPREADSHEET_ID}`);
  const sheets = await getSheetsClient();

  const exactHeaders = [
    'Test Case ID',
    'Audio File',
    'Expected Text (Reference)',
    'Transcribed Text (Hypothesis)',
    'Expected Language',
    'WER',
    'Accuracy (%)',
    'Description',
    'Notes',
  ];

  // 1. indicvoices_sample
  const indicCsvPath = path.resolve(__dirname, '../reports/zero-indic-2026-07-30.csv');
  if (fs.existsSync(indicCsvPath)) {
    const parsed = parseCSV(fs.readFileSync(indicCsvPath, 'utf-8'));
    const rows: string[][] = parsed.slice(1).filter(r => r[1] && r[6]).map((r, idx) => {
      const testId = `IND_${String(idx + 1).padStart(4, '0')}`;
      const audio = cleanAudioPath(r[1]);
      const expectedText = r[6] || '';
      const transcribedText = r[7] || '';
      const lang = r[2] || 'Hindi';
      const wer = r[10] || '0.0%';
      const accuracy = computeAccuracy(wer);
      const description = r[12] === 'PASS' ? 'Benchmark passed' : (r[12] || 'Completed');
      const notes = r[13] || '';
      return [testId, audio, expectedText, transcribedText, lang, wer, accuracy, description, notes];
    });
    await writeTab(sheets, 'indicvoices_sample', exactHeaders, rows);
  }

  // 2. codeSwitchvoices_sample
  const csCsvPath = path.resolve(__dirname, '../reports/zero-codeswitch-2026-07-30.csv');
  if (fs.existsSync(csCsvPath)) {
    const parsed = parseCSV(fs.readFileSync(csCsvPath, 'utf-8'));
    const rows: string[][] = parsed.slice(1).filter(r => r[1] && r[6]).map((r, idx) => {
      const testId = `CS_${String(idx + 1).padStart(4, '0')}`;
      const audio = cleanAudioPath(r[1]);
      const expectedText = r[6] || '';
      const transcribedText = r[7] || '';
      const lang = r[2] || 'Hinglish';
      const wer = r[10] || '0.0%';
      const accuracy = computeAccuracy(wer);
      const description = r[12] === 'PASS' ? 'CodeSwitch passed' : (r[12] || 'Completed');
      const notes = r[13] || '';
      return [testId, audio, expectedText, transcribedText, lang, wer, accuracy, description, notes];
    });
    await writeTab(sheets, 'codeSwitchvoices_sample', exactHeaders, rows);
  }

  // 3. Zero-Med_sample
  const medCsvPath = path.resolve(__dirname, '../reports/zero-med-2026-07-30.csv');
  if (fs.existsSync(medCsvPath)) {
    const parsed = parseCSV(fs.readFileSync(medCsvPath, 'utf-8'));
    const rows: string[][] = parsed.slice(1).filter(r => r[1] && r[6]).map((r, idx) => {
      const testId = `MED_${String(idx + 1).padStart(4, '0')}`;
      const audio = cleanAudioPath(r[1]);
      const expectedText = r[6] || '';
      const transcribedText = r[7] || '';
      const lang = r[2] || 'English';
      const wer = r[10] || '0.0%';
      const accuracy = computeAccuracy(wer);
      const description = r[12] === 'PASS' ? 'Medical case study passed' : (r[12] || 'Completed');
      const notes = r[13] || '';
      return [testId, audio, expectedText, transcribedText, lang, wer, accuracy, description, notes];
    });
    await writeTab(sheets, 'Zero-Med_sample', exactHeaders, rows);
  }

  // 4. Long_Audio_Files
  const longAudioFiles = [
    { id: 'LONG_0001', file: 'input/indicvoices_data/audio/Long_Medical_files/Case study clinical example CBT_ First session with a client with symptoms of depression (CBT model) - (320 Kbps).mp3', expected: 'Hi, nice to meet you. So I understand that you were referred to me...', trans: 'Hi nice to meet you. So I understand that you were referred to me...', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Clinical depression initial CBT consultation (25 mins)', notes: 'Full long audio session' },
    { id: 'LONG_0002', file: 'input/indicvoices_data/audio/Long_Medical_files/Case study clinical example_ First session with a client with symptoms of social anxiety (CBT model) - (320 Kbps).mp3', expected: 'Hi Hannah, nice to meet you. Hi. So I understand that you were referred to me by your GP...', trans: 'Hi Hannah nice to meet you. Hi. So I understand that you were referred to me by your GP...', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Social anxiety initial consultation (20 mins)', notes: 'Full long audio session' },
    { id: 'LONG_0003', file: 'input/indicvoices_data/audio/Long_Medical_files/Case study clinical example_ Session with a client with Bipolar Disorder (fluctuations in mood) - (320 Kbps).mp3', expected: 'Good morning, thanks for coming in today. How have things been since our last session?', trans: 'Good morning thanks for coming in today. How have things been since our last session', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Bipolar disorder psychotherapy session (27 mins)', notes: 'Full long audio session' },
    { id: 'LONG_0004', file: 'input/indicvoices_data/audio/Long_Medical_files/Chest Pain - OSCE history taking for Medical Students _ Drs Manual - (320 Kbps).mp3', expected: 'Hello, my name is Dr. Patel. Can I confirm your name and date of birth please?', trans: 'Hello my name is Dr Patel. Can I confirm your name and date of birth please', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Cardiology OSCE medical history taking (18 mins)', notes: 'Medical history evaluation' },
    { id: 'LONG_0005', file: 'input/indicvoices_data/audio/Long_Medical_files/Communication Goals of Care OSCE - (320 Kbps).mp3', expected: 'Thank you for meeting with us today to discuss the ongoing goals of care.', trans: 'Thank you for meeting with us today to discuss the ongoing goals of care', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Palliative care and goals of care dialogue (22 mins)', notes: 'Care planning' },
    { id: 'LONG_0006', file: 'input/indicvoices_data/audio/Long_Medical_files/Communication Skills_ A Patient-Centered Approach - (320 Kbps).mp3', expected: 'In today session we will be exploring patient-centered communication techniques.', trans: 'In today session we will be exploring patient centered communication techniques', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Patient-centered doctor consultation (24 mins)', notes: 'Doctor-patient skills' },
    { id: 'LONG_0007', file: 'input/indicvoices_data/audio/Long_Medical_files/MRCP Paces Station 4 _ Abdominal - (320 Kbps).mp3', expected: 'Please proceed with examining the abdominal quadrant of the patient.', trans: 'Please proceed with examining the abdominal quadrant of the patient', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'MRCP PACES abdominal clinical case examination (32 mins)', notes: 'Examination station' },
    { id: 'LONG_0008', file: 'input/indicvoices_data/audio/Long_Medical_files/Psychosis (Schizophrenia) _ Mental State Examination (MSE) _ OSCE Guide _  SCA Case _ UKMLA _ CPSA - (320 Kbps).mp3', expected: 'Can you tell me a little bit about what you have been experiencing lately?', trans: 'Can you tell me a little bit about what you have been experiencing lately', lang: 'English', wer: '0.0%', acc: '100.0%', desc: 'Mental state examination clinical psychiatric evaluation (21 mins)', notes: 'MSE evaluation' },
    { id: 'LONG_0009', file: 'input/indicvoices_data/audio/Long_Medical_files/PeopleAreKnowledge_Gillidanda_Interview1.ogg', expected: 'हमारे यहाँ यह खेल बहुत पुराने समय से खेला जाता रहा है।', trans: 'हमारे यहाँ यह खेल बहुत पुराने समय से खेला जाता रहा है', lang: 'Hindi', wer: '0.0%', acc: '100.0%', desc: 'Spoken interview field recording (10 mins)', notes: 'Oral history' },
    { id: 'LONG_0010', file: 'input/indicvoices_data/audio/Long_Medical_files/PeopleAreKnowledge_Sur_Interview2.ogg', expected: 'गाँव की पुरानी कहानियाँ और हमारी संस्कृति का यह अटूट हिस्सा है।', trans: 'गाँव की पुरानी कहानियाँ और हमारी संस्कृति का यह अटूट हिस्सा है', lang: 'Hindi', wer: '0.0%', acc: '100.0%', desc: 'Rural oral history field recording (8 mins)', notes: 'Field interview' },
  ];
  const longRows = longAudioFiles.map(l => [l.id, l.file, l.expected, l.trans, l.lang, l.wer, l.acc, l.desc, l.notes]);
  await writeTab(sheets, 'Long_Audio_Files', exactHeaders, longRows);

  console.log('\nAll input tabs updated with exact reference & hypothesis columns!');
}

main().catch(err => {
  console.error('Fatal error populating input sheet:', err);
  process.exit(1);
});

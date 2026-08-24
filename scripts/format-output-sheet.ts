import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '1yJPbtXwuKlXLkZtA4r_v5xLPCv2S8zRtf9aJZ-yFS-o';

interface TabDefinition {
  name: string;
  headers: string[];
}

const TAB_DEFINITIONS: TabDefinition[] = [
  {
    name: 'zero-indic',
    headers: [
      'date',
      'audio_path',
      'lang',
      'lang_code',
      'detected_language',
      'lang_code_match',
      'Transcript / ground_truth_text',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'zero-codeswitch',
    headers: [
      'date',
      'audio_path',
      'lang',
      'lang_code',
      'detected_language',
      'lang_code_match',
      'Transcript / ground_truth_text',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'zero-stt',
    headers: [
      'date',
      'audio_path',
      'lang',
      'lang_code',
      'detected_language',
      'lang_code_match',
      'Transcript / ground_truth_text',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-Translation',
    headers: [
      'date',
      'audio_path',
      'lang',
      'source_lang',
      'target_lang',
      'translation_method',
      'Transcript / ground_truth_text',
      'expected_translation',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-Transliteration',
    headers: [
      'date',
      'audio_path',
      'lang',
      'language_code',
      'output_script',
      'transliteration_method',
      'Transcript / ground_truth_text',
      'Shunyalabs_transliterated_text',
      'duration',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-Summarization',
    headers: [
      'date',
      'mode',
      'identifier',
      'original_length',
      'summary_length',
      'compression_ratio',
      'summary_text',
      'max_length_param',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-IntentDetection',
    headers: [
      'date',
      'mode',
      'identifier',
      'detected_intent',
      'confidence',
      'intent_choices',
      'transcribed_text',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-SentimentAnalysis',
    headers: [
      'date',
      'mode',
      'identifier',
      'detected_sentiment',
      'score',
      'transcribed_text',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-SpeakerDiarization',
    headers: [
      'date',
      'audio_path',
      'transcribed_text',
      'speaker_count',
      'segment_count',
      'segments_summary',
      'duration',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-EmotionDiarization',
    headers: [
      'date',
      'audio_file',
      'emotions_detected',
      'segment_count',
      'avg_confidence',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-WordTimestamps',
    headers: [
      'date',
      'audio_path',
      'transcribed_text',
      'segment_count',
      'total_words',
      'avg_confidence',
      'words_summary',
      'duration',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-ProfanityHashing',
    headers: [
      'date',
      'mode',
      'identifier',
      'Transcript / ground_truth_text',
      'clean_text',
      'profanity_found',
      'profanity_count',
      'profanity_words',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-CustomKeywordHashing',
    headers: [
      'date',
      'mode',
      'identifier',
      'Transcript / ground_truth_text',
      'clean_text',
      'hash_keywords',
      'keywords_count',
      'keywords_found_in_original',
      'hash_count',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-KeywordNormalization',
    headers: [
      'date',
      'mode',
      'identifier',
      'original_text',
      'transcribed_text',
      'normalized_text',
      'keywords',
      'keywords_count',
      'keywords_found_in_normalized',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'Feat-MedicalCorrection',
    headers: [
      'date',
      'mode',
      'identifier',
      'original_text',
      'transcribed_text',
      'corrected_text',
      'entities_found',
      'entities_corrected',
      'corrections',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'zero-indic-concurrent',
    headers: [
      'date',
      'audio_path',
      'lang',
      'lang_code',
      'detected_language',
      'lang_code_match',
      'Transcript / ground_truth_text',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'zero-indic-long-audio',
    headers: [
      'date',
      'audio_path',
      'lang',
      'lang_code',
      'detected_language',
      'lang_code_match',
      'Transcript / ground_truth_text',
      'Shunyalabs_transcribed_text',
      'duration',
      'latency_ms',
      'wer',
      'cer',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
  {
    name: 'zero-tts-synthesis',
    headers: [
      'date',
      'test_id',
      'input_text',
      'voice',
      'language_code',
      'audio_format',
      'audio_size_bytes',
      'duration_estimate_s',
      'latency_ms',
      'test_status',
      'failure_reason',
      'timestamp',
    ],
  },
];

async function getSheetsClient() {
  const credsJson = fs.readFileSync(path.resolve(__dirname, '../Google_service_account.json'), 'utf-8');
  const credentials = JSON.parse(credsJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function main() {
  console.log(`Formatting Output Spreadsheet: ${OUTPUT_SPREADSHEET_ID}`);
  const sheets = await getSheetsClient();

  const meta = await sheets.spreadsheets.get({ spreadsheetId: OUTPUT_SPREADSHEET_ID });
  const existingSheets = meta.data.sheets || [];
  const existingTitles = existingSheets.map(s => s.properties?.title);
  console.log('Existing tabs:', existingTitles);

  for (const tabDef of TAB_DEFINITIONS) {
    const exists = existingTitles.includes(tabDef.name);
    if (!exists) {
      console.log(`Adding tab "${tabDef.name}"...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: OUTPUT_SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: tabDef.name } } }],
        },
      });
      await new Promise(r => setTimeout(r, 400));
    }

    // Set headers
    await sheets.spreadsheets.values.update({
      spreadsheetId: OUTPUT_SPREADSHEET_ID,
      range: `${tabDef.name}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [tabDef.headers] },
    });

    // Style headers
    const currentMeta = await sheets.spreadsheets.get({ spreadsheetId: OUTPUT_SPREADSHEET_ID });
    const sheetObj = (currentMeta.data.sheets || []).find(s => s.properties?.title === tabDef.name);
    if (sheetObj?.properties?.sheetId !== undefined) {
      const sid = sheetObj.properties.sheetId;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: OUTPUT_SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { sheetId: sid, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: tabDef.headers.length },
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
                  sheetId: sid,
                  gridProperties: { frozenRowCount: 1 },
                },
                fields: 'gridProperties.frozenRowCount',
              },
            },
          ],
        },
      });
    }

    console.log(`  ✓ Tab "${tabDef.name}" initialized with ${tabDef.headers.length} columns`);
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\nAll output tabs have been formatted to match the exact template!');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

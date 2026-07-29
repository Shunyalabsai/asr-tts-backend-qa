# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transcription/audio-base64-input.spec.ts >> M03-T05: Oversized base64 returns 413
- Location: src/features/transcription/audio-base64-input.spec.ts:116:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 413
Received: 400
```

# Test source

```ts
  31  |     });
  32  |   } catch (err: any) {
  33  |     testResults.add({
  34  |       testId: 'M03-T01', module: moduleName,
  35  |       description: 'Valid base64-encoded audio returns transcription',
  36  |       status: 'FAIL', latencyMs: Date.now() - start,
  37  |       failureReason: err.message, timestamp: getTimestamp(),
  38  |     });
  39  |     throw err;
  40  |   }
  41  | });
  42  | 
  43  | test('M03-T02: data:audio/wav;base64 prefix handled correctly', async () => {
  44  |   const start = Date.now();
  45  |   try {
  46  |     const audioData = readAudioFile(audioFixture('wav'));
  47  |     const base64 = `data:audio/wav;base64,${audioData.toString('base64')}`;
  48  | 
  49  |     const result = await batchClient.transcribeBase64(base64);
  50  |     expect(result.status).toBe(200);
  51  |     expect(result.body.text).toBeTruthy();
  52  | 
  53  |     testResults.add({
  54  |       testId: 'M03-T02', module: moduleName,
  55  |       description: 'data:audio/wav;base64 prefix handled correctly',
  56  |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  57  |     });
  58  |   } catch (err: any) {
  59  |     testResults.add({
  60  |       testId: 'M03-T02', module: moduleName,
  61  |       description: 'data:audio/wav;base64 prefix handled correctly',
  62  |       status: 'FAIL', latencyMs: Date.now() - start,
  63  |       failureReason: err.message, timestamp: getTimestamp(),
  64  |     });
  65  |     throw err;
  66  |   }
  67  | });
  68  | 
  69  | test('M03-T03: Malformed base64 returns 400', async () => {
  70  |   const start = Date.now();
  71  |   try {
  72  |     await batchClient.transcribeBase64('not-valid-base64!!!');
  73  |     testResults.add({
  74  |       testId: 'M03-T03', module: moduleName,
  75  |       description: 'Malformed base64 returns error',
  76  |       status: 'FAIL', latencyMs: Date.now() - start,
  77  |       failureReason: 'Expected error but got success', timestamp: getTimestamp(),
  78  |     });
  79  |   } catch (err: any) {
  80  |     expect(err.statusCode).toBe(400);
  81  |     testResults.add({
  82  |       testId: 'M03-T03', module: moduleName,
  83  |       description: 'Malformed base64 returns 400',
  84  |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  85  |     });
  86  |   }
  87  | });
  88  | 
  89  | test('M03-T04: Near-limit base64 audio processed', async () => {
  90  |   const start = Date.now();
  91  |   try {
  92  |     // Use moderate audio as near-limit placeholder
  93  |     const audioData = readAudioFile(audioFixture('wav'));
  94  |     const base64 = audioData.toString('base64');
  95  | 
  96  |     const result = await batchClient.transcribeBase64(base64);
  97  |     expect(result.status).toBe(200);
  98  |     expect(result.body.text).toBeTruthy();
  99  | 
  100 |     testResults.add({
  101 |       testId: 'M03-T04', module: moduleName,
  102 |       description: 'Near-limit base64 audio processed',
  103 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  104 |     });
  105 |   } catch (err: any) {
  106 |     testResults.add({
  107 |       testId: 'M03-T04', module: moduleName,
  108 |       description: 'Near-limit base64 audio processed',
  109 |       status: 'FAIL', latencyMs: Date.now() - start,
  110 |       failureReason: err.message, timestamp: getTimestamp(),
  111 |     });
  112 |     throw err;
  113 |   }
  114 | });
  115 | 
  116 | test('M03-T05: Oversized base64 returns 413', async () => {
  117 |   const start = Date.now();
  118 |   try {
  119 |     // Generate a large base64 string (~70MB equivalent)
  120 |     const largeBuffer = Buffer.alloc(70 * 1024 * 1024);
  121 |     const base64 = largeBuffer.toString('base64');
  122 | 
  123 |     await batchClient.transcribeBase64(base64);
  124 |     testResults.add({
  125 |       testId: 'M03-T05', module: moduleName,
  126 |       description: 'Oversized base64 returns 413',
  127 |       status: 'FAIL', latencyMs: Date.now() - start,
  128 |       failureReason: 'Expected 413 error', timestamp: getTimestamp(),
  129 |     });
  130 |   } catch (err: any) {
> 131 |     expect(err.statusCode).toBe(413);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  132 |     testResults.add({
  133 |       testId: 'M03-T05', module: moduleName,
  134 |       description: 'Oversized base64 returns 413',
  135 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  136 |     });
  137 |   }
  138 | });
  139 | 
  140 | test('M03-T06: Empty base64 string returns 400', async () => {
  141 |   const start = Date.now();
  142 |   try {
  143 |     await batchClient.transcribeBase64('');
  144 |     testResults.add({
  145 |       testId: 'M03-T06', module: moduleName,
  146 |       description: 'Empty base64 string returns 400',
  147 |       status: 'FAIL', latencyMs: Date.now() - start,
  148 |       failureReason: 'Expected error but got success', timestamp: getTimestamp(),
  149 |     });
  150 |   } catch (err: any) {
  151 |     expect(err.statusCode).toBe(400);
  152 |     testResults.add({
  153 |       testId: 'M03-T06', module: moduleName,
  154 |       description: 'Empty base64 string returns 400',
  155 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  156 |     });
  157 |   }
  158 | });
  159 | 
```
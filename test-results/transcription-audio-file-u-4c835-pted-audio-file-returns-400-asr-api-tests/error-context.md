# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: transcription/audio-file-upload.spec.ts >> M02-T09: Corrupted audio file returns 400
- Location: src/features/transcription/audio-file-upload.spec.ts:202:5

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 400
Received: 415
```

# Test source

```ts
  113 |     const result = await batchClient.transcribeFile(audioFixture('sample16khz'));
  114 |     expect(result.status).toBe(200);
  115 |     expect(result.body.text).toBeTruthy();
  116 | 
  117 |     testResults.add({
  118 |       testId: 'M02-T05', module: moduleName,
  119 |       description: '16kHz sample rate file processed correctly',
  120 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  121 |     });
  122 |   } catch (err: any) {
  123 |     testResults.add({
  124 |       testId: 'M02-T05', module: moduleName,
  125 |       description: '16kHz sample rate file processed correctly',
  126 |       status: 'FAIL', latencyMs: Date.now() - start,
  127 |       failureReason: err.message, timestamp: getTimestamp(),
  128 |     });
  129 |     throw err;
  130 |   }
  131 | });
  132 | 
  133 | test('M02-T06: Stereo audio file accepted and processed', async () => {
  134 |   const start = Date.now();
  135 |   try {
  136 |     const result = await batchClient.transcribeFile(audioFixture('stereo'));
  137 |     expect(result.status).toBe(200);
  138 |     expect(result.body.text).toBeTruthy();
  139 | 
  140 |     testResults.add({
  141 |       testId: 'M02-T06', module: moduleName,
  142 |       description: 'Stereo audio file accepted and processed',
  143 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  144 |     });
  145 |   } catch (err: any) {
  146 |     testResults.add({
  147 |       testId: 'M02-T06', module: moduleName,
  148 |       description: 'Stereo audio file accepted and processed',
  149 |       status: 'FAIL', latencyMs: Date.now() - start,
  150 |       failureReason: err.message, timestamp: getTimestamp(),
  151 |     });
  152 |     throw err;
  153 |   }
  154 | });
  155 | 
  156 | test('M02-T07: File ~25MB (moderate size)', async () => {
  157 |   const start = Date.now();
  158 |   try {
  159 |     const result = await batchClient.transcribeFile(audioFixture('large'));
  160 |     expect(result.status).toBe(200);
  161 |     expect(result.body.text).toBeTruthy();
  162 | 
  163 |     testResults.add({
  164 |       testId: 'M02-T07', module: moduleName,
  165 |       description: '~25MB file processed',
  166 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  167 |     });
  168 |   } catch (err: any) {
  169 |     testResults.add({
  170 |       testId: 'M02-T07', module: moduleName,
  171 |       description: '~25MB file processed',
  172 |       status: 'FAIL', latencyMs: Date.now() - start,
  173 |       failureReason: err.message, timestamp: getTimestamp(),
  174 |     });
  175 |     throw err;
  176 |   }
  177 | });
  178 | 
  179 | test('M02-T08: File ~70MB (near limit, expect 200 or 413)', async () => {
  180 |   const start = Date.now();
  181 |   try {
  182 |     const result = await batchClient.transcribeFile(audioFixture('oversized'));
  183 |     // May succeed or return 413 depending on plan limit
  184 |     expect([200, 413]).toContain(result.status);
  185 | 
  186 |     testResults.add({
  187 |       testId: 'M02-T08', module: moduleName,
  188 |       description: '~70MB file (near limit) handled',
  189 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  190 |     });
  191 |   } catch (err: any) {
  192 |     testResults.add({
  193 |       testId: 'M02-T08', module: moduleName,
  194 |       description: '~70MB file (near limit) handled',
  195 |       status: 'PASS', // Accept 413 as valid behavior
  196 |       latencyMs: Date.now() - start,
  197 |       failureReason: err.message, timestamp: getTimestamp(),
  198 |     });
  199 |   }
  200 | });
  201 | 
  202 | test('M02-T09: Corrupted audio file returns 400', async () => {
  203 |   const start = Date.now();
  204 |   try {
  205 |     await batchClient.transcribeFile(audioFixture('corrupted'));
  206 |     testResults.add({
  207 |       testId: 'M02-T09', module: moduleName,
  208 |       description: 'Corrupted audio file returns error',
  209 |       status: 'FAIL', latencyMs: Date.now() - start,
  210 |       failureReason: 'Expected error but got success', timestamp: getTimestamp(),
  211 |     });
  212 |   } catch (err: any) {
> 213 |     expect(err.statusCode).toBe(400);
      |                            ^ Error: expect(received).toBe(expected) // Object.is equality
  214 |     testResults.add({
  215 |       testId: 'M02-T09', module: moduleName,
  216 |       description: 'Corrupted audio file returns 400',
  217 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  218 |     });
  219 |   }
  220 | });
  221 | 
  222 | test('M02-T10: Empty audio file returns 400', async () => {
  223 |   const start = Date.now();
  224 |   try {
  225 |     await batchClient.transcribeFile(audioFixture('empty'));
  226 |     testResults.add({
  227 |       testId: 'M02-T10', module: moduleName,
  228 |       description: 'Empty audio file returns error',
  229 |       status: 'FAIL', latencyMs: Date.now() - start,
  230 |       failureReason: 'Expected error but got success', timestamp: getTimestamp(),
  231 |     });
  232 |   } catch (err: any) {
  233 |     expect(err.statusCode).toBe(400);
  234 |     testResults.add({
  235 |       testId: 'M02-T10', module: moduleName,
  236 |       description: 'Empty audio file returns 400',
  237 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  238 |     });
  239 |   }
  240 | });
  241 | 
  242 | test('M02-T11: Silent audio returns empty transcription', async () => {
  243 |   const start = Date.now();
  244 |   try {
  245 |     const result = await batchClient.transcribeFile(audioFixture('silent'));
  246 |     expect(result.status).toBe(200);
  247 | 
  248 |     testResults.add({
  249 |       testId: 'M02-T11', module: moduleName,
  250 |       description: 'Silent audio processed',
  251 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  252 |     });
  253 |   } catch (err: any) {
  254 |     testResults.add({
  255 |       testId: 'M02-T11', module: moduleName,
  256 |       description: 'Silent audio processed',
  257 |       status: 'FAIL', latencyMs: Date.now() - start,
  258 |       failureReason: err.message, timestamp: getTimestamp(),
  259 |     });
  260 |     throw err;
  261 |   }
  262 | });
  263 | 
  264 | test('M02-T12: Very short audio (<1s) processed', async () => {
  265 |   const start = Date.now();
  266 |   try {
  267 |     const result = await batchClient.transcribeFile(audioFixture('empty'));
  268 |     // Very short audio test - may return success or 400 depending on API
  269 |     expect([200, 400]).toContain(result.status);
  270 | 
  271 |     testResults.add({
  272 |       testId: 'M02-T12', module: moduleName,
  273 |       description: 'Very short audio (<1s) handled',
  274 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  275 |     });
  276 |   } catch (err: any) {
  277 |     testResults.add({
  278 |       testId: 'M02-T12', module: moduleName,
  279 |       description: 'Very short audio (<1s) handled',
  280 |       status: 'PASS', latencyMs: Date.now() - start,
  281 |       failureReason: err.message, timestamp: getTimestamp(),
  282 |     });
  283 |   }
  284 | });
  285 | 
  286 | test('M02-T13: Audio URL input returns transcription', async () => {
  287 |   const testAudioUrl = process.env.TEST_AUDIO_URL;
  288 |   test.skip(!testAudioUrl, 'TEST_AUDIO_URL not configured');
  289 | 
  290 |   const start = Date.now();
  291 |   try {
  292 |     const result = await batchClient.transcribeUrl(testAudioUrl!);
  293 |     expect(result.status).toBe(200);
  294 |     expect(result.body.text).toBeTruthy();
  295 | 
  296 |     testResults.add({
  297 |       testId: 'M02-T13', module: moduleName,
  298 |       description: 'Audio URL input returns transcription',
  299 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  300 |     });
  301 |   } catch (err: any) {
  302 |     testResults.add({
  303 |       testId: 'M02-T13', module: moduleName,
  304 |       description: 'Audio URL input returns transcription',
  305 |       status: 'FAIL', latencyMs: Date.now() - start,
  306 |       failureReason: err.message, timestamp: getTimestamp(),
  307 |     });
  308 |     throw err;
  309 |   }
  310 | });
  311 | 
  312 | test('M02-T14: Long audio (max-length) processed', async () => {
  313 |   const start = Date.now();
```
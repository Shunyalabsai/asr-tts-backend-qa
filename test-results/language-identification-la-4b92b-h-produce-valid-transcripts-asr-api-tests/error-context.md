# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: language-identification/language-code.spec.ts >> M04-T08: Multiple language codes each produce valid transcripts
- Location: src/features/language-identification/language-code.spec.ts:171:5

# Error details

```
Error: gu: API error [408]: Request timed out
```

# Test source

```ts
  97  |     expect(err.statusCode).toBe(400);
  98  |     testResults.add({
  99  |       testId: 'M04-T04', module: moduleName,
  100 |       description: 'Invalid language code returns 400',
  101 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  102 |     });
  103 |   }
  104 | });
  105 | 
  106 | test('M04-T05: Non-English audio with auto-detect works', async () => {
  107 |   const start = Date.now();
  108 |   try {
  109 |     const result = await batchClient.transcribeFile(audioFixture('wav'));
  110 |     expect(result.status).toBe(200);
  111 |     expect(result.body.text).toBeTruthy();
  112 | 
  113 |     testResults.add({
  114 |       testId: 'M04-T05', module: moduleName,
  115 |       description: 'Non-English audio with auto-detect works',
  116 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  117 |     });
  118 |   } catch (err: any) {
  119 |     testResults.add({
  120 |       testId: 'M04-T05', module: moduleName,
  121 |       description: 'Non-English audio with auto-detect works',
  122 |       status: 'FAIL', latencyMs: Date.now() - start,
  123 |       failureReason: err.message, timestamp: getTimestamp(),
  124 |     });
  125 |     throw err;
  126 |   }
  127 | });
  128 | 
  129 | test('M04-T06: Case-insensitive language_code (EN vs en)', async () => {
  130 |   const start = Date.now();
  131 |   try {
  132 |     const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: 'EN' });
  133 |     expect(result.status).toBe(200);
  134 | 
  135 |     testResults.add({
  136 |       testId: 'M04-T06', module: moduleName,
  137 |       description: 'Case-insensitive language_code handled',
  138 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  139 |     });
  140 |   } catch (err: any) {
  141 |     testResults.add({
  142 |       testId: 'M04-T06', module: moduleName,
  143 |       description: 'Case-insensitive language_code handled',
  144 |       status: 'FAIL', latencyMs: Date.now() - start,
  145 |       failureReason: err.message, timestamp: getTimestamp(),
  146 |     });
  147 |     throw err;
  148 |   }
  149 | });
  150 | 
  151 | test('M04-T07: Empty language_code string returns 400', async () => {
  152 |   const start = Date.now();
  153 |   try {
  154 |     await batchClient.transcribeFile(audioFixture('wav'), { language_code: '' });
  155 |     testResults.add({
  156 |       testId: 'M04-T07', module: moduleName,
  157 |       description: 'Empty language_code returns 400',
  158 |       status: 'FAIL', latencyMs: Date.now() - start,
  159 |       failureReason: 'Expected error but got success', timestamp: getTimestamp(),
  160 |     });
  161 |   } catch (err: any) {
  162 |     expect(err.statusCode).toBe(400);
  163 |     testResults.add({
  164 |       testId: 'M04-T07', module: moduleName,
  165 |       description: 'Empty language_code returns 400',
  166 |       status: 'PASS', latencyMs: Date.now() - start, timestamp: getTimestamp(),
  167 |     });
  168 |   }
  169 | });
  170 | 
  171 | test('M04-T08: Multiple language codes each produce valid transcripts', async () => {
  172 |   const start = Date.now();
  173 |   const langs = ['en', 'hi', 'gu', 'ta', 'bn'];
  174 |   let allPassed = true;
  175 |   let lastErr = '';
  176 | 
  177 |   for (const lang of langs) {
  178 |     try {
  179 |       const result = await batchClient.transcribeFile(audioFixture('wav'), { language_code: lang });
  180 |       expect(result.status).toBe(200);
  181 |       expect(result.body.text).toBeTruthy();
  182 |     } catch (err: any) {
  183 |       allPassed = false;
  184 |       lastErr = `${lang}: ${err.message}`;
  185 |       break;
  186 |     }
  187 |   }
  188 | 
  189 |   testResults.add({
  190 |     testId: 'M04-T08', module: moduleName,
  191 |     description: 'Multiple language codes produce valid transcripts',
  192 |     status: allPassed ? 'PASS' : 'FAIL',
  193 |     latencyMs: Date.now() - start,
  194 |     failureReason: allPassed ? undefined : lastErr,
  195 |     timestamp: getTimestamp(),
  196 |   });
> 197 |   if (!allPassed) throw new Error(lastErr);
      |                         ^ Error: gu: API error [408]: Request timed out
  198 | });
  199 | 
```
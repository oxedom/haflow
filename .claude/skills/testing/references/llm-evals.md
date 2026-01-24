# Evaluating LLM Outputs

Testing non-deterministic systems requires different approaches than traditional testing.

## The Challenge

```typescript
// This will randomly fail!
test('generates palindrome', () => {
  const result = generatePalindrome('holy grail');
  expect(result).toBe('Sir, a Grail, a liar, Garis!');
});
```

LLM outputs are non-deterministic. We need **statistical evaluation**, not exact matching.

## Quality Measures

### 1. Deterministic Checks

Test properties that MUST be true regardless of specific output:

```typescript
test('generated palindrome is valid', async () => {
  const result = await generatePalindrome('cats');

  // Deterministic check - must be a palindrome
  const cleaned = result.toLowerCase().replace(/[^a-z]/g, '');
  expect(cleaned).toBe(cleaned.split('').reverse().join(''));
});

test('summary is shorter than original', async () => {
  const original = 'A very long text...'.repeat(100);
  const summary = await summarize(original);

  expect(summary.length).toBeLessThan(original.length * 0.3);
});

test('extracted entities are valid JSON', async () => {
  const result = await extractEntities('John works at Acme Corp');

  expect(() => JSON.parse(result)).not.toThrow();
  const entities = JSON.parse(result);
  expect(entities).toHaveProperty('persons');
  expect(entities).toHaveProperty('organizations');
});
```

### 2. LLM-as-Judge

Use another LLM to evaluate output quality:

```typescript
interface Evaluation {
  relevanceScore: number;  // 1-10
  coherenceScore: number;  // 1-10
  reasoning: string;
}

async function evaluateResponse(
  topic: string,
  response: string
): Promise<Evaluation> {
  const result = await evaluatorModel.generate({
    prompt: `
      Evaluate this response about "${topic}":

      "${response}"

      Score 1-10 on:
      - Relevance: How well does it address the topic?
      - Coherence: Is it grammatically correct and logical?

      Return JSON: { relevanceScore, coherenceScore, reasoning }
    `,
  });

  return JSON.parse(result);
}

test('response quality meets threshold', async () => {
  const response = await generateResponse('quantum computing basics');
  const evaluation = await evaluateResponse('quantum computing basics', response);

  expect(evaluation.relevanceScore).toBeGreaterThanOrEqual(7);
  expect(evaluation.coherenceScore).toBeGreaterThanOrEqual(7);
});
```

### 3. Embedding Similarity

Compare semantic similarity using embeddings:

```typescript
import { cosineSimilarity } from './utils';

async function semanticSimilarity(a: string, b: string): Promise<number> {
  const [embA, embB] = await Promise.all([
    embeddingModel.embed(a),
    embeddingModel.embed(b),
  ]);
  return cosineSimilarity(embA, embB);
}

test('summary captures main ideas', async () => {
  const original = 'The quick brown fox jumps over the lazy dog...';
  const summary = await summarize(original);

  const similarity = await semanticSimilarity(original, summary);
  expect(similarity).toBeGreaterThan(0.7);
});
```

### 4. Ensemble Scoring

Combine multiple metrics:

```typescript
interface EvalResult {
  isPalindrome: boolean;      // deterministic
  topicRelevance: number;     // LLM judge (1-10)
  grammaticalSense: number;   // LLM judge (1-10)
  averageScore: number;
}

async function evaluatePalindrome(
  topic: string,
  generated: string
): Promise<EvalResult> {
  const isPalindrome = checkPalindrome(generated);
  const llmEval = await llmJudge(topic, generated);

  const palindromeScore = isPalindrome ? 10 : 0;
  const averageScore = (
    palindromeScore +
    llmEval.topicRelevance +
    llmEval.grammaticalSense
  ) / 3;

  return {
    isPalindrome,
    topicRelevance: llmEval.topicRelevance,
    grammaticalSense: llmEval.grammaticalSense,
    averageScore,
  };
}
```

## Train/Test Split

**Critical**: Don't optimize prompts on the same examples you evaluate on.

```typescript
const allExamples = loadExamples();
shuffle(allExamples);

// 80/20 split
const trainSet = allExamples.slice(0, 800);  // For prompt engineering
const testSet = allExamples.slice(800);       // For final evaluation

// Iterate on trainSet
for (const example of trainSet) {
  const result = await generate(example.input);
  console.log(evaluate(result, example));
  // Tweak prompt based on results
}

// Final evaluation on testSet (run ONCE)
const testResults = await Promise.all(
  testSet.map(async (example) => {
    const result = await generate(example.input);
    return evaluate(result, example);
  })
);
console.log('Final accuracy:', average(testResults));
```

## Statistical Testing

Run multiple times and check distribution:

```typescript
test('quality is consistent', async () => {
  const scores: number[] = [];

  for (let i = 0; i < 20; i++) {
    const result = await generatePalindrome('cats');
    const evaluation = await evaluate(result);
    scores.push(evaluation.averageScore);
  }

  const mean = scores.reduce((a, b) => a + b) / scores.length;
  const min = Math.min(...scores);

  expect(mean).toBeGreaterThan(7);  // Average quality
  expect(min).toBeGreaterThan(4);   // No catastrophic failures
});
```

## Production Monitoring

Log everything for analysis:

```typescript
async function generateWithLogging(input: string) {
  const startTime = Date.now();
  const result = await generate(input);
  const evaluation = await evaluate(result);

  await log({
    timestamp: new Date(),
    input,
    output: result,
    latencyMs: Date.now() - startTime,
    evaluation,
    modelVersion: MODEL_VERSION,
  });

  return result;
}
```

Track metrics over time:
- Quality score distribution
- Latency percentiles
- Failure rate
- Drift detection (quality degradation)

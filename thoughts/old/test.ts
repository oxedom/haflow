import { runClaude } from './claude-runner';

/**
 * Analyzes a task until it completes or fails
 * Loops until receiving <promise>COMPLETE</promise> or <promise>FAILED</promise>
 */
async function analyzeTaskUntilComplete(task: string): Promise<void> {
  let iteration = 0;
  const maxIterations = 10;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n📋 Analysis iteration ${iteration}...\n`);

    const prompt = `Please carefully refine the following free-text task into a clear and actionable pre-PRD (preliminary product requirements document): ${task}. If you determine during your analysis that the task is already complete, output <promise>COMPLETE</promise>. If the research or refinement has failed, output <promise>FAILED</promise>.`;

    try {
      const result = await runClaude(prompt);
      console.log(result);

      if (result.includes('<promise>COMPLETE</promise>')) {
        console.log('\n✅ Task analysis complete.');
        return;
      }

      if (result.includes('<promise>FAILED</promise>')) {
        console.log('\n❌ Task analysis failed.');
        return;
      }

      // If no completion marker, loop again
      console.log('\n⏳ No completion marker found, retrying...');
    } catch (error) {
      console.error('Error during analysis:', error);
      return;
    }
  }

  console.log('\n⚠️ Max iterations reached without completion.');
}

// Main execution
const task = 'make me a cool recipe website';
analyzeTaskUntilComplete(task).then((data) => {
  console.log('Task analysis complete.', JSON.stringify(data, null, 4));

}).catch((error) => {
  console.error('Error during analysis:', error);
});

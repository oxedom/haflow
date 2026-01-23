import { runPipeline, resumePipeline, getPipelineState } from './lang';
import * as readline from 'readline';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function prompt(question: string): Promise<string> {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

async function runInteractivePipeline() {
    const rawInput = `
I want to make a recipe website . IMPORTANT TO INCLUDE PATH IN THE PROMPT @packages/backend/public/index.html
`;

    const threadId = '123';

    console.log("🚀 Starting interactive pipeline...\n");

    // Start the pipeline
    let result = await runPipeline(rawInput, threadId);

    // Loop until the pipeline completes or is rejected
    while (true) {
        // Check if there are any pending interrupts
        const state = await getPipelineState(threadId);

        if (!state || !state.values) {
            console.log("\n✅ Pipeline completed!");
            console.log(result);
            break;
        }

        // Check if we're at an interrupt point
        const nextNodes = state.next;
        if (!nextNodes || nextNodes.length === 0) {
            console.log("\n✅ Pipeline completed!");
            console.log(result);
            break;
        }

        // Display the interrupt information
        const interrupt = state.values.__interrupt__;
        if (interrupt && interrupt.length > 0) {
            const interruptData = interrupt[0].value;
            console.log("\n" + "=".repeat(60));
            console.log(`📋 ${interruptData.step}`);
            console.log("=".repeat(60));
            console.log(`\n${interruptData.message}\n`);
            console.log("Content to review:");
            console.log("-".repeat(60));
            console.log(interruptData.content);
            console.log("-".repeat(60));
            console.log(`\n${interruptData.options}\n`);

            const decision = await prompt("Your decision: ");

            // Resume the pipeline with the user's decision
            result = await resumePipeline(decision, threadId);
        } else {
            // No interrupt, check if pipeline completed
            if (nextNodes.length === 0) {
                console.log("\n✅ Pipeline completed!");
                console.log(result);
                break;
            } else {
                console.log("Pipeline continuing...");
                result = await runPipeline(rawInput, threadId);
            }
        }
    }

    rl.close();
}

runInteractivePipeline().catch(console.error);
import {
  StateSchema,
  StateGraph,
  START,
  END,
  interrupt,
  MemorySaver,
  Command,
} from "@langchain/langgraph";
import * as z from "zod";
import * as fs from "fs";
import { runClaudeResource } from './claude-runner'

// Flow:
// raw input -> smallToBeforeResearchSkill -> humanGate -> researchAgent -> humanGate
// -> implementPlanAgent -> humanGate -> oneshotPlanAgent -> humanGate
// -> executeSafeImplementation -> humanGate -> createCommitAndOpenPR

// State schema for the pipeline
const PipelineState = new StateSchema({
  rawInput: z.string().describe("The initial raw input from user"),
  refinedPrompt: z.string().nullable().describe("Output from smallToBeforeResearchSkill"),
  researchOutput: z.string().nullable().describe("Output from research agent"),
  implementationPlan: z.string().nullable().describe("Output from implement plan agent"),
  oneshotPlan: z.string().nullable().describe("Output from oneshot plan agent"),
  implementationResult: z.string().nullable().describe("Output from safe implementation"),
  prResult: z.string().nullable().describe("Output from commit and PR creation"),
  currentStep: z.string().describe("Current step in the pipeline"),
});

// Node: Transform raw input using smallToBeforeResearch skill
async function smallToBeforeResearchNode(state: any) {
  console.log("📝 Running smallToBeforeResearchSkill (dry-run mode)...");
  const result = await runClaudeResource('smallToBeforeResearch', state.rawInput, true);
  return { refinedPrompt: result, currentStep: "smallToBeforeResearch_complete" };
}

// Factory function to create human gate nodes
function createHumanGate(config: {
  step: string;
  message: string;
  contentKey: string;
  nextNode: string;
  stepName: string;
}) {
  return async (state: any) => {
    const decision = interrupt({
      step: config.step,
      message: config.message,
      content: state[config.contentKey],
      options: "Reply with 'approve' to continue, 'reject' to stop, or provide edited content.",
    });

    if (decision === "reject") {
      return new Command({ goto: "rejected" });
    }

    const finalContent = (decision === "approve" || decision === true)
      ? state[config.contentKey]
      : decision;

    return new Command({
      goto: config.nextNode,
      update: { [config.contentKey]: finalContent, currentStep: config.stepName }
    });
  };
}

// Human gate instances
const humanGateAfterRefine = createHumanGate({
  step: "Review Refined Prompt",
  message: "Review the refined prompt before proceeding to research.",
  contentKey: "refinedPrompt",
  nextNode: "researchAgent",
  stepName: "humanGate1_approved",
});

const humanGateAfterResearch = createHumanGate({
  step: "Review Research Output",
  message: "Review the research findings before creating implementation plan.",
  contentKey: "researchOutput",
  nextNode: "implementPlanAgent",
  stepName: "humanGate2_approved",
});

const humanGateAfterImplementPlan = createHumanGate({
  step: "Review Implementation Plan",
  message: "Review the implementation plan before proceeding.",
  contentKey: "implementationPlan",
  nextNode: "oneshotPlanAgent",
  stepName: "humanGate3_approved",
});

const humanGateAfterOneshotPlan = createHumanGate({
  step: "Review Oneshot Plan",
  message: "Review the oneshot plan before executing implementation.",
  contentKey: "oneshotPlan",
  nextNode: "executeSafeImplementation",
  stepName: "humanGate4_approved",
});

const humanGateAfterImplementation = createHumanGate({
  step: "Review Implementation Result",
  message: "Review the implementation before creating commit and PR.",
  contentKey: "implementationResult",
  nextNode: END,
  stepName: "humanGate5_approved",
});

// Node: Research agent
async function researchAgentNode(state: any) {
  console.log("🔍 Running research agent (dry-run mode)...");
  const result = await runClaudeResource('researchCodebase', state.refinedPrompt!, true);
  return { researchOutput: result, currentStep: "research_complete" };
}

// Node: Implementation plan agent
async function implementPlanAgentNode(state: any) {
  console.log("📋 Running implementation plan agent (dry-run mode)...");
  const result = await runClaudeResource('createPlan', state.researchOutput!, true);
  return { implementationPlan: result, currentStep: "implementPlan_complete" };
}

// Node: Oneshot plan agent
async function oneshotPlanAgentNode(state: any) {
  console.log("⚡ Running oneshot plan agent (dry-run mode)...");
  const result = await runClaudeResource('oneshotPlan', state.implementationPlan!, true);
  return { oneshotPlan: result, currentStep: "oneshotPlan_complete" };
}

// Node: Execute safe implementation
async function executeSafeImplementationNode(state: any) {
  console.log("🔨 Executing safe implementation...");
  const result = await runClaudeResource('implementPlan', state.oneshotPlan!);
  return { implementationResult: result, currentStep: "implementation_complete" };
}

// Node: Create commit and open PR
// async function createCommitAndOpenPRNode(state: any) {
//   console.log("🚀 Creating commit and opening PR...");
//   const result = await runClaudeResource('commitPushCreatePr', state.implementationResult!);
//   return { prResult: result, currentStep: "complete" };
// }

// Node: Rejected handler
function rejectedNode() {
  console.log("❌ Pipeline rejected by user");
  return { currentStep: "rejected" };
}

// Build the graph
const graphBuilder = new StateGraph(PipelineState)
  // Add all nodes
  .addNode("smallToBeforeResearch", smallToBeforeResearchNode)
  .addNode("humanGateAfterRefine", humanGateAfterRefine, { ends: ["researchAgent", "rejected"] })
  .addNode("researchAgent", researchAgentNode)
  .addNode("humanGateAfterResearch", humanGateAfterResearch, { ends: ["implementPlanAgent", "rejected"] })
  .addNode("implementPlanAgent", implementPlanAgentNode)
  .addNode("humanGateAfterImplementPlan", humanGateAfterImplementPlan, { ends: ["oneshotPlanAgent", "rejected"] })
  .addNode("oneshotPlanAgent", oneshotPlanAgentNode)
  .addNode("humanGateAfterOneshotPlan", humanGateAfterOneshotPlan, { ends: ["executeSafeImplementation", "rejected"] })
  .addNode("executeSafeImplementation", executeSafeImplementationNode)
  .addNode("humanGateAfterImplementation", humanGateAfterImplementation, { ends: [END, "rejected"] })
  // .addNode("createCommitAndOpenPR", createCommitAndOpenPRNode)
  .addNode("rejected", rejectedNode)

  // Wire up the flow
  .addEdge(START, "smallToBeforeResearch")
  .addEdge("smallToBeforeResearch", "humanGateAfterRefine")
  // humanGateAfterRefine routes dynamically via Command
  .addEdge("researchAgent", "humanGateAfterResearch")
  // humanGateAfterResearch routes dynamically via Command
  .addEdge("implementPlanAgent", "humanGateAfterImplementPlan")
  // humanGateAfterImplementPlan routes dynamically via Command
  .addEdge("oneshotPlanAgent", "humanGateAfterOneshotPlan")
  // humanGateAfterOneshotPlan routes dynamically via Command
  .addEdge("executeSafeImplementation", "humanGateAfterImplementation")
  // humanGateAfterImplementation routes dynamically via Command
  // .addEdge("createCommitAndOpenPR", END)
  .addEdge("rejected", END);

// Compile with checkpointer for interrupt support
const checkpointer = new MemorySaver();
const pipelineGraph: any = graphBuilder.compile({ checkpointer });

/**
 * Run the full pipeline with human-in-the-loop gates
 * @param rawInput - The initial user input/request
 * @param threadId - Unique thread ID for this pipeline run
 */
async function runPipeline(rawInput: string, threadId: string): Promise<any> {
  const config = { configurable: { thread_id: threadId } };

  const initialState = {
    rawInput,
    refinedPrompt: null,
    researchOutput: null,
    implementationPlan: null,
    oneshotPlan: null,
    implementationResult: null,
    prResult: null,
    currentStep: "started",
  };

  console.log("🚀 Starting pipeline with thread:", threadId);
  return await pipelineGraph.invoke(initialState, config);
}

/**
 * Resume a paused pipeline with user decision
 * @param decision - User's decision: 'approve', 'reject', or edited content
 * @param threadId - The thread ID of the paused pipeline
 */
async function resumePipeline(decision: string | boolean, threadId: string): Promise<any> {
  const config = { configurable: { thread_id: threadId } };
  console.log("▶️ Resuming pipeline with decision:", decision);
  return await pipelineGraph.invoke(new Command({ resume: decision }), config);
}

/**
 * Get the current state of a pipeline
 * @param threadId - The thread ID to check
 */
async function getPipelineState(threadId: string) {
  const config = { configurable: { thread_id: threadId } };
  return await pipelineGraph.getState(config);
}

/**
 * Generate and save the graph visualization
 */
async function saveGraphVisualization() {
  const mermaidPng = await pipelineGraph.getGraphAsync().then((graph: any) => graph.drawMermaidPng());
  fs.writeFileSync("graph.png", Buffer.from(await mermaidPng.arrayBuffer()));
  console.log("Graph visualization saved to graph.png");
}

saveGraphVisualization();

export {
  pipelineGraph,
  runPipeline,
  resumePipeline,
  getPipelineState,
  saveGraphVisualization,
  PipelineState,
};

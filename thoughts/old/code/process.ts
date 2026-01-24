import { b } from "../packages/backend/baml_client"
import type { Resume } from "../packages/backend/baml_client/types"

const temp = 'make program builder responsive for mobile'

async function rambleToThought() : Promise<void> {
}



// AI: Implementation - Code changes (Docker)
async function implementation(): Promise<void> {
}

// AI: Commit & Pull request
async function commitAndPRClaude(): Promise<void> {
}


// Final: Completed - Merged, GitHub updated
async function completed(): Promise<void> {
}

function humanReview(md: string) {}

//spawns agents
async function rawToResearch(raw : string): Promise<string> {
  return '1'
}

function researchToIPlan() {}

rawToResearch(temp).then(humanReview).then(researchToIPlan)



async function Example(raw_resume: string): Promise<Resume> {
  // BAML's internal parser guarantees ExtractResume
  // to be always return a Resume type
  const response = await b.ExtractResume(raw_resume);
  return response;
}

async function ExampleStream(raw_resume: string): Promise<Resume> {
  const stream = b.stream.ExtractResume(raw_resume);
  for await (const msg of stream) {
    console.log(msg) // This will be a Partial<Resume> type
  }

  // This is guaranteed to be a Resume type.
  return await stream.getFinalResponse();
}

// ============================================
// Workflow Stage Functions
// ============================================






// AI: Prepare PRD.json formatted for execution
async function prepareForRalphClaude(): Promise<void> {
}

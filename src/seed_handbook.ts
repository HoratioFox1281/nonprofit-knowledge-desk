import { createHash } from "node:crypto";
import type { HandbookChunk } from "./contracts.js";
import { embedText } from "./knowledge_desk.js";
import { infraiRequest } from "./infrai_client.js";

const collection = "nonprofit-team-handbook";
const dimension = 1536;

const handbook: HandbookChunk[] = [
  {
    id: "receipt-year-end",
    title: "Year-end donor receipts",
    area: "donor_receipts",
    text: "Send annual donor receipts by January 31. The receipt includes the organization name, contribution date and amount, and a statement describing whether goods or services were provided.",
  },
  {
    id: "volunteer-shift-reminder",
    title: "Volunteer shift reminders",
    area: "volunteer_reminders",
    text: "Send the first reminder 48 hours before a volunteer shift and a short confirmation on the morning of the shift. Include the coordinator name, arrival point, and cancellation contact.",
  },
  {
    id: "campaign-weekly-report",
    title: "Weekly campaign reporting",
    area: "campaign_reporting",
    text: "Publish the campaign report each Monday. Record gifts received, active donors, volunteer hours, story approvals, and progress against the campaign target. Compare the reporting window with the prior week.",
  },
];

async function main(): Promise<void> {
  const vectors = await Promise.all(handbook.map(async (chunk) => ({
    id: chunk.id,
    values: await embedText(`${chunk.title}\n${chunk.text}`),
    metadata: chunk,
  })));
  const contentVersion = createHash("sha256").update(JSON.stringify(handbook)).digest("hex");
  await infraiRequest(
    "/v1/vector/collection/create",
    { collection, dimension, metric: "cosine" },
    `handbook-collection-${dimension}`,
  );
  await infraiRequest("/v1/vector/upsert", { collection, vectors }, `handbook-${contentVersion}`);
  console.log(`Indexed ${vectors.length} handbook passages in ${collection}.`);
}

await main();

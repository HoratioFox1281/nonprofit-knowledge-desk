import { z } from "zod";

export const AskBody = z.object({
  question: z.string().trim().min(5).max(500),
  area: z.enum(["donor_receipts", "volunteer_reminders", "campaign_reporting"]),
});

export type AskBody = z.infer<typeof AskBody>;

export type HandbookChunk = {
  id: string;
  title: string;
  area: AskBody["area"];
  text: string;
};

export type KnowledgeAnswer = {
  disposition: "answer" | "finance_review";
  answer: string;
  sources: Array<{ id: string; title: string }>;
};

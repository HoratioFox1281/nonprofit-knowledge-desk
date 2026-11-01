export type AnswerDisposition = "answer" | "finance_review";

const sensitiveReceiptTerms = [
  "bank account",
  "credit card",
  "tax id",
  "routing number",
  "refund",
];

export function chooseDisposition(question: string): AnswerDisposition {
  const normalized = question.toLowerCase();
  return sensitiveReceiptTerms.some((term) => normalized.includes(term))
    ? "finance_review"
    : "answer";
}

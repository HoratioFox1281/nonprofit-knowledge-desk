import { chooseDisposition } from "./answer_policy.js";
import type { AskBody, HandbookChunk, KnowledgeAnswer } from "./contracts.js";
import { infraiRequest, openAIClient } from "./infrai_client.js";

const collection = "nonprofit-team-handbook";
const embeddingModel = "text-embedding-3-small";
const answerModel = "gpt-4o-mini";

type QueryMatch = { id: string; metadata?: Partial<HandbookChunk> };
type QueryData = { matches?: QueryMatch[]; results?: QueryMatch[] } | QueryMatch[];
type RerankItem = { index?: number; candidate?: string };
type RerankData = { results?: RerankItem[] } | RerankItem[];

function listFrom<T>(value: T[] | { results?: T[] }, fallback: T[] = []): T[] {
  return Array.isArray(value) ? value : value.results ?? fallback;
}

export async function embedText(text: string): Promise<number[]> {
  const response = await openAIClient().embeddings.create({ model: embeddingModel, input: text });
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response was empty.");
  return embedding;
}

export async function answerFromHandbook(input: AskBody): Promise<KnowledgeAnswer> {
  const disposition = chooseDisposition(input.question);
  if (disposition === "finance_review") {
    return {
      disposition,
      answer: "Send this question to the finance lead; the bot does not answer requests involving sensitive donor payment or tax details.",
      sources: [],
    };
  }

  const embedding = await embedText(input.question);
  const rawQuery = await infraiRequest<QueryData>("/v1/vector/query", {
    collection,
    embedding,
    top_k: 8,
    filter: { area: input.area },
    include_metadata: true,
  });
  const matches = Array.isArray(rawQuery) ? rawQuery : rawQuery.matches ?? rawQuery.results ?? [];
  const chunks = matches
    .map((match) => match.metadata)
    .filter((item): item is HandbookChunk => Boolean(item?.id && item.title && item.text && item.area));
  if (chunks.length === 0) {
    return { disposition, answer: "I could not find a matching handbook passage.", sources: [] };
  }

  const candidates = chunks.map((chunk) => `${chunk.title}\n${chunk.text}`);
  const reranked = await infraiRequest<RerankData>("/v1/ai/rerank", {
    query: input.question,
    candidates,
    top_k: 4,
    model: "auto",
    vendor: "cohere",
  });
  const rankedItems = listFrom(reranked);
  const rankedChunks = rankedItems
    .map((item) => item.index === undefined ? undefined : chunks[item.index])
    .filter((chunk): chunk is HandbookChunk => Boolean(chunk));
  const contextChunks = rankedChunks.length > 0 ? rankedChunks : chunks.slice(0, 4);
  const context = contextChunks.map((chunk, index) => `[${index + 1}] ${chunk.title}\n${chunk.text}`).join("\n\n");

  const completion = await openAIClient().chat.completions.create({
    model: answerModel,
    messages: [
      {
        role: "system",
        content: "Answer only from the supplied nonprofit handbook context. Be concise. Cite passages as [1], [2], and say when the context is insufficient.",
      },
      { role: "user", content: `Question: ${input.question}\n\nContext:\n${context}` },
    ],
  });

  return {
    disposition,
    answer: completion.choices[0]?.message.content ?? "The handbook context did not produce an answer.",
    sources: contextChunks.map(({ id, title }) => ({ id, title })),
  };
}

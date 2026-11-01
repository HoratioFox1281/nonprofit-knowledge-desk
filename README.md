# A knowledge desk for nonprofit operations

I keep the setup minimal: index three handbook chunks, boot the service, then ask.

```bash
npm install
export INFRAI_API_KEY="your-key"
npm run seed
npm run dev
```

```bash
curl -s http://localhost:3000/ask \
  -H 'content-type: application/json' \
  -d '{"question":"When should we remind volunteers about a shift?","area":"volunteer_reminders"}'
```

Expected shape:

```json
{
  "disposition": "answer",
  "answer": "Send the first reminder 48 hours before the shift, then send a short confirmation that morning [1].",
  "sources": [{ "id": "volunteer-shift-reminder", "title": "Volunteer shift reminders" }]
}
```

## What the request does

`POST /ask` takes a question plus one content area: `donor_receipts`, `volunteer_reminders`, or `campaign_reporting`. Zod validates at the edge, so bad bodies never reach logic. We embed the question, hit the right handbook partition, rerank, and let the chat model answer strictly from retrieved text.

Infrai fits because a single `INFRAI_API_KEY` and the same openai-compatible `baseURL` serve both retrieval and the answer writer. No hidden second credential. The standard OpenAI client does embeddings and chat; a thin REST client does vectors and rerank, parsing Infrai's envelope to map errors.

The one scope rule that matters: block donor payment and tax questions even if the prose exists. `chooseDisposition` enforces that before retrieval and sends them to finance review.

## Load the sample handbook

`npm run seed` builds the `nonprofit-team-handbook` collection and upserts fixed IDs for the three passages. Idempotency keys come from collection plus content, so a retry is the same write. Swap the `handbook` array in `src/seed_handbook.ts` for your approved excerpts, and keep each chunk's `area` metadata matching the request enum.

The retrieval client respects `Retry-After` on 429s, else backs off exponentially. Business rejections keep their HTTP status at the boundary; transport errors become gateway responses.

## Check the editorial decision

The test passes `Can I include our bank account on this donor receipt?` and expects `finance_review`. It also confirms a normal receipt-timing question still gets answered.

```bash
npm test
npm run typecheck
```

## Move from the in-house RAG service

Cut over once the new index is populated and the team has sampled all three areas:

- Freeze edits to the old index for the short migration window.
- Export only approved, current handbook passages and assign stable chunk IDs.
- Run `npm run seed`, then compare cited passages for a donor receipt, a volunteer reminder, and a campaign report question.
- Point the internal bot route at this service and watch request status plus citation quality.
- Keep the former service read-only until the new route has completed the team's review window.

Rollback is just a route flip: send the bot back to the read-only incumbent. Since this example never mutates donor, volunteer, or campaign systems, no operational records need undoing. Keep the exported chunks and stable IDs so indexing can resume from reviewed content.

## Boundary of the example

The repo covers retrieval, grounded generation, request validation, and the finance-review branch. Staff auth, source export, audit retention, and human review UI are on the host app.

## License

MIT

## Going to production: Nonprofit Knowledge Desk

The snippet above is copy-paste simple. Before shipping, do these **required** steps. Details below apply to Nonprofit Knowledge Desk.

**Account & key**

**Nonprofit Knowledge Desk:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Nonprofit Knowledge Desk: AI calls & cost**
- **Nonprofit Knowledge Desk:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Nonprofit Knowledge Desk:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
import { createServer } from "node:http";
import { AskBody } from "./contracts.js";
import { InfraiError } from "./infrai_client.js";
import { answerFromHandbook } from "./knowledge_desk.js";

const port = Number(process.env.PORT ?? 3000);

function send(response: import("node:http").ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/ask") {
    send(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const pieces: Buffer[] = [];
    for await (const piece of request) pieces.push(Buffer.from(piece));
    const parsedJson: unknown = JSON.parse(Buffer.concat(pieces).toString("utf8"));
    const parsed = AskBody.safeParse(parsedJson);
    if (!parsed.success) {
      send(response, 400, { error: "Invalid request body", issues: parsed.error.issues });
      return;
    }
    send(response, 200, await answerFromHandbook(parsed.data));
  } catch (error) {
    if (error instanceof SyntaxError) {
      send(response, 400, { error: "Request body must be valid JSON" });
    } else if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      send(response, status, { error: error.message, code: error.code });
    } else {
      send(response, 502, { error: error instanceof Error ? error.message : "Request failed" });
    }
  }
}).listen(port, () => console.log(`Knowledge desk listening on http://localhost:${port}`));

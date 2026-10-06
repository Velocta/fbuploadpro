import { describe, it, expect } from "vitest";
import worker from "../src/index.js";

describe("Cloudflare Worker Shell", () => {
  it("should respond to GET /health with ok status and worker identifier", async () => {
    const request = new Request("http://localhost/health", { method: "GET" });
    const response = await worker.fetch(request, {}, {} as ExecutionContext);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("application/json");

    const body = await response.json();
    expect(body).toEqual({
      status: "ok",
      worker: "fbuploadpro-worker",
    });
  });

  it("should return 404 for unhandled routes", async () => {
    const request = new Request("http://localhost/unknown", { method: "GET" });
    const response = await worker.fetch(request, {}, {} as ExecutionContext);

    expect(response.status).toBe(404);
  });
});

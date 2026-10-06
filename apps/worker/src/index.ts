export interface Env {}

export const worker = {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return Response.json(
        {
          status: "ok",
          worker: "fbuploadpro-worker",
        },
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};

export default worker;

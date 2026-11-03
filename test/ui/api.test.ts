// @vitest-environment jsdom
import { ApiError, listProposals } from "../../src/ui/api";

afterEach(() => vi.unstubAllGlobals());

test("request throws ApiError with the status and the server's message", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ error: "proposal p_1 is not pending" }, { status: 404 }),
    ),
  );
  const err = await listProposals().catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect(err).toMatchObject({
    status: 404,
    message: "proposal p_1 is not pending",
  });
});

test("without a body error, the message names the method, path, and status", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("", { status: 500 })),
  );
  await expect(listProposals()).rejects.toMatchObject({
    status: 500,
    message: "GET /agent/proposals: 500",
  });
});

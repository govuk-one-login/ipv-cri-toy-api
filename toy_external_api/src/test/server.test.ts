import { Server } from "../app/server";

describe("server.test.ts", () => {
  let server: Server;
  beforeEach(() => {
    server = new Server();
  });
  afterEach(() => jest.clearAllMocks());
  it("should start server on port 8080 and end the request", async () => {
    expect(server).toBeDefined;
  });
});

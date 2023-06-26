import console from "console";
import {
  createServer,
  IncomingMessage,
  Server as NodeServer,
  ServerResponse,
} from "http";

export class Server {
  private server!: NodeServer;

  public async startServer() {
    this.server = createServer(async (req, res) => {
      await this.handleRequest(req, res);
      res.end();
    });
    // const port = 3000;
    // this.server.listen(port, () => {
    //     console.log(`Server is listening on port ${port}`);
    // });
  }
  public async handleRequest(
    request: IncomingMessage,
    response: ServerResponse
  ) {
    try {
      const result = await this.verifyToy(this.getRouteFromUrl(request));

      response.writeHead(result.state, { "Content-Type": "application/json" });
      response.end(
        JSON.stringify({
          state: result.state,
          data: { ...result.data },
        })
      );
    } catch (error) {
      response.writeHead(500, { "Content-Type": "application/json" });
      console.log(error);
    }
  }
  private getRouteFromUrl(request: IncomingMessage) {
    const fullRoute = request.url;

    return request.url && fullRoute?.split("/").slice(-1).find(i=>i);
  }
  private async verifyToy(
    toy?: string
  ): Promise<{ state: number; data: { name: string | undefined } }> {
    console.info("Calling external toy API");

    let state: number;
    const items = toy?.split("-");

    if (items?.length === 2) {
      state = 200;
    } else if (items?.length === 1 || (items && items?.length > 2)) {
      state = 404;
    } else {
        throw new Error("Internal Server Error");
    }

    return Promise.resolve({
      state,
      data: { name: toy },
    });
  }
  public async stopServer() {
    this.server && this.server.close();

    console.log("server closed");
  }
}

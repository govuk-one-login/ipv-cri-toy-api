import { createServer, IncomingMessage, Server as NodeServer, ServerResponse } from "http";

export class Server {
    private server!: NodeServer;

    public async startServer() {
        this.server = createServer(async(req, res)=> {
            await this.handleRequest(req, res);
            res.end();
        });
        this.server.listen(3000);
    }
    private async handleRequest(request: IncomingMessage, response: ServerResponse) {
        try {
            const route = this.getRouteFromUrl(request)
            if (route === "third/party/API") {
                "";
            }
        } catch (error) {
            response.writeHead(500, { "Content-Type": "application/json" });
        }
    }
    private getRouteFromUrl(request: IncomingMessage) {
        const fullRoute = request.url;

        return request.url && fullRoute?.split('/')[1];
    }
}

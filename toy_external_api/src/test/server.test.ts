import { IncomingMessage, ServerResponse } from "http";
import { Server } from "../app/server";
const requestMock = {
    url: '',
    Headers: {
        'user-agent': 'jest-test'
    }
} as unknown as IncomingMessage;
const responseMock = {
    end: jest.fn(),
    writeHead: jest.fn()
} as unknown as ServerResponse;
const serverMock = {
    listen: jest.fn(),
    close: jest.fn()
}
jest.mock('http', () =>({
    createServer: (cb: (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => void) => {
        cb(requestMock, responseMock)
        return serverMock
    }
}))
describe('server.test.ts', () => {
    let server: Server;
    beforeEach(() => {
        server = new Server();
    });
    afterEach(() => jest.clearAllMocks())
    it('should start server on port 8080 and end the request', async() => {
        await server.startServer();

        expect(serverMock.listen).toBeCalledWith(3000);
    });
});
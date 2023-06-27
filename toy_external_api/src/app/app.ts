import console from "console";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from "aws-lambda";
import { Server } from "./server";

let server: Server;

export const startServer = async (
  event: APIGatewayProxyEvent,
  _context: Context
): Promise<APIGatewayProxyResult> => {
  try {
    if (!server) {
      server = new Server();
    }
    const { proxy: path } = event.pathParameters;
    const result = await server.verifyToy(server.getRouteFromUrl(path));
    return {
      statusCode: result.state,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: result.state,
        data: { ...result.data },
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

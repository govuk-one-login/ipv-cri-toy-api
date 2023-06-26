/* istanbul ignore file */
import { LambdaInterface} from "@aws-lambda-powertools/commons";
import { Server } from "./server";
import { APIGatewayProxyEvent, APIGatewayProxyResult, Handler } from "aws-lambda";
import middy from "@middy/core";
class Launcher implements LambdaInterface{
   
    public async handler(
        _event: APIGatewayProxyEvent,
        _context: unknown
      ): Promise<APIGatewayProxyResult> {
        handlerClass.startServer();
        return
      }
    private server = new Server();

    public startServer(){
        this.server.startServer();
    }

    public stopServer(){
        this.server.stopServer();
    }
}

const handlerClass = new Launcher();
export const lambdaHandler: Handler = middy(
    handlerClass.handler.bind(handlerClass)
)
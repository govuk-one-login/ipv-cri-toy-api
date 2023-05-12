import { LambdaInterface } from "@aws-lambda-powertools/commons";
import middy from "@middy/core";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";

export class IssueCredentialLambda implements LambdaInterface {
  public async handler(
    _event: APIGatewayProxyEvent,
    _context: unknown
  ): Promise<APIGatewayProxyResult | { statusCode: number }> {
    return {
      statusCode: 200,
    };
  }
}

const handlerClass = new IssueCredentialLambda();

export const lambdaHandler: Handler = middy(
  handlerClass.handler.bind(handlerClass)
);

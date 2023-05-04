import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

export class AccessTokenLambda implements LambdaInterface {
  public async handler(
    _event: APIGatewayProxyEvent,
    _context: unknown
  ): Promise<APIGatewayProxyResult | { statusCode: number }> {
    return {
      statusCode: 200,
    };
  }
}

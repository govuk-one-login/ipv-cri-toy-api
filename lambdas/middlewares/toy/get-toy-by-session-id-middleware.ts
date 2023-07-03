import { MiddlewareObj, Request } from "@middy/core";
import { ConfigService } from "../../common/config/config-service";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb/dist-types/DynamoDBDocument";
import { GetCommand } from "@aws-sdk/lib-dynamodb";

const defaults = {};

const getToyByIdMiddleware = (opts: {
  configService: ConfigService;
  dynamoDbClient: DynamoDBDocument;
}): MiddlewareObj => {
  const options = { ...defaults, ...opts };

  const before = async (request: Request) => {
    const event = request.event;
    const sessionId = event?.body?.sessionId;
    const parameter = await options.configService.getParameter(
      `/${process.env.AWS_STACK_NAME}/ToyTableName`
    );
    const toy = await options.dynamoDbClient.send(
      new GetCommand({
        TableName: parameter.Value,
        Key: {
          sessionId: sessionId,
        },
      })
    );
    request.event = {
      ...request.event,
      body: {
        ...toy.Item,
      },
    };
    await request.event;
  };
  return {
    before,
  };
};

export default getToyByIdMiddleware;

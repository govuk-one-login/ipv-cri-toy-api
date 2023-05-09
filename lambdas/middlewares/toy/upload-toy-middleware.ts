import { DynamoDBDocument, PutCommand } from "@aws-sdk/lib-dynamodb";
import { MiddlewareObj, Request } from "@middy/core";
import { ConfigService } from "../../common/config/config-service";
import { logger } from "../../common/utils/power-tool";

const defaults = {};

const uploadToyItemMiddleware = (opts: {
  configService: ConfigService;
  dynamoDbClient: DynamoDBDocument;
}): MiddlewareObj => {
  const options = { ...defaults, ...opts };
  const after = async (request: Request) => {
    logger.info("Uploading toy item to dynamoDB table");
    const parameter = await options.configService.getParameter(
      `/${process.env.AWS_STACK_NAME}/ToyTableName`
    );
    const body = request.event.body;
    const putSessionCommand = new PutCommand({
      TableName: parameter.Value as string,
      Item: {
        sessionId: body.sessionId,
        toy: body.toy,
        status: body.status,
        clientId: body.client_id,
        expiryDate: body.expiryDate,
      },
    });
    await options.dynamoDbClient.send(putSessionCommand);

    await request.event;
  };

  return {
    after,
  };
};

export default uploadToyItemMiddleware;

import { MiddlewareObj, Request } from "@middy/core";
import { getAccessToken } from "../../common/utils/request-utils";
import { ConfigService } from "../../common/config/config-service";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb/dist-types/DynamoDBDocument";
import { logger } from "../../common/utils/power-tool";
import { CommonConfigKey } from "../../types/config-keys";
import { SessionNotFoundError } from "../../common/utils/errors";

const defaults = {};

const getSessionByAccessTokenMiddleware = (opts: {
  configService: ConfigService;
  dynamoDbClient: DynamoDBDocument;
}): MiddlewareObj => {
  const options = { ...defaults, ...opts };

  const before = async (request: Request) => {
    logger.info("Get SessionItem by authorizationCode");
    const accessToken = getAccessToken(request.event);
    const sessionItem = await options.dynamoDbClient.query({
      TableName: options.configService.getConfigEntry(
        CommonConfigKey.SESSION_TABLE_NAME
      ),
      IndexName: "access-token-index",
      KeyConditionExpression: "accessToken = :accessToken",
      ExpressionAttributeValues: {
        ":accessToken": accessToken,
      },
    });

    if (!sessionItem?.Items || !sessionItem?.Items?.length) {
      throw new SessionNotFoundError("no session found with that access token");
    } else if (sessionItem?.Items?.length > 1) {
      throw new SessionNotFoundError(
        "more than one session found with that access token"
      );
    } else {
      await (request.event = {
        ...request.event,
        body: {
          ...sessionItem.Items[0],
        },
      });
    }
  };

  return {
    before,
  };
};

export default getSessionByAccessTokenMiddleware;

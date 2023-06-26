import { DynamoDBDocument, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { MiddlewareObj, Request } from "@middy/core";
import { ConfigService } from "../../common/config/config-service";
import { logger } from "../../common/utils/power-tool";
import { CommonConfigKey } from "../../types/config-keys";
import { randomUUID } from "crypto";

const defaults = {};

const createAuthorizationCodeMiddleware = (opts: {
  configService: ConfigService;
  dynamoDbClient: DynamoDBDocument;
}): MiddlewareObj => {
  const options = { ...defaults, ...opts };
  const after = async (request: Request) => {
    const body = request.event.body;
    if (body.status !== "Authenticated") return await request.event;

    logger.info("Updating toy in dynamoDB table with authorizationCode");
    const authorizationCode = randomUUID();
    await options.dynamoDbClient.send(
      new UpdateCommand({
        TableName: options.configService.getConfigEntry(
          CommonConfigKey.SESSION_TABLE_NAME
        ),
        Key: { sessionId: body.sessionId },
        UpdateExpression:
          "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
        ExpressionAttributeValues: {
          ":authCode": authorizationCode,
          ":authCodeExpiry": getAuthorizationCodeExpirationEpoch(),
        },
      })
    );
    await request.event;
  };

  return {
    after,
  };
};

function getAuthorizationCodeExpirationEpoch() {
  const DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS = 600;
  const envAuthCodeTtl =
    parseInt(process.env.AUTHORIZATION_CODE_TTL as string, 10) ||
    DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS;
  const authorizationCodeTtlInMillis = envAuthCodeTtl * 1000;
  const currentTimestampInMillis = Date.now();
  const expirationTimestampInSeconds = Math.floor(
    (currentTimestampInMillis + authorizationCodeTtlInMillis) / 1000
  );
  return expirationTimestampInSeconds;
}

export default createAuthorizationCodeMiddleware;

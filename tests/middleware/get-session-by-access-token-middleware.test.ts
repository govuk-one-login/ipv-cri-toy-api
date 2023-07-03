import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { ConfigService } from "../../lambdas/common/config/config-service";
import getSessionByAccessTokenMiddleware from "../../lambdas/middlewares/session/get-session-by-access-token-middleware";
import { Request } from "@middy/core";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/lib-dynamodb"),
  QueryCommandInput: jest.fn(),
}));
describe("get-session-by-access-token-middleware.ts", () => {
  let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
  let configService: jest.MockedObjectDeep<typeof ConfigService>;

  beforeEach(() => {
    dynamoDbClient = jest.mocked(DynamoDBDocument);
    configService = jest.mocked(ConfigService);

    jest
      .spyOn(configService.prototype, "getConfigEntry")
      .mockReturnValue("sessionTable");
  });
  describe("query succeeds", () => {
    it("should retrieve the SessionItem using a valid accesstoken", async () => {
      const tableName = "sessionTable";
      const accessToken = "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o";
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "query")
        .mockImplementation(() =>
          Promise.resolve({
            Items: [
              {
                sessionId: "session-id",
                clientId: "client-id",
                clientSessionId: "client-session-id",
                authorizationCodeExpiryDate: 0,
                redirectUri: "redirect-uri",
                accessToken,
                accessTokenExpiryDate: 0,
              },
            ],
          })
        );
      const middleware = getSessionByAccessTokenMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      const mockRequest: Request = {
        event: {
          headers: {
            Authorization: "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
          },
        },
      } as unknown as Request;

      middleware?.before && (await middleware.before(mockRequest));

      expect(dbSpy).toHaveBeenCalledTimes(1);
      expect(dynamoDbClient.prototype.query).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: { ":accessToken": accessToken },
          IndexName: "access-token-index",
          KeyConditionExpression: "accessToken = :accessToken",
          TableName: tableName,
        })
      );
    });
  });

  describe("query fails", () => {
    it.each([null, []])(
      "should return 'no session found with that access token' when query using accesstoken results in null or an empty record",
      async (items) => {
        const tableName = "sessionTable";
        const accessToken =
          "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o";
        const dbSpy = jest
          .spyOn(dynamoDbClient.prototype, "query")
          .mockImplementation(() =>
            Promise.resolve({
              Items: items,
            })
          );
        const middleware = getSessionByAccessTokenMiddleware({
          configService: configService.prototype,
          dynamoDbClient: dynamoDbClient.prototype,
        });
        const mockRequest: Request = {
          event: {
            headers: {
              Authorization:
                "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
            },
          },
        } as unknown as Request;

        expect(
          async () =>
            middleware?.before && (await middleware.before(mockRequest))
        ).rejects.toThrow("no session found with that access token");
        expect(dbSpy).toHaveBeenCalledTimes(1);
        expect(dynamoDbClient.prototype.query).toHaveBeenLastCalledWith(
          expect.objectContaining({
            ExpressionAttributeValues: { ":accessToken": accessToken },
            IndexName: "access-token-index",
            KeyConditionExpression: "accessToken = :accessToken",
            TableName: tableName,
          })
        );
      }
    );
    it("should return 'more than one session found with that access token' when query using accesstoken results in multiple records", async () => {
      const tableName = "sessionTable";
      const accessToken = "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o";
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "query")
        .mockImplementation(() =>
          Promise.resolve({
            Items: [
              {
                sessionId: "session-id",
                clientId: "client-id",
                clientSessionId: "client-session-id",
                redirectUri: "redirect-uri",
                accessToken,
              },
              {
                sessionId: "a-session-id",
                clientId: "client-id",
                clientSessionId: "client-session-id",
                redirectUri: "redirect-uri",
                accessToken,
              },
            ],
          })
        );
      const middleware = getSessionByAccessTokenMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      const mockRequest: Request = {
        event: {
          headers: {
            Authorization: "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
          },
        },
      } as unknown as Request;

      expect(
        async () => middleware?.before && (await middleware.before(mockRequest))
      ).rejects.toThrow("more than one session found with that access token");
      expect(dbSpy).toHaveBeenCalledTimes(1);
      expect(dynamoDbClient.prototype.query).toHaveBeenLastCalledWith(
        expect.objectContaining({
          ExpressionAttributeValues: { ":accessToken": accessToken },
          IndexName: "access-token-index",
          KeyConditionExpression: "accessToken = :accessToken",
          TableName: tableName,
        })
      );
    });
  });
});

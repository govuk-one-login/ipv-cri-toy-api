import { DynamoDBDocument, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ConfigService } from "../../lambdas/common/config/config-service";
import { Request } from "@middy/core";
import createAuthorizationCodeMiddleware from "../../lambdas/middlewares/session/create-authorization-code-middleware";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/lib-dynamodb"),
  UpdateCommand: jest.fn(),
}));
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: () => "d7c05e44-37e6-4ed4-b6d3-01af51a95f84",
}));
describe("create-authorization-code-middleware.ts", () => {
  let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
  let updateCommand: jest.MockedObjectDeep<typeof UpdateCommand>;
  let configService: jest.MockedObjectDeep<typeof ConfigService>;

  const expiryDate = Math.floor(Date.now() / 1000);
  const aRandomUUID = "d7c05e44-37e6-4ed4-b6d3-01af51a95f84";
  const sessionId = "6b0f3490-db8b-4803-967d-39d77a2ece21";

  beforeEach(() => {
    dynamoDbClient = jest.mocked(DynamoDBDocument);
    updateCommand = jest.mocked(UpdateCommand);
    configService = jest.mocked(ConfigService);

    jest
      .spyOn(configService.prototype, "getConfigEntry")
      .mockReturnValue("sessionTable");
  });
  afterEach(() => jest.clearAllMocks());

  describe("event containing status of authenticated", () => {
    const mockEvent = {
      event: {
        body: {
          sessionId,
          expiryDate,
          status: "Authenticated",
        },
      },
    };

    it("should update the session item with authCode", async () => {
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "send")
        .mockImplementation();
      const middleware = createAuthorizationCodeMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      if (middleware?.after) {
        await middleware.after(mockEvent as Request<unknown>);
        expect(dbSpy).toHaveBeenCalledTimes(1);
        expect(updateCommand).toHaveBeenCalledWith({
          TableName: "sessionTable",
          Key: { sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21" },
          UpdateExpression:
            "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
          ExpressionAttributeValues: {
            ":authCode": aRandomUUID,
            ":authCodeExpiry": expect.any(Number),
          },
        });
      }
      expect.assertions(2);
    });

    it("should update sessionItem using default ttl for authCode expiry", async () => {
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "send")
        .mockImplementation();
      const timestampInMillisOf26Jun20230906 = 1687766800499;
      const expectedExpiryIn10minsTime = 1687767400;
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(timestampInMillisOf26Jun20230906);
      const middleware = createAuthorizationCodeMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      if (middleware?.after) {
        await middleware.after(mockEvent as Request<unknown>);
        expect(dbSpy).toHaveBeenCalledTimes(1);
        expect(updateCommand).toHaveBeenCalledWith({
          TableName: "sessionTable",
          Key: { sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21" },
          UpdateExpression:
            "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
          ExpressionAttributeValues: {
            ":authCode": aRandomUUID,
            ":authCodeExpiry": expectedExpiryIn10minsTime,
          },
        });
      }
      expect.assertions(2);
    });
    it("should update sessionItem using env AUTHORIZATION_CODE_TTL for authCode expiry", async () => {
      process.env = {
        ...process.env,
        AUTHORIZATION_CODE_TTL: "20",
      };
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "send")
        .mockImplementation();
      const timestampInMillisOf26Jun20230906 = 1687766800499;
      const expectedExpiryIn20minsTime = 1687766820;
      jest
        .spyOn(Date, "now")
        .mockReturnValueOnce(timestampInMillisOf26Jun20230906);
      const middleware = createAuthorizationCodeMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      if (middleware?.after) {
        await middleware.after(mockEvent as Request<unknown>);
        expect(dbSpy).toHaveBeenCalledTimes(1);
        expect(updateCommand).toHaveBeenCalledWith({
          TableName: "sessionTable",
          Key: { sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21" },
          UpdateExpression:
            "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
          ExpressionAttributeValues: {
            ":authCode": aRandomUUID,
            ":authCodeExpiry": expectedExpiryIn20minsTime,
          },
        });
      }
      expect.assertions(2);
    });
  });
  describe("event containing status of Not Authenticated", () => {
    const mockEvent = {
      event: {
        body: {
          sessionId,
          expiryDate,
          status: "Not Authenticated",
        },
      },
    };
    it("should upload the toy item to dynamo", async () => {
      const dbSpy = jest
        .spyOn(dynamoDbClient.prototype, "send")
        .mockImplementation();
      const middleware = createAuthorizationCodeMiddleware({
        configService: configService.prototype,
        dynamoDbClient: dynamoDbClient.prototype,
      });
      if (middleware?.after) {
        await middleware.after(mockEvent as Request<unknown>);
        expect(dbSpy).not.toHaveBeenCalledTimes(1);
        expect(updateCommand).not.toHaveBeenCalledWith({
          TableName: "sessionTable",
          Key: { sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21" },
          UpdateExpression:
            "SET authorizationCode=:authCode, authorizationCodeExpiryDate=:authCodeExpiry",
          ExpressionAttributeValues: {
            ":authCode": aRandomUUID,
            ":authCodeExpiry": expect.any(Number),
          },
        });
      }
      expect.assertions(2);
    });
  });
});

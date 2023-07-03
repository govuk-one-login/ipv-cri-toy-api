import { DynamoDBDocument, GetCommand } from "@aws-sdk/lib-dynamodb";
import { ConfigService } from "../../lambdas/common/config/config-service";
import getToyByIdMiddleware from "../../lambdas/middlewares/toy/get-toy-by-session-id-middleware";
import { Request } from "@middy/core";

jest.mock("@aws-sdk/lib-dynamodb", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/lib-dynamodb"),
  GetCommand: jest.fn(),
}));
describe("get-toy-by-id-middleware.ts", () => {
  let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
  let getCommand: jest.MockedObjectDeep<typeof GetCommand>;
  let configService: jest.MockedObjectDeep<typeof ConfigService>;

  beforeEach(() => {
    dynamoDbClient = jest.mocked(DynamoDBDocument);
    getCommand = jest.mocked(GetCommand);
    configService = jest.mocked(ConfigService);

    jest.spyOn(configService.prototype, "getParameter").mockReturnValueOnce({
      Value: "/toy-cri-v1/ToyTableName",
    });
  });
  afterEach(() => jest.clearAllMocks());
  it("should retrieve a toy item", async () => {
    const sessionId = "6b0f3490-db8b-4803-967d-39d77a2ece21";
    const toyItem = {
      sessionId,
      status: "Authenticated",
      toy: "jigsaw-puzzle",
      client_id: "toy-cri",
    };
    const mockRequest: Request = {
      event: {
        headers: {
          Authorization: "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
        },
        body: toyItem,
      },
    } as unknown as Request;
    const dbSpy = jest
      .spyOn(dynamoDbClient.prototype, "send")
      .mockImplementation(() =>
        Promise.resolve({
          Item: toyItem,
        })
      );
    const middleware = getToyByIdMiddleware({
      configService: configService.prototype,
      dynamoDbClient: dynamoDbClient.prototype,
    });
    middleware?.before && (await middleware.before(mockRequest));

    expect(dbSpy).toHaveBeenCalledTimes(1);
    expect(getCommand).toHaveBeenCalledWith({
      TableName: "/toy-cri-v1/ToyTableName",
      Key: { sessionId },
    });
  });
});

import { DynamoDBDocument, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ConfigService } from "../../lambdas/common/config/config-service";
import { Request } from "@middy/core";
import saveToyMiddleware from "../../lambdas/middlewares/toy/save-toy-middleware";

jest.mock("@aws-sdk/lib-dynamodb", () => {
    const mockPut = jest.fn();
    mockPut.mockImplementation(() => {
      return {
        input: {
          Item: {
            sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21",
            toy: "jigsaw-puzzle",
            status: "Authenticated",
          },
        },
      };
    });
    return {
      __esModule: true,
      ...jest.requireActual("@aws-sdk/lib-dynamodb"),
      PutCommand: mockPut,
    };
  }); //  this is so we only mock out the PutCommand
describe("save-toy-middleware.ts", () => {
    let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
    let putCommand: jest.MockedObjectDeep<typeof PutCommand>;
    let configService: jest.MockedObjectDeep<typeof ConfigService>;

    const expiryDate = Math.floor(Date.now() / 1000);

    const mockEvent = {
        event: {
            body: {
                sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21",
                status: "Authenticated",
                toy: "jigsaw-puzzle",
                client_id: "toy-cri",
                expiryDate: expiryDate
            }
        }
    };

    beforeEach(() => {
        dynamoDbClient = jest.mocked(DynamoDBDocument);
        putCommand = jest.mocked(PutCommand);
        configService = jest.mocked(ConfigService);

        jest.spyOn(configService.prototype, "getParameter").mockReturnValue({
            Value: "/toy-cri-v1/ToyTableName",
        });
    });

    it("should upload the toy item to dynamo", async () => {
        const dbSpy = jest
          .spyOn(dynamoDbClient.prototype, "send")
          .mockImplementation();
        const middleware = saveToyMiddleware({
            configService: configService.prototype,
            dynamoDbClient: dynamoDbClient.prototype
        });
        if (middleware && middleware.after) {
            await middleware.after(mockEvent as Request<any>);
            expect(dbSpy).toHaveBeenCalledTimes(1);
            expect(putCommand).toHaveBeenCalledWith({
              TableName: "/toy-cri-v1/ToyTableName",
              Item: {
                sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21",
                clientId: "toy-cri",
                expiryDate: expiryDate,
                status: "Authenticated",
                toy: "jigsaw-puzzle",
              },
            });
        }
        expect.assertions(2);
      });
})
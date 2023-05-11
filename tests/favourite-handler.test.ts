import { injectLambdaContext, Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import { DynamoDBDocument, PutCommand } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyEventHeaders,
  Context,
} from "aws-lambda";
import { ConfigService } from "../lambdas/common/config/config-service";
import { FavouriteLambda } from "../lambdas/favourite/src/favourite-handler";
import initialiseConfigMiddleware from "../lambdas/middlewares/config/initialise-config-middleware";
import errorMiddleware from "../lambdas/middlewares/error/error-middleware";
import getSessionByIdMiddleware from "../lambdas/middlewares/session/get-session-by-id-middleware";
import setGovUkSigningJourneyIdMiddleware from "../lambdas/middlewares/session/set-gov-uk-signing-journey-id-middleware";
import saveToyMiddleware from "../lambdas/middlewares/toy/save-toy-middleware";
import { SessionService } from "../lambdas/services/session-service";
import { CommonConfigKey } from "../lambdas/types/config-keys";

jest.mock("@aws-sdk/lib-dynamodb", () => {
  const mockPut = jest.fn();
  mockPut.mockImplementation(() => {
    return {
      input: {
        Item: {
          sessionId: "test-session-id",
          toy: "marbles",
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
describe("favourite-handler.ts", () => {
  let favouriteLambda: FavouriteLambda;
  let lambdaHandler: middy.MiddyfiedHandler;
  let logger: jest.MockedObjectDeep<typeof Logger>;
  let metrics: jest.MockedObjectDeep<typeof Metrics>;
  let configService: jest.MockedObjectDeep<typeof ConfigService>;
  let sessionService: jest.MockedObjectDeep<typeof SessionService>;
  let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
  let putCommand: jest.MockedObjectDeep<typeof PutCommand>;

  const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;

  const mockEvent = {
    body: JSON.stringify({
      client_id: "toy-cri",
      toy: "marbles",
    }),
    headers: {
      ["x-forwarded-for"]: "test-client-ip-address",
      ["session-id"]: "6b0f3490-db8b-4803-967d-39d77a2ece21",
    } as APIGatewayProxyEventHeaders,
  } as APIGatewayProxyEvent;

  const getMockFetch = (code?: number) => {
    return jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            toy: "marbles",
          }),
        status: code ? code : 200,
      } as Response)
    );
  };

  beforeEach(() => {
    logger = jest.mocked(Logger);
    metrics = jest.mocked(Metrics);
    configService = jest.mocked(ConfigService);
    sessionService = jest.mocked(SessionService);
    dynamoDbClient = jest.mocked(DynamoDBDocument);
    putCommand = jest.mocked(PutCommand);

    favouriteLambda = new FavouriteLambda();

    lambdaHandler = middy(favouriteLambda.handler.bind(favouriteLambda))
      .use(
        errorMiddleware(logger.prototype, metrics.prototype, {
          metric_name: "favourite_selected",
          message: "Favourite lambda error occurred",
        })
      )
      .use(injectLambdaContext(logger.prototype, { clearState: true }))
      .use(
        initialiseConfigMiddleware({
          configService: configService.prototype,
          config_keys: [CommonConfigKey.SESSION_TABLE_NAME],
        })
      )
      .use(
        getSessionByIdMiddleware({ sessionService: sessionService.prototype })
      )
      .use(
        saveToyMiddleware({
          configService: configService.prototype,
          dynamoDbClient: dynamoDbClient.prototype,
        })
      )
      .use(setGovUkSigningJourneyIdMiddleware(logger.prototype));

    jest.spyOn(configService.prototype, "init").mockImplementation();
    jest.spyOn(configService.prototype, "getParameter").mockReturnValue({
      Value: "/toy-cri-v1/ToyTableName",
    });
    jest.spyOn(sessionService.prototype, "getSession").mockReturnValue({
      sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21",
      expiryDate: Math.floor(Date.now() / 1000) + WEEK_IN_SECONDS,
    });
    jest.spyOn(metrics.prototype, "addMetric").mockImplementation();
    jest.spyOn(logger.prototype, "error").mockImplementation();
    jest.spyOn(dynamoDbClient.prototype, "send").mockImplementation();

    global.fetch = getMockFetch();
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = getMockFetch();
  });

  it("should return a status code of 200", async () => {
    const response = await lambdaHandler(mockEvent, {} as Context);
    expect(response.statusCode).toBe(200);
  });

  it("should check the toy against the external API", async () => {
    const mockFetch = getMockFetch();
    global.fetch = mockFetch;
    const response = await lambdaHandler(mockEvent, {} as Context);
    expect(mockFetch).toHaveBeenCalledWith("third/party/API/marbles", {
      method: "GET",
    });
    expect(response.statusCode).toEqual(200);
  });

  it("should error if the session has expired", async () => {
    jest.spyOn(sessionService.prototype, "getSession").mockReturnValue({
      sessionId: "6b0f3490-db8b-4803-967d-39d77a2ece21",
      expiryDate: Math.floor(Date.now() / 1000) - WEEK_IN_SECONDS,
    });
    const response = await lambdaHandler(mockEvent, {} as Context);
    const errorBody = JSON.parse(response.body);
    expect(response.statusCode).toBe(403);
    expect(errorBody.message).toBe("Session expired");
  });

  it("should error if the external toy API does not accept the toy", async () => {
    global.fetch = getMockFetch(404);
    const response = await lambdaHandler(mockEvent, {} as Context);
    const errorBody = JSON.parse(response.body);
    expect(response.statusCode).toBe(404);
    expect(errorBody.message).toBe("Toy not found: marbles");
  });
});

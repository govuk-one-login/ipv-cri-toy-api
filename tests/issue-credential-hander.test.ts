import { injectLambdaContext, Logger } from "@aws-lambda-powertools/logger";
import { Metrics } from "@aws-lambda-powertools/metrics";
import errorMiddleware from "../lambdas/middlewares/error/error-middleware";
import validateHeaderBearerTokenMiddleware from "../lambdas/middlewares/validate-header-bearer-token-middleware";
import getSessionByAccessTokenMiddleware from "../lambdas/middlewares/session/get-session-by-access-token-middleware";
import middy from "@middy/core";
import { IssueCredentialLambda } from "../lambdas/issue-credential/src/issue-credential-handler";
import setGovUkSigningJourneyIdMiddleware from "../lambdas/middlewares/session/set-gov-uk-signing-journey-id-middleware";
import getToyByIdMiddleware from "../lambdas/middlewares/toy/get-toy-by-session-id-middleware";
import { ConfigService } from "../lambdas/common/config/config-service";
import { APIGatewayProxyEvent, Context } from "aws-lambda";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import initialiseConfigMiddleware from "../lambdas/middlewares/config/initialise-config-middleware";
import { CommonConfigKey } from "../lambdas/types/config-keys";
import { ParameterType, SSMClient } from "@aws-sdk/client-ssm";
jest.mock("@aws-sdk/client-ssm", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/client-ssm"),
  GetParameterCommand: jest.fn(),
}));
jest.mock("@aws-sdk/lib-dynamodb", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/lib-dynamodb"),
  GetCommand: jest.fn(),
  QueryCommandInput: jest.fn(),
}));
describe("issue-credential-handler.ts", () => {
  let logger: jest.MockedObjectDeep<typeof Logger>;
  let metrics: jest.MockedObjectDeep<typeof Metrics>;
  let dynamoDbClient: jest.MockedObjectDeep<typeof DynamoDBDocument>;
  let mockSSMClient: jest.MockedObjectDeep<typeof SSMClient>;

  let configService: jest.MockedObjectDeep<typeof ConfigService>;
  let lambdaHandler: middy.MiddyfiedHandler;
  let mockEvent: APIGatewayProxyEvent;

  const issueCredentialLambda = new IssueCredentialLambda();
  const TOY_CREDENTIAL_ISSUER = "toy_credential_issuer";
  const mockMap = new Map<string, string>();
  const sessionItem = {
    client_id: "toy-cri",
    toy: "marble-race",
    status: "Authenticated",
  };
  beforeEach(() => {
    mockMap.set("test-client-id", "test-config-value");
    dynamoDbClient = jest.mocked(DynamoDBDocument);
    mockSSMClient = jest.mocked(SSMClient);
    configService = jest.mocked(ConfigService);
    logger = jest.mocked(Logger);
    metrics = jest.mocked(Metrics);
    lambdaHandler = middy(
      issueCredentialLambda.handler.bind(issueCredentialLambda)
    )
      .use(
        errorMiddleware(logger.prototype, metrics.prototype, {
          metric_name: TOY_CREDENTIAL_ISSUER,
          message: "Toy lambda error occurred",
        })
      )
      .use(injectLambdaContext(logger.prototype, { clearState: true }))
      .use(
        initialiseConfigMiddleware({
          configService: configService.prototype,
          config_keys: [CommonConfigKey.SESSION_TABLE_NAME],
        })
      )
      .use(validateHeaderBearerTokenMiddleware())
      .use(
        getSessionByAccessTokenMiddleware({
          configService: configService.prototype,
          dynamoDbClient: dynamoDbClient.prototype,
        })
      )
      .use(
        getToyByIdMiddleware({
          configService: configService.prototype,
          dynamoDbClient: dynamoDbClient.prototype,
        })
      )
      .use(setGovUkSigningJourneyIdMiddleware(logger.prototype));

    jest.spyOn(metrics.prototype, "addMetric").mockImplementation();
    jest.spyOn(logger.prototype, "error").mockImplementation();
    jest
      .spyOn(configService.prototype, "init")
      .mockImplementation(() => new Promise<void>((res) => res()));

    jest
      .spyOn(configService.prototype, "getConfigEntry")
      .mockReturnValue(mockMap);

    const impl = () =>
      jest.fn().mockImplementation(() => Promise.resolve({ Parameters: [] }));

    dynamoDbClient.prototype.query = impl();
    dynamoDbClient.prototype.send = impl();
    mockSSMClient.prototype.send = impl();

    jest.spyOn(configService.prototype, "getParameter").mockReturnValueOnce({
      Value: "/toy-cri-v1/ToyTableName",
    });
  });

  afterEach(() => jest.resetAllMocks());

  describe("authorization valid, verifiable credential issued", () => {
    beforeEach(() => {
      mockEvent = {
        body: JSON.stringify(sessionItem),
        headers: {
          ["x-forwarded-for"]: "test-client-ip-address",
          ["session-id"]: "6b0f3490-db8b-4803-967d-39d77a2ece21",
          ["authorization"]:
            "Bearer am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
        },
      } as unknown as APIGatewayProxyEvent;
      dynamoDbClient.prototype.send.mockImplementationOnce(() =>
        Promise.resolve({ Item: sessionItem })
      );
      dynamoDbClient.prototype.query.mockImplementationOnce(() =>
        Promise.resolve({
          Items: [sessionItem],
        })
      );
      [
        {
          name: "/di-ipv-cri-toy-api/release-flags/vc-contains-unique-id",
          value: true,
        },
        {
          name: "/di-ipv-cri-toy-api/release-flags/vc-expiry-removed",
          value: true,
        },
        {
          name: "/di-ipv-cri-toy-api/verifiable-credential/issuer",
          value: true,
        },
      ].forEach((param) =>
        mockSSMClient.prototype.send.mockImplementationOnce(() =>
          Promise.resolve({
            Parameter: {
              Name: param.name,
              Type: ParameterType.STRING,
              Value: param.value,
            },
          })
        )
      );
    });
    it("should return a statuscode of 200", async () => {
      const response = await lambdaHandler(mockEvent, {} as Context);

      expect(response.statusCode).toBe(200);
      expect(dynamoDbClient.prototype.query).toHaveBeenCalledTimes(1);
      expect(dynamoDbClient.prototype.send).toHaveBeenCalledTimes(1);
      expect(mockSSMClient.prototype.send).toHaveBeenCalledTimes(4);
    });
  });
  describe("authorization absent, unable to issue veriable credential", () => {
    beforeEach(() => {
      mockEvent = {
        body: JSON.stringify(sessionItem),
        headers: {
          ["x-forwarded-for"]: "test-client-ip-address",
          ["session-id"]: "6b0f3490-db8b-4803-967d-39d77a2ece21",
          ["authorization"]: "Bearer",
        },
      } as unknown as APIGatewayProxyEvent;
    });
    it("should return a statuscode of 400", async () => {
      const response = await lambdaHandler(mockEvent, {} as Context);

      expect(response.statusCode).toBe(400);
      expect(dynamoDbClient.prototype.query).not.toHaveBeenCalledTimes(1);
      expect(dynamoDbClient.prototype.send).not.toHaveBeenCalledTimes(1);
      expect(mockSSMClient.prototype.send).not.toHaveBeenCalledTimes(4);
    });
  });
});

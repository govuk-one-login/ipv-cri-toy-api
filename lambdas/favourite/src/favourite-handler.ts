import { LambdaInterface } from "@aws-lambda-powertools/commons";
import { injectLambdaContext } from "@aws-lambda-powertools/logger";
import { SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import middy from "@middy/core";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import { AwsClientType, createClient } from "../../common/aws-client-factory";
import { ConfigService } from "../../common/config/config-service";
import {
  ToyNotFoundError,
  SessionExpiredError,
} from "../../common/utils/errors";
import { logger, metrics } from "../../common/utils/power-tool";
import initialiseConfigMiddleware from "../../middlewares/config/initialise-config-middleware";
import errorMiddleware from "../../middlewares/error/error-middleware";
import getSessionByIdMiddleware from "../../middlewares/session/get-session-by-id-middleware";
import setGovUkSigningJourneyIdMiddleware from "../../middlewares/session/set-gov-uk-signing-journey-id-middleware";
import saveToyMiddleware from "../../middlewares/toy/save-toy-middleware";
import { SessionService } from "../../services/session-service";
import { CommonConfigKey } from "../../types/config-keys";
import { SessionItem } from "../../types/session-item";
import { ToyItem } from "../../types/toy";
import createAuthorizationCodeMiddleware from "../../middlewares/session/create-authorization-code-middleware";
import { AuditService } from "../../common/services/audit-service";
import { SQSClient } from "@aws-sdk/client-sqs";
import { AuditEventContext, AuditEventType } from "../../types/audit-event";

const dynamoDbClient = createClient(AwsClientType.DYNAMO) as DynamoDBDocument;
const ssmClient = createClient(AwsClientType.SSM) as SSMClient;
const sqsClient = createClient(AwsClientType.SQS) as SQSClient;
const FAVOURITE_METRIC = "favourite_selected";
const TOY_API_URL = process.env.TOY_API_URL;

export class FavouriteLambda implements LambdaInterface {
  constructor(
    private readonly auditService: AuditService,
  ) {}

  public async handler(
    event: APIGatewayProxyEvent,
    _context: unknown
  ): Promise<APIGatewayProxyResult | undefined> {
    logger.info("Favourite lambda triggered");
    const sessionItem = event.body as unknown as SessionItem;
    const toyBody = event.body as unknown as ToyItem;
    if (sessionService.hasDateExpired(sessionItem.expiryDate)) {
      throw new SessionExpiredError();
    }

    const auditEventContext = this.createAuditEventContext(sessionItem);

    await this.auditService.sendAuditEvent(AuditEventType.REQUEST_SENT, auditEventContext);
    const response = await this.callExternalToy(toyBody.toy);
    await this.auditService.sendAuditEvent(AuditEventType.THIRD_PARTY_REQUEST_ENDED, auditEventContext);

    if (response.status !== 200) {
      throw new ToyNotFoundError(toyBody.toy);
    }

    toyBody.sessionId = sessionItem.sessionId;
    toyBody.status =
      response.status === 200 ? "Authenticated" : "Not Authenticated";

    return {
      statusCode: response.status,
      body: JSON.stringify({
        ...toyBody,
        ...sessionItem,
      }),
    };
  }

  private async callExternalToy(toy: string): Promise<Response> {
    logger.info("Calling external toy API");
    return fetch(TOY_API_URL + "/" + toy, {
      method: "GET",
    });
  }

  private createAuditEventContext(sessionItem: SessionItem): AuditEventContext {
    return {
      sessionItem: {
        sessionId: sessionItem.sessionId,
        subject: sessionItem.subject,
        persistentSessionId: sessionItem.persistentSessionId,
        clientSessionId: sessionItem.clientSessionId
      },
      clientIpAddress: sessionItem.clientIpAddress
    };
  }
}


const configService = new ConfigService(ssmClient);
const auditService = new AuditService(() => configService.getAuditConfig(), sqsClient);
const sessionService = new SessionService(dynamoDbClient, configService);

const handlerClass = new FavouriteLambda(auditService);

export const lambdaHandler: Handler = middy(
  handlerClass.handler.bind(handlerClass)
)
  .use(
    errorMiddleware(logger, metrics, {
      metric_name: FAVOURITE_METRIC,
      message: "Favourite lambda error occurred",
    })
  )
  .use(injectLambdaContext(logger, { clearState: true }))
  .use(
    initialiseConfigMiddleware({
      configService: configService,
      config_keys: [CommonConfigKey.SESSION_TABLE_NAME, CommonConfigKey.VC_ISSUER],
    })
  )
  .use(getSessionByIdMiddleware({ sessionService: sessionService }))
  .use(
    saveToyMiddleware({
      configService: configService,
      dynamoDbClient: dynamoDbClient,
    })
  )
  .use(
    createAuthorizationCodeMiddleware({
      configService: configService,
      dynamoDbClient: dynamoDbClient,
    })
  )
  .use(setGovUkSigningJourneyIdMiddleware(logger));

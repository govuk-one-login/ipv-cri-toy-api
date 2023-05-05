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
import { logger, metrics } from "../../common/utils/power-tool";
import initialiseConfigMiddleware from "../../middlewares/config/initialise-config-middleware";
import errorMiddleware from "../../middlewares/error/error-middleware";
import getSessionByIdMiddleware from "../../middlewares/session/get-session-by-id-middleware";
import setGovUkSigningJourneyIdMiddleware from "../../middlewares/session/set-gov-uk-signing-journey-id-middleware";
import uploadToyItemMiddleware from "../../middlewares/toy/upload-toy-middleware";
import { SessionService } from "../../services/session-service";
import { CommonConfigKey } from "../../types/config-keys";
import { SessionItem } from "../../types/session-item";
import { ToyItem } from "../../types/toy";

const dynamoDbClient = createClient(AwsClientType.DYNAMO) as DynamoDBDocument;
const ssmClient = createClient(AwsClientType.SSM) as SSMClient;
const FAVOURITE_METRIC = "favourite_selected";
const TOY_API_URL = process.env.TOY_API_URL;

export class FavouriteLambda implements LambdaInterface {
  public async handler(
    event: APIGatewayProxyEvent,
    _context: unknown
  ): Promise<APIGatewayProxyResult | { statusCode: number }> {
    logger.info("Favourite lambda triggered");
    const sessionItem = event.body as unknown as SessionItem;
    const toyBody = event.body as unknown as { toy: string };

    if (sessionService.hasDateExpired(sessionItem.expiryDate)) {
      throw new Error("Session expired");
    }

    const response = await this.callExternalToy(toyBody.toy);

    if (response.status != 200) {
      throw new Error("Invalid toy" + response.json());
    }

    const toyItem = this.createToyItem(
      sessionItem.sessionId,
      toyBody.toy,
      response.status == 200
    );

    return {
      statusCode: response.status,
      body: JSON.stringify(toyItem),
    };
  }

  private createToyItem(
    sessionId: string,
    toy: string,
    success: boolean
  ): ToyItem {
    return {
      sessionId: sessionId,
      status: success ? "Authenticated" : "Not authenticated",
      toy: toy,
    };
  }

  private async callExternalToy(toy: string) {
    logger.info("Calling external toy API");
    return await fetch(TOY_API_URL + "/" + toy, {
      method: "GET",
    });
  }
}

const handlerClass = new FavouriteLambda();
const configService = new ConfigService(ssmClient);
const sessionService = new SessionService(dynamoDbClient, configService);

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
      config_keys: [CommonConfigKey.SESSION_TABLE_NAME],
    })
  )
  .use(getSessionByIdMiddleware({ sessionService: sessionService }))
  .use(
    uploadToyItemMiddleware({
      configService: configService,
      dynamoDbClient: dynamoDbClient,
    })
  )
  .use(setGovUkSigningJourneyIdMiddleware(logger));

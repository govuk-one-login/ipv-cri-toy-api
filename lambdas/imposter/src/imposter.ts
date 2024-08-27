import { Logger } from "@aws-lambda-powertools/logger";
import { LambdaInterface } from "@aws-lambda-powertools/commons";

export const logger = new Logger();

export class Imposter implements LambdaInterface {
  public async handler(
    _event: unknown,
    _context: unknown
  ): Promise<{ status: string; body: string }> {
    try {
      const response = await fetch(
        "https://26okyhxy99-vpce-0a8ca9408deb89aa8.execute-api.eu-west-2.amazonaws.com/build/individuals/authentication/authenticator/api/match",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer goodToken",
          },
          body: JSON.stringify({
            firstName: "Jim",
            lastName: "Ferguson",
            dateOfBirth: "1970-01-01",
            nino: "AA000003D",
          }),
        }
      );
      return {
        status: response.status.toString(),
        body: await response.json(),
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({
        message: `Error occurred: ${message}`,
      });
      throw error;
    }
  }
}

const handlerClass = new Imposter();
export const lambdaHandler = handlerClass.handler.bind(handlerClass);

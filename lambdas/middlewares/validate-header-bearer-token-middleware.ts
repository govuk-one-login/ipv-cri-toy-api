import { MiddlewareObj, Request } from "@middy/core";
import { APIGatewayProxyEvent } from "aws-lambda";
import { getAccessToken } from "../../lambdas/common/utils/request-utils";
import { Buffer } from "buffer";
import { InvalidRequestError } from "../common/utils/errors";

const validateHeaderBearerTokenMiddleware = (): MiddlewareObj => {
  const before = async (request: Request) => {
    const event = request.event as APIGatewayProxyEvent;
    validateInputHeaderBearerToken(event);
  };

  return {
    before,
  };
};

const validateInputHeaderBearerToken = (event: APIGatewayProxyEvent) => {
  const authorizationHeader = getAccessToken(event);

  if (!authorizationHeader) {
    throw new InvalidRequestError(
      "Invalid request: Missing authorization header"
    );
  }

  validateBearerToken(authorizationHeader);
};

const validateBearerToken = (token: string): void => {
  const parts = token.split(" ");

  validateAuthValueParts(parts);
  validateAuthValueScheme(parts[0]);
  validateBase64Url(parts[1]);
};

const validateAuthValueParts = (parts: string[]): void => {
  if (parts.length !== 2) {
    throw new InvalidRequestError(
      "Invalid request: Unexpected authorization header value"
    );
  }
};

const validateAuthValueScheme = (scheme: string): void => {
  if (scheme.toLowerCase() !== "bearer") {
    throw new InvalidRequestError(
      "Invalid request: Unsupported authorization scheme"
    );
  }
};

const validateBase64Url = (value: string): void => {
  try {
    const buffer = Buffer.from(value, "base64url");
    const decodedValue = buffer.toString("base64url");

    if (decodedValue !== value) {
      throw new InvalidRequestError(
        "Invalid request: Bearer token format invalid"
      );
    }
  } catch (error) {
    throw new InvalidRequestError(
      "Invalid request: Bearer token format invalid"
    );
  }
};

export default validateHeaderBearerTokenMiddleware;

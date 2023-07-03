import { APIGatewayProxyEvent } from "aws-lambda";
import validateHeaderBearerTokenMiddleware from "../../lambdas/middlewares/validate-header-bearer-token-middleware";
import { Request } from "@middy/core";

describe("validate-header-bearer-token-middleware.ts", () => {
  describe("valid header with bearer token", () => {
    it.each(["Bearer", "bearer, BEARER"])(
      "should return successfully given bearer token is the event header",
      async (bearer: string) => {
        const mockEvent = {
          headers: {
            Authorization: `${bearer} am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o`,
          } as unknown as APIGatewayProxyEvent,
        };
        const request: Request = {
          event: mockEvent,
        } as Request;
        const middleware = validateHeaderBearerTokenMiddleware();

        expect(
          async () => middleware?.before && (await middleware.before(request))
        ).resolves.not.toThrowError;
      }
    );
  });
  describe("invalid header without well-formed Authorization header", () => {
    it("should throw error when event headers is empty", async () => {
      const request: Request = {
        event: {
          headers: {},
        },
      } as Request;
      const middleware = validateHeaderBearerTokenMiddleware();

      expect(
        async () => middleware?.before && (await middleware.before(request))
      ).rejects.toThrow("Invalid request: Missing authorization header");
    });
    it("should throw error when event headers has Authorization header but wrongly formatted", async () => {
      const request: Request = {
        event: {
          headers: {
            Authorization: "Bearer",
          },
        },
      } as Request;
      const middleware = validateHeaderBearerTokenMiddleware();

      expect(
        async () => middleware?.before && (await middleware.before(request))
      ).rejects.toThrow(
        "Invalid request: Unexpected authorization header value"
      );
    });
    it("should throw error when event headers has Authorization header without Bearer", async () => {
      const request: Request = {
        event: {
          headers: {
            Authorization: "am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
          },
        },
      } as Request;
      const middleware = validateHeaderBearerTokenMiddleware();

      expect(
        async () => middleware?.before && (await middleware.before(request))
      ).rejects.toThrow(
        "Invalid request: Unexpected authorization header value"
      );
    });
    it("should throw error when event headers has Authorization header with Bearer:", async () => {
      const mockEvent = {
        headers: {
          Authorization: "Basic am4Wd9k8fG8sD2a9Bw9E0ov8kSM6K1FkDSUFyA7ZA5o",
        } as unknown as APIGatewayProxyEvent,
      };
      const request: Request = {
        event: mockEvent,
      } as Request;
      const middleware = validateHeaderBearerTokenMiddleware();

      expect(
        async () => middleware?.before && (await middleware.before(request))
      ).rejects.toThrow("Invalid request: Unsupported authorization scheme");
    });
    it("should throw error when event headers has Authorization header with non base64url", async () => {
      const mockEvent = {
        headers: {
          Authorization: "Bearer fake-bearer-token",
        } as unknown as APIGatewayProxyEvent,
      };
      const request: Request = {
        event: mockEvent,
      } as Request;
      const middleware = validateHeaderBearerTokenMiddleware();

      expect(
        async () => middleware?.before && (await middleware.before(request))
      ).rejects.toThrow("Invalid request: Bearer token format invalid");
    });
  });
});

import {
  GetParameterCommand,
  ParameterType,
  SSMClient,
} from "@aws-sdk/client-ssm";
import { ChronoUnit } from "../../lambdas/verifiable-credential/types/verifiable-credentials";
import {
  ConfigKey,
  VerifiableCredentialBuilder,
} from "../../lambdas/verifiable-credential/verifiable-credential-builder";
jest.mock("@aws-sdk/client-ssm", () => {
  return {
    __esModule: true,
    ...jest.requireActual("@aws-sdk/client-ssm"),
    GetParametersCommand: jest.fn(),
    SSMClient: {
      prototype: {
        send: jest.fn(),
      },
    },
  };
});
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: () => "d7c05e44-37e6-4ed4-b6d3-01af51a95f84",
}));

describe("verifiable-credential-builder.ts", () => {
  let builder: VerifiableCredentialBuilder;
  const mockSSMClient = jest.mocked(SSMClient);
  beforeEach(() => {
    builder = new VerifiableCredentialBuilder(mockSSMClient.prototype);
  });

  describe("subject", () => {
    it("should be set to a value supplied", () => {
      builder.subject("Kenneth Decerqueira");

      expect(builder.claims().sub).toBe("Kenneth Decerqueira");
    });

    it.each(["", null, undefined])("should not be '%s'", (value) => {
      expect(() => builder.subject(value as unknown as string)).toThrow(
        "The subject must not be null or empty."
      );
    });
  });
  describe("issuer", () => {
    it("should be set to value supplied", () => {
      builder.issuer("an-issuer-for-toy");

      expect(builder.claims().iss).toBe("an-issuer-for-toy");
    });
    it.each(["", null, undefined])("should not be '%s'", (value) => {
      expect(() => builder.issuer(value as unknown as string)).toThrow(
        "The issuer must not be null or empty."
      );
    });
  });
  describe("timeToLive", () => {
    it.each([
      [VerifiableCredentialBuilder.ChronoUnit.Days],
      [VerifiableCredentialBuilder.ChronoUnit.Hours],
      [VerifiableCredentialBuilder.ChronoUnit.Minutes],
      [VerifiableCredentialBuilder.ChronoUnit.Seconds],
    ])("should be set to supplied value '%s'", (ttlUnit) => {
      builder.timeToLive(30, ttlUnit);

      expect(builder).toEqual(
        expect.objectContaining({ ttl: 30, ttlUnit: ttlUnit })
      );
    });

    it("should throw an error for an invalid unit", () => {
      expect(() =>
        builder.timeToLive(30, "invalid" as unknown as ChronoUnit)
      ).toThrow("ttlUnit must be valid");
    });
  });
  describe("verifiableCredentialType", () => {
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialType([
        "VerifiableCredential",
        "IdentityCheckCredential",
      ]);

      expect(builder.claims().vc.type).toEqual([
        "VerifiableCredential",
        "IdentityCheckCredential",
      ]);
    });
    it("should not be '%s'", () => {
      expect(() => builder.verifiableCredentialType([])).toThrow(
        "The VerifiableCredential type must not be null or empty."
      );
    });
  });
  describe("verifiableCredentialSubject", () => {
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialSubject("Kenneth Decerqueira");

      expect(builder.claims().vc.credentialSubject).toEqual(
        "Kenneth Decerqueira"
      );
    });
    it.each(["", null, undefined])("should not be '%s'", (type) => {
      expect(() =>
        builder.verifiableCredentialSubject(type as unknown as string)
      ).toThrow("The VerifiableCredential subject must not be null or empty.");
    });
  });
  describe("verifiableCredentialContext", () => {
    let contexts: Array<string>;
    beforeEach(() => {
      contexts = ["context1", "context2"];
    });
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialContext(contexts);

      expect(builder.claims().vc["@context"]).toEqual(contexts);
    });
    it.each(["", null, undefined])("should not be '%s'", (type) => {
      expect(() =>
        builder.verifiableCredentialContext(type as unknown as Array<string>)
      ).toThrow("The VerifiableCredential context must not be null or empty.");
    });
  });
  describe("verifiableCredentialEvidence", () => {
    let evidence: object;
    beforeEach(() => {
      evidence = new Map([
        ["evidence-key-1", "evidence-value-1"],
        ["evidence-key-2", "evidence-value-2"],
      ]);
    });
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialEvidence(evidence);

      expect(builder.claims().vc.evidence).toEqual(evidence);
    });
    it.each(["", null, undefined])("should not be '%s'", (type) => {
      expect(() =>
        builder.verifiableCredentialEvidence(type as unknown as object)
      ).toThrow("The VerifiableCredential evidence must not be null or empty.");
    });
  });
  describe("verifiableCredential", () => {
    let contexts: Array<string>;
    let evidence: Map<string, string>;
    const twentyOfJune2023InMs = 1687269570000;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    let getMockSend:
      | ((value?: string | undefined) => jest.Mock<unknown, unknown[]>)
      | ((arg1?: string | undefined) => jest.Mock);
    beforeEach(() => {
      process.env = {
        ...process.env,
        AWS_STACK_NAME: "test-stack-name",
      };
      contexts = ["context1", "context2"];
      evidence = new Map([
        ["evidence-key-1", "evidence-value-1"],
        ["evidence-key-2", "evidence-value-2"],
      ]);
      jest.spyOn(Date, "now").mockReturnValueOnce(twentyOfJune2023InMs);
      getMockSend = (value?: string) => {
        return jest.fn().mockImplementation((command) => {
          if (command instanceof GetParameterCommand) {
            const parameterName =
              command.input.Name === ConfigKey.CONTAINS_UNIQUE_ID
                ? `/di-ipv-cri-toy-api/${ConfigKey.CONTAINS_UNIQUE_ID}`
                : ConfigKey.EXPIRY_REMOVED;
            return Promise.resolve({
              Parameter: {
                Name: parameterName,
                Type: ParameterType.STRING,
                Value: value ? value : "false",
              },
            });
          }
        });
      };
      mockSSMClient.prototype.send = getMockSend();
      builder = new VerifiableCredentialBuilder(mockSSMClient.prototype);
      jest
        .spyOn(Date.prototype, "getTime")
        .mockReturnValueOnce(twentyOfJune2023InMs);
    });
    afterEach(() => jest.clearAllMocks());
    it("should build", async () => {
      const ttlDuration = 30;
      await expect(
        builder
          .subject("Kenneth Decerqueira")
          .issuer("an-issuer-for-toy")
          .timeToLive(
            ttlDuration,
            VerifiableCredentialBuilder.ChronoUnit.Minutes
          )
          .verifiableCredentialType([
            "VerifiableCredential",
            "IdentityCheckCredential",
          ])
          .verifiableCredentialSubject("Kenneth Decerqueira")
          .verifiableCredentialContext(contexts)
          .verifiableCredentialEvidence(evidence)
          .build()
      ).resolves.toEqual({
        sub: "Kenneth Decerqueira",
        iss: "an-issuer-for-toy",
        nbf: Math.floor(twentyOfJune2023InMs / 1000),
        exp: Math.floor(twentyOfJune2023InMs + thirtyMinutesInMs),
        vc: {
          type: ["VerifiableCredential", "IdentityCheckCredential"],
          credentialSubject: "Kenneth Decerqueira",
          "@context": contexts,
          evidence: evidence,
        },
      });
    });
    it("should build with JTI", async () => {
      mockSSMClient.prototype.send = getMockSend("true");
      const ttlDuration = 30;
      await expect(
        builder
          .subject("Kenneth Decerqueira")
          .issuer("an-issuer-for-toy")
          .timeToLive(
            ttlDuration,
            VerifiableCredentialBuilder.ChronoUnit.Minutes
          )
          .verifiableCredentialType([
            "VerifiableCredential",
            "IdentityCheckCredential",
          ])
          .verifiableCredentialSubject("Kenneth Decerqueira")
          .verifiableCredentialContext(contexts)
          .verifiableCredentialEvidence(evidence)
          .build()
      ).resolves.toEqual({
        jti: "urn:uuid:d7c05e44-37e6-4ed4-b6d3-01af51a95f84",
        sub: "Kenneth Decerqueira",
        iss: "an-issuer-for-toy",
        nbf: Math.floor(twentyOfJune2023InMs / 1000),
        vc: {
          type: ["VerifiableCredential", "IdentityCheckCredential"],
          credentialSubject: "Kenneth Decerqueira",
          "@context": contexts,
          evidence: evidence,
        },
      });
    });

    it("should build without context and evidence", async () => {
      const ttlDuration = 30;
      await expect(
        builder
          .subject("Kenneth Decerqueira")
          .issuer("an-issuer-for-toy")
          .timeToLive(
            ttlDuration,
            VerifiableCredentialBuilder.ChronoUnit.Minutes
          )
          .verifiableCredentialType([
            "VerifiableCredential",
            "IdentityCheckCredential",
          ])
          .verifiableCredentialSubject("Kenneth Decerqueira")
          .build()
      ).resolves.toEqual({
        sub: "Kenneth Decerqueira",
        iss: "an-issuer-for-toy",
        nbf: Math.floor(twentyOfJune2023InMs / 1000),
        exp: Math.floor(twentyOfJune2023InMs + thirtyMinutesInMs),
        vc: {
          type: ["VerifiableCredential", "IdentityCheckCredential"],
          credentialSubject: "Kenneth Decerqueira",
        },
      });
      expect(builder.verifiableCredentialContext).toBeDefined;
      expect(builder.verifiableCredentialEvidence).toBeDefined;
    });
    it("should build without an expiry time", async () => {
      mockSSMClient.prototype.send = getMockSend("true");
      const ttlDuration = 30;
      await expect(
        builder
          .subject("Kenneth Decerqueira")
          .issuer("an-issuer-for-toy")
          .timeToLive(
            ttlDuration,
            VerifiableCredentialBuilder.ChronoUnit.Minutes
          )
          .verifiableCredentialType([
            "VerifiableCredential",
            "IdentityCheckCredential",
          ])
          .verifiableCredentialSubject("Kenneth Decerqueira")
          .build()
      ).resolves.toEqual({
        jti: "urn:uuid:d7c05e44-37e6-4ed4-b6d3-01af51a95f84",
        sub: "Kenneth Decerqueira",
        iss: "an-issuer-for-toy",
        nbf: Math.floor(twentyOfJune2023InMs / 1000),
        vc: {
          type: ["VerifiableCredential", "IdentityCheckCredential"],
          credentialSubject: "Kenneth Decerqueira",
        },
      });
    });
  });
});

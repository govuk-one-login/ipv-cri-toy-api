import { ParameterType, SSMClient } from "@aws-sdk/client-ssm";
import { VerifiableCredentialBuilder } from "../../lambdas/verifiable-credential/verifiable-credential-builder";
import { TimeUnit } from "../../lambdas/common/utils/time-units";
jest.mock("@aws-sdk/client-ssm", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/client-ssm"),
  GetParametersCommand: jest.fn(),
  SSMClient: {
    prototype: {
      send: jest.fn(),
    },
  },
}));
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
      [TimeUnit.Unit.Years],
      [TimeUnit.Unit.Months],
      [TimeUnit.Unit.Days],
      [TimeUnit.Unit.Hours],
      [TimeUnit.Unit.Minutes],
      [TimeUnit.Unit.Seconds],
    ])("should be set to supplied value '%s'", (ttlUnit) => {
      builder.timeToLive(ttlUnit, 30);

      expect(builder).toEqual(
        expect.objectContaining({ ttl: 30, ttlUnit: ttlUnit })
      );
    });

    it.each(["YEARS", "MONTHS", "DAYS", "HOURS", "MINUTES", "SECONDS"])(
      "should be set to supplied value '%s'",
      (ttlUnit) => {
        builder.timeToLive(ttlUnit, 30);

        expect(builder).toEqual(
          expect.objectContaining({ ttl: 30, ttlUnit: builder["ttlUnit"] })
        );
      }
    );
    it("should throw an error for an invalid unit", () => {
      expect(() => builder.timeToLive("invalid", 30)).toThrow(
        `ttlUnit must be valid: invalid`
      );
    });
  });
  describe("verifiableCredentialType", () => {
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialType("ToyCredential");

      expect(builder.claims().vc.type).toEqual([
        "VerifiableCredential",
        "ToyCredential",
      ]);
    });
    it.each([null, undefined, ""])("should not be '%s'", (type) => {
      expect(() =>
        builder.verifiableCredentialType(type as unknown as string)
      ).toThrow("The VerifiableCredential type must not be null or empty.");
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
      jest
        .spyOn(Date.prototype, "getTime")
        .mockReturnValueOnce(twentyOfJune2023InMs);
      jest.spyOn(Date, "now").mockReturnValueOnce(twentyOfJune2023InMs);
    });

    afterEach(() => jest.clearAllMocks());
    describe("release flag configured so jti and expiry are not in vc", () => {
      beforeEach(() => {
        [
          {
            name: "/test-stack-name/verifiable-credential/issuer",
            value: "an-issuer-for-toy",
          },
          {
            name: "/test-stack-name/release-flags/vc-contains-unique-id",
            value: "false",
          },
          {
            name: "/release-flags/vc-expiry-removed",
            value: "true",
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

      it("should build", async () => {
        const ttlDuration = 30;
        await expect(
          builder
            .subject("Kenneth Decerqueira")
            .timeToLive(TimeUnit.Unit.Minutes, ttlDuration)
            .verifiableCredentialType("ToyCredential")
            .verifiableCredentialSubject({
              somesubject: {
                firstname: "Kenneth",
                givenname: "Decerqueira",
              },
            })
            .verifiableCredentialContext(contexts)
            .verifiableCredentialEvidence(evidence)
            .build()
        ).resolves.toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          nbf: Math.floor(twentyOfJune2023InMs / 1000),
          vc: {
            type: ["VerifiableCredential", "ToyCredential"],
            credentialSubject: {
              somesubject: {
                firstname: "Kenneth",
                givenname: "Decerqueira",
              },
            },
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
            .timeToLive(TimeUnit.Unit.Minutes, ttlDuration)
            .verifiableCredentialType("ToyCredential")
            .verifiableCredentialSubject("Kenneth Decerqueira")
            .build()
        ).resolves.toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          nbf: Math.floor(twentyOfJune2023InMs / 1000),
          vc: {
            type: ["VerifiableCredential", "ToyCredential"],
            credentialSubject: "Kenneth Decerqueira",
          },
        });
        expect(builder.verifiableCredentialContext).toBeDefined;
        expect(builder.verifiableCredentialEvidence).toBeDefined;
      });
    });
    describe("release flag configured so jti is in the vc", () => {
      beforeEach(() => {
        [
          {
            name: "/test-stack-name/verifiable-credential/issuer",
            value: "an-issuer-for-toy",
          },
          {
            name: "/test-stack-name/release-flags/vc-contains-unique-id",
            value: "true",
          },
          {
            name: "/test-stack-name/release-flags/vc-expiry-removed",
            value: "true",
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
      it("should build with JTI", async () => {
        const ttlDuration = 30;
        await expect(
          builder
            .subject("Kenneth Decerqueira")
            .issuer("an-issuer-for-toy")
            .timeToLive(TimeUnit.Unit.Minutes, ttlDuration)
            .verifiableCredentialType("ToyCredential")
            .verifiableCredentialSubject({
              someothersubject: {
                memberOne: "value1",
                memberTwo: "value2",
              },
            })
            .verifiableCredentialContext(contexts)
            .verifiableCredentialEvidence(evidence)
            .build()
        ).resolves.toEqual({
          jti: "urn:uuid:d7c05e44-37e6-4ed4-b6d3-01af51a95f84",
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          nbf: Math.floor(twentyOfJune2023InMs / 1000),
          vc: {
            type: ["VerifiableCredential", "ToyCredential"],
            credentialSubject: {
              someothersubject: {
                memberOne: "value1",
                memberTwo: "value2",
              },
            },
            "@context": contexts,
            evidence: evidence,
          },
        });
      });
    });
    describe("no release flags in aws parameter store produces vc that has an expiry", () => {
      beforeEach(() =>
        mockSSMClient.prototype.send.mockImplementationOnce(() =>
          Promise.resolve({
            Parameter: {
              Name: "/test-stack-name/verifiable-credential/issuer",
              Type: ParameterType.STRING,
              Value: "an-issuer-for-toy",
            },
          })
        )
      );
      it("should build", async () => {
        const ttlDuration = 30;
        await expect(
          builder
            .subject("Kenneth Decerqueira")
            .timeToLive(TimeUnit.Unit.Minutes, ttlDuration)
            .verifiableCredentialType("ToyCredential")
            .verifiableCredentialSubject({
              somesubject: {
                firstname: "Kenneth",
                givenname: "Decerqueira",
              },
            })
            .verifiableCredentialContext(contexts)
            .verifiableCredentialEvidence(evidence)
            .build()
        ).resolves.toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          nbf: Math.floor(twentyOfJune2023InMs / 1000),
          exp: Math.floor(twentyOfJune2023InMs + thirtyMinutesInMs),
          vc: {
            type: ["VerifiableCredential", "ToyCredential"],
            credentialSubject: {
              somesubject: {
                firstname: "Kenneth",
                givenname: "Decerqueira",
              },
            },
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
            .timeToLive(TimeUnit.Unit.Minutes, ttlDuration)
            .verifiableCredentialType("ToyCredential")
            .verifiableCredentialSubject("Kenneth Decerqueira")
            .build()
        ).resolves.toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          nbf: Math.floor(twentyOfJune2023InMs / 1000),
          exp: Math.floor(twentyOfJune2023InMs + thirtyMinutesInMs),
          vc: {
            type: ["VerifiableCredential", "ToyCredential"],
            credentialSubject: "Kenneth Decerqueira",
          },
        });
        expect(builder.verifiableCredentialContext).toBeDefined;
        expect(builder.verifiableCredentialEvidence).toBeDefined;
      });
    });
  });
});

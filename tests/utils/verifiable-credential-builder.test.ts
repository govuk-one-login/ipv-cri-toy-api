import { ChronoUnit } from "../../lambdas/verifiable-credential/types/verifiable-credentials";
import {
  VerifiableCredentialBuilder,
} from "../../lambdas/verifiable-credential/verifiable-credential-builder";
import crypto from "crypto";
describe("verifiable-credential-builder.ts", () => {
  let builder: VerifiableCredentialBuilder;

  beforeEach(() => {
    builder = new VerifiableCredentialBuilder();
  });

  describe("subject", () => {
    it("should be set to a value supplied", () => {
      builder.subject("Kenneth Decerqueira");

      expect(builder.claims().sub).toBe(
        "Kenneth Decerqueira"
      );
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
    const twentyOfJune2023InMs = 1687269570000;
    const thirtySecondsInMs = 30 * 1000;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    const thirtyHoursInMs = 30 * 60 * 60 * 1000;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    it.each([
      [ChronoUnit.Seconds, thirtySecondsInMs],
      [ChronoUnit.Minutes, thirtyMinutesInMs],
      [ChronoUnit.Hours, thirtyHoursInMs],
      [ChronoUnit.Days, thirtyDaysInMs],
    ])("should set expiration time in '%s'", (timeUnit, ttlDuration) => {
      jest
        .spyOn(Date.prototype, "getTime")
        .mockReturnValueOnce(twentyOfJune2023InMs);
      const expectedExpirationTime = Math.floor(
        twentyOfJune2023InMs + ttlDuration
      );
      builder.timeToLive(30, timeUnit);

      expect(builder.claims().exp).toEqual(
        expectedExpirationTime
      );
    });

    it("should throw an error for an invalid unit", () => {
      expect(() =>
        builder.timeToLive(30, "invalid" as unknown as ChronoUnit)
      ).toThrow("Unexpected time-to-live unit encountered: invalid");
    });
  });
  describe("verifiableCredentialType", () => {
    it("should be set to the value supplied", () => {
      builder.verifiableCredentialType(["VerifiableCredential", "IdentityCheckCredential"]);

      expect(builder.claims().vc.type).toEqual([
        "VerifiableCredential",
        "IdentityCheckCredential",
      ]);
    });
    it("should not be '%s'", () => {
      expect(() =>
        builder.verifiableCredentialType([])
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
    let evidence: Map<string, string>; Map<string, string>;
    const twentyOfJune2023InMs = 1687269570000;
    const thirtyMinutesInMs = 30 * 60 * 1000;
    beforeEach(() => {
      contexts = ["context1", "context2"];
      evidence = new Map([
          ["evidence-key-1", "evidence-value-1"],
          ["evidence-key-2", "evidence-value-2"]
      ]);
      jest
        .spyOn(Date.prototype, "getTime")
        .mockReturnValueOnce(twentyOfJune2023InMs);
    });

    it("should build", () => {
      const ttlDuration = 30;
      expect(
        builder
          .subject("Kenneth Decerqueira")
          .issuer("an-issuer-for-toy")
          .timeToLive(ttlDuration, VerifiableCredentialBuilder.ChronoUnit.Minutes)
          .verifiableCredentialType(["VerifiableCredential", "IdentityCheckCredential"])
          .verifiableCredentialSubject("Kenneth Decerqueira")
          .verifiableCredentialContext(contexts)
          .verifiableCredentialEvidence(evidence)
          .build()
      ).toEqual({
        sub: "Kenneth Decerqueira",
        iss: "an-issuer-for-toy",
        exp:  Math.floor(
            twentyOfJune2023InMs + thirtyMinutesInMs
        ),
        vc: {
          type: ["VerifiableCredential", "IdentityCheckCredential"],
          credentialSubject: "Kenneth Decerqueira",
          "@context": contexts,
          evidence: evidence,
        },
      });
    });
    it("should build with JTI", () => {
        const mockUUID = "0bb053c1-e78b-49a6-8df2-7182048c3b2b";
        jest.spyOn(crypto, "randomUUID").mockReturnValueOnce(mockUUID);
    
        const ttlDuration = 30;
        expect(
          builder
            .jti()
            .subject("Kenneth Decerqueira")
            .issuer("an-issuer-for-toy")
            .timeToLive(ttlDuration, VerifiableCredentialBuilder.ChronoUnit.Minutes)
            .verifiableCredentialType(["VerifiableCredential", "IdentityCheckCredential"])
            .verifiableCredentialSubject("Kenneth Decerqueira")
            .verifiableCredentialContext(contexts)
            .verifiableCredentialEvidence(evidence)
            .build()
        ).toEqual({
          jti: mockUUID,
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          exp:  Math.floor(
              twentyOfJune2023InMs + thirtyMinutesInMs
          ),
          vc: {
            type: ["VerifiableCredential", "IdentityCheckCredential"],
            credentialSubject: "Kenneth Decerqueira",
            "@context": contexts,
            evidence: evidence,
          },
        });
        expect(builder.claims().jti).toBe(mockUUID);
      });
  
    it("should build without context and evidence", () => {
        const ttlDuration = 30;
        expect(
          builder
            .subject("Kenneth Decerqueira")
            .issuer("an-issuer-for-toy")
            .timeToLive(ttlDuration, VerifiableCredentialBuilder.ChronoUnit.Minutes)
            .verifiableCredentialType(["VerifiableCredential", "IdentityCheckCredential"])
            .verifiableCredentialSubject("Kenneth Decerqueira")
            .build()
        ).toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          exp:  Math.floor(
              twentyOfJune2023InMs + thirtyMinutesInMs
          ),
          vc: {
            type: ["VerifiableCredential", "IdentityCheckCredential"],
            credentialSubject: "Kenneth Decerqueira",
          },
        });
        expect(builder.verifiableCredentialContext).toBeDefined;
        expect(builder.verifiableCredentialEvidence).toBeDefined;
    });
    it("should build without an expiry time", () => {
        expect(
          builder
            .subject("Kenneth Decerqueira")
            .issuer("an-issuer-for-toy")
            .verifiableCredentialType(["VerifiableCredential", "IdentityCheckCredential"])
            .verifiableCredentialSubject("Kenneth Decerqueira")
            .build()
        ).toEqual({
          sub: "Kenneth Decerqueira",
          iss: "an-issuer-for-toy",
          vc: {
            type: ["VerifiableCredential", "IdentityCheckCredential"],
            credentialSubject: "Kenneth Decerqueira",
          },
        });
    });
  });
});

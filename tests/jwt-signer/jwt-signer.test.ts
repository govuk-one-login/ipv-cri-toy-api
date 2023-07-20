import {
  KMSClient,
  MessageType,
  SignCommand,
  SigningAlgorithmSpec,
} from "@aws-sdk/client-kms";
import { createHash } from "crypto";
import sigFormatter from "ecdsa-sig-formatter";
import { base64url } from "jose";
import { JwtSigner } from "../../lambdas/jwt-signer/jwt-signer";

jest.mock("@aws-sdk/client-kms", () => ({
  __esModule: true,
  ...jest.requireActual("@aws-sdk/client-kms"),
  SignCommand: jest.fn(),
}));
jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  createHash: jest.fn(),
}));
jest.mock("ecdsa-sig-formatter", () => ({
  ...jest.requireActual("ecdsa-sig-formatter"),
  derToJose: jest.fn(),
}));
jest.mock("@aws-sdk/client-ssm");

describe("JwtSigner", () => {
  const claimsSet = { name: "John Doe" };
  let mockedKMSClient: jest.MockedObjectDeep<typeof KMSClient>;
  let mockedSignCommand: jest.MockedObjectDeep<typeof SignCommand>;
  let mockedCreateHash: jest.Mock<unknown, unknown[], unknown>;
  let mockedDerToJose: jest.Mock<unknown, unknown[], unknown>;

  beforeEach(() => {
    mockedKMSClient = jest.mocked(KMSClient);
    mockedSignCommand = jest.mocked(SignCommand);
    mockedCreateHash = createHash as jest.Mock;
    mockedDerToJose = sigFormatter.derToJose as jest.Mock;
  });
  afterEach(() => jest.clearAllMocks());

  describe("signs payload", () => {
    it("should create signed jwt using with KMS KeyId", async () => {
      const mockedGetSigningKmsKeyId = jest.fn(() => "test-key-id");
      const jwtSigner = new JwtSigner(
        mockedKMSClient.prototype,
        mockedGetSigningKmsKeyId
      );
      const expectedKid = "test-key-id";
      const expectedJoseHeader = {
        kid: expectedKid,
        typ: "JWT",
        alg: "ES256",
      };

      const expectedJwtHeader = base64url.encode(
        JSON.stringify(expectedJoseHeader)
      );
      const expectedJwtPayload = base64url.encode(JSON.stringify(claimsSet));
      const expectedSignature = "test-signature";
      const expectedRsSignature = "mocked-signature";
      const expectedJwt = `${expectedJwtHeader}.${expectedJwtPayload}.${expectedRsSignature}`;
      jest.spyOn(mockedKMSClient.prototype, "send").mockImplementation(() =>
        Promise.resolve({
          Signature: expectedSignature,
        })
      );
      const mockUpdate = jest.fn().mockReturnThis();
      const mockDigest = jest.fn().mockReturnValueOnce("mocked-digest");
      mockedCreateHash.mockReturnValueOnce({
        update: mockUpdate,
        digest: mockDigest,
      });
      mockedDerToJose.mockReturnValueOnce(expectedRsSignature);

      const signedJwt = await jwtSigner.createSignedJwt(claimsSet);

      expect(mockedGetSigningKmsKeyId).toHaveBeenCalledTimes(1);
      expect(mockedKMSClient.prototype.send).toHaveBeenCalledTimes(1);
      expect(mockedSignCommand).toHaveBeenCalledWith({
        KeyId: expectedKid,
        Message: "mocked-digest",
        MessageType: MessageType.DIGEST,
        SigningAlgorithm: SigningAlgorithmSpec.ECDSA_SHA_256,
      });
      expect(mockUpdate).toHaveBeenCalledWith(expect.any(Buffer));
      expect(mockDigest).toHaveBeenCalledTimes(1);
      expect(signedJwt).toBe(expectedJwt);
    });
  });
  describe("does not sign payload", () => {
    it("should error during create createSignedJwt when KeyId not found", () => {
      const mockedGetSigningKmsKeyId = jest.fn(() => "");
      const jwtSigner = new JwtSigner(
        mockedKMSClient.prototype,
        mockedGetSigningKmsKeyId
      );
      expect(
        async () => await jwtSigner.createSignedJwt(claimsSet)
      ).rejects.toThrow("Signing Kms KeyId is missing");
    });
    it("should error when signature is missing or invalid signature", () => {
      const mockedGetSigningKmsKeyId = jest.fn(() => "test-key-id");
      const jwtSigner = new JwtSigner(
        mockedKMSClient.prototype,
        mockedGetSigningKmsKeyId
      );
      const mockUpdate = jest.fn().mockReturnThis();
      const mockDigest = jest.fn().mockReturnValueOnce("mocked-digest");
      mockedCreateHash.mockReturnValueOnce({
        update: mockUpdate,
        digest: mockDigest,
      });
      const invalidResponse = { Signature: null };
      jest
        .spyOn(mockedKMSClient.prototype, "send")
        .mockResolvedValueOnce(invalidResponse);
      expect(
        async () => await jwtSigner.createSignedJwt(claimsSet)
      ).rejects.toThrow(
        "KMS signing error: Error: KMS response does not contain a valid Signature."
      );
    });
    it("should error when KMS signing failed", async () => {
      const mockedGetSigningKmsKeyId = jest.fn(() => "test-key-id");
      const mockUpdate = jest.fn().mockReturnThis();
      const mockDigest = jest.fn().mockReturnValueOnce("mocked-digest");
      mockedCreateHash.mockReturnValueOnce({
        update: mockUpdate,
        digest: mockDigest,
      });
      jest
        .spyOn(mockedKMSClient.prototype, "send")
        .mockRejectedValueOnce(new Error("Failed to sign JWT with KMS"));
      const jwtSigner = new JwtSigner(
        mockedKMSClient.prototype,
        mockedGetSigningKmsKeyId
      );
      const claimsSet = { name: "John Doe" };

      await expect(jwtSigner.createSignedJwt(claimsSet)).rejects.toThrow(
        "Failed to sign JWT with KMS"
      );
    });
    it("should throw an error for an unknown error during signing with KMS", async () => {
      const mockKMSClient = new KMSClient({});
      const mockSignCommand = jest.fn().mockReturnValue({
        Signature: new Uint8Array(),
      });
      const mockUpdate = jest.fn().mockReturnThis();
      const dummyClaimsSet = { sub: "dummy-subject", exp: 1699999999 };
      const mockDigest = jest.fn().mockReturnValueOnce("mocked-digest");

      mockedCreateHash.mockReturnValueOnce({
        update: mockUpdate,
        digest: mockDigest,
      });
      mockKMSClient.send = mockSignCommand;
      mockSignCommand.mockRejectedValueOnce({ Signature: "invalid-response" });

      const jwtSigner = new JwtSigner(mockKMSClient, () => "dummy-kid");

      await expect(jwtSigner.createSignedJwt(dummyClaimsSet)).rejects.toThrow(
        "An unknown error occurred while signing with KMS: [object Object]"
      );
    });
    it("should throw an error if KMS response is not in JSON format", async () => {
      const mockKMSClient = new KMSClient({});
      const mockSignCommand = jest.fn().mockReturnValue({
        Signature: new Uint8Array(),
      });
      const mockUpdate = jest.fn().mockReturnThis();
      const dummyClaimsSet = { sub: "dummy-subject", exp: 1699999999 };
      const mockDigest = jest.fn().mockReturnValueOnce("mocked-digest");

      mockedCreateHash.mockReturnValueOnce({
        update: mockUpdate,
        digest: mockDigest,
      });
      mockKMSClient.send = mockSignCommand;
      mockSignCommand.mockRejectedValueOnce(new SyntaxError("Unknown error"));

      const jwtSigner = new JwtSigner(mockKMSClient, () => "dummy-kid");

      await expect(jwtSigner.createSignedJwt(dummyClaimsSet)).rejects.toThrow(
        "KMS response is not in JSON format. SyntaxError: Unknown error"
      );
    });
  });
});

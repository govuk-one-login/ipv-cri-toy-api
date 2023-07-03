import { randomUUID } from "crypto";
import {
  ChronoUnit,
  VerifiableCredential,
} from "../types/verifiable-credentials";
import { GetParameterCommand, Parameter, SSMClient } from "@aws-sdk/client-ssm";

export enum ReleaseFlagKeys {
  CONTAINS_UNIQUE_ID = "release-flags/vc-contains-unique-id",
  EXPIRY_REMOVED = "/release-flags/vc-expiry-removed",
}
const PARAMETER_PREFIX = process.env.AWS_STACK_NAME || "";

export class VerifiableCredentialBuilder {
  static ChronoUnit = ChronoUnit;
  constructor(
    private readonly ssmClient: SSMClient,
    private readonly credential: VerifiableCredential = {
      sub: "",
      iss: "",
      nbf: 0,
      vc: {
        type: ["VerifiableCredential"],
        credentialSubject: Object,
      },
    },
    private ttl: number = 0,
    private ttlUnit?: ChronoUnit
  ) {}

  subject(subject: string): VerifiableCredentialBuilder {
    if (!subject) throw new Error("The subject must not be null or empty.");

    this.credential.sub = subject;
    return this;
  }

  issuer(issuer: string): VerifiableCredentialBuilder {
    if (!issuer) throw new Error("The issuer must not be null or empty.");

    this.credential.iss = issuer;
    return this;
  }

  timeToLive(unit: ChronoUnit, ttl?: number): VerifiableCredentialBuilder {
    if (!unit || !Object.values(ChronoUnit).includes(unit)) {
      throw new Error("ttlUnit must be valid");
    }
    if (!ttl || ttl < 1) {
      throw new Error("ttl must be greater than zero");
    }

    this.ttlUnit = unit;
    this.ttl = ttl;
    return this;
  }

  verifiableCredentialType(type: string): VerifiableCredentialBuilder {
    if (!type)
      throw new Error(
        "The VerifiableCredential type must not be null or empty."
      );

    this.credential.vc.type.push(type);
    this.credential.vc.type = Array.from(new Set(this.credential.vc.type));
    return this;
  }

  verifiableCredentialSubject(subject: unknown): VerifiableCredentialBuilder {
    if (!subject)
      throw new Error(
        "The VerifiableCredential subject must not be null or empty."
      );

    this.credential.vc.credentialSubject = subject;
    return this;
  }

  verifiableCredentialContext(contexts: string[]): VerifiableCredentialBuilder {
    if (!contexts || !Array.isArray(contexts) || !contexts.length)
      throw new Error(
        "The VerifiableCredential context must not be null or empty."
      );

    this.credential.vc["@context"] = contexts;
    return this;
  }
  verifiableCredentialEvidence(evidence: object): VerifiableCredentialBuilder {
    if (!evidence)
      throw new Error(
        "The VerifiableCredential evidence must not be null or empty."
      );

    this.credential.vc.evidence = evidence;
    return this;
  }

  async build(): Promise<VerifiableCredential> {
    this.credential.nbf = Math.floor(new Date().getTime() / 1000);
    const issuerParameter = await this.getParameter(
      `/${process.env.COMMON_PARAMETER_NAME_PREFIX}/verifiable-credential/issuer`
    );
    const issuer = issuerParameter.Value;
    if (!issuer)
      throw new Error(
        "An empty/null verifiable credential issuer was retrieved from configuration"
      );
    this.credential.iss = issuer;
    if (
      await this.isReleaseFlag(
        this.getParameter.bind(this),
        ReleaseFlagKeys.CONTAINS_UNIQUE_ID
      )
    ) {
      this.credential.jti = this.generateUniqueId();
    }
    if (
      !(await this.isReleaseFlag(
        this.getParameter.bind(this),
        ReleaseFlagKeys.EXPIRY_REMOVED
      ))
    ) {
      this.credential.exp =
        Date.now() + this.ttl * this.getUnitMultiplier(this.ttlUnit);
    }
    return this.credential;
  }

  private getUnitMultiplier(unit?: string): number {
    switch (unit) {
      case ChronoUnit.Seconds:
        return 1000;
      case ChronoUnit.Minutes:
        return 1000 * 60;
      case ChronoUnit.Hours:
        return 1000 * 60 * 60;
      case ChronoUnit.Days:
        return 1000 * 60 * 60 * 24;
      default:
        throw new Error(`Unexpected time-to-live unit encountered: ${unit}`);
    }
  }

  private async isReleaseFlag(
    parameterGetter: (arg: string) => Promise<Parameter>,
    flagParameterPath: string
  ): Promise<boolean> {
    try {
      return (await parameterGetter(flagParameterPath)).Value === "true";
    } catch (error) {
      return false;
    }
  }

  private async getParameter(ssmParamName: string): Promise<Parameter> {
    const paramName = this.isAnAbsolutePathParameter(ssmParamName)
      ? ssmParamName
      : `/${PARAMETER_PREFIX}/${ssmParamName}`;
    const getParamResult = await this.ssmClient.send(
      new GetParameterCommand({ Name: paramName })
    );
    if (!getParamResult?.Parameter) {
      throw new Error(`Invalid SSM parameter: ${paramName}`);
    }
    return getParamResult.Parameter;
  }

  public claims = () => this.credential;

  private isAnAbsolutePathParameter = (ssmParameter: string): boolean =>
    ssmParameter.startsWith("/");

  private generateUniqueId = (): string => `urn:uuid:${randomUUID()}`;
}

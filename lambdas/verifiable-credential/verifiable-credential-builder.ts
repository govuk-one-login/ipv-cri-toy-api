import { randomUUID } from "crypto";
import {
  ChronoUnit,
  VerifiableCredential,
} from "./types/verifiable-credentials";
import { GetParameterCommand, Parameter, SSMClient } from "@aws-sdk/client-ssm";

export enum ConfigKey {
  CONTAINS_UNIQUE_ID = "release-flags/vc-contains-unique-id",
  EXPIRY_REMOVED = "/release-flags/vc-expiry-removed",
}
const PARAMETER_PREFIX = process.env.AWS_STACK_NAME || "";
export class VerifiableCredentialBuilder {
  static ChronoUnit = ChronoUnit;
  constructor(
    private ssmClient: SSMClient,
    private ttl: number = 0,
    private ttlUnit: ChronoUnit | undefined = undefined,
    private credential: VerifiableCredential = {
      sub: "",
      iss: "",
      nbf: 0,
      vc: {
        type: [],
        credentialSubject: "",
      },
    } as VerifiableCredential
  ) {}

  claims() {
    return this.credential;
  }

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

  timeToLive(
    ttl: number,
    unit: ChronoUnit | undefined
  ): VerifiableCredentialBuilder {
    if (!unit || !Object.values(ChronoUnit).includes(unit)) {
      throw new Error("ttlUnit must be valid");
    }
    if (ttl <= 0) {
      throw new Error("ttl must be greater than zero");
    }

    this.ttlUnit = unit;
    this.ttl = ttl;
    return this;
  }

  verifiableCredentialType(types: Array<string>): VerifiableCredentialBuilder {
    if (Array.isArray(types) && !types?.length)
      throw new Error(
        "The VerifiableCredential type must not be null or empty."
      );

    this.credential.vc.type = types;
    return this;
  }

  verifiableCredentialSubject(subject: string): VerifiableCredentialBuilder {
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
    if (
      await this.isReleaseFlag(
        this.getParameter.bind(this),
        ConfigKey.CONTAINS_UNIQUE_ID
      )
    ) {
      this.credential.jti = this.generateUniqueId();
    }
    if (
      !(await this.isReleaseFlag(
        this.getParameter.bind(this),
        ConfigKey.EXPIRY_REMOVED
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
  private generateUniqueId(): string {
    return `urn:uuid:${randomUUID()}`;
  }

  private async isReleaseFlag(
    parameterGetter: (arg: string) => Promise<Parameter>,
    flagParameterPath: string
  ): Promise<boolean> {
    return (await parameterGetter(flagParameterPath)).Value === "true";
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

  private isAnAbsolutePathParameter(ssmParameter: string): boolean {
    return ssmParameter.startsWith("/");
  }
}

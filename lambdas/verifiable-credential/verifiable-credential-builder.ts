import { randomUUID } from "crypto";
import { ChronoUnit, VerifiableCredential } from "./types/verifiable-credentials";

export class VerifiableCredentialBuilder {
  static ChronoUnit = ChronoUnit;

  private credential: VerifiableCredential = {
    sub: "",
    iss: "",
    vc: {
      type: [],
      credentialSubject: "",
    },
  } as VerifiableCredential;

  claims() {
    return this.credential;
  }

  jti(): VerifiableCredentialBuilder {
    this.credential.jti = randomUUID();
    return this;
  }
  subject(subject: string): VerifiableCredentialBuilder {
    if (!subject) throw new Error("The subject must not be null or empty.");

    this.credential.sub = subject;
    return this;
  }

  issuer(issuer: string) : VerifiableCredentialBuilder {
    if (!issuer) throw new Error("The issuer must not be null or empty.");

    this.credential.iss = issuer;
    return this;
  }

  timeToLive(ttl: number, unit: ChronoUnit): VerifiableCredentialBuilder {
    const now = new Date();
    const expirationTime = new Date(now.getTime() + ttl * this.getUnitMultiplier(unit));
    this.credential.exp = expirationTime.getTime();
    return this;
  }

  verifiableCredentialType(types: Array<string>) : VerifiableCredentialBuilder{
    if (Array.isArray(types) && !types?.length) throw new Error("The VerifiableCredential type must not be null or empty.");

    this.credential.vc.type = types;
    return this;
  }

  verifiableCredentialSubject(subject: string) : VerifiableCredentialBuilder {
    if (!subject) throw new Error("The VerifiableCredential subject must not be null or empty.");

    this.credential.vc.credentialSubject = subject;
    return this;
  }

  verifiableCredentialContext(contexts: string[]) : VerifiableCredentialBuilder {
    if (!contexts) throw new Error("The VerifiableCredential context must not be null or empty.");
    
    this.credential.vc["@context"] = contexts;
    return this;
  }

  verifiableCredentialEvidence(evidence: object) : VerifiableCredentialBuilder {
    if (!evidence) throw new Error("The VerifiableCredential evidence must not be null or empty.");

    this.credential.vc.evidence = evidence;
    return this;
  }

  build() {
    return this.credential;
  }

  private getUnitMultiplier(unit: string): number {
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
}

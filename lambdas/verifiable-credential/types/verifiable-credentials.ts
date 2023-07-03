export enum ChronoUnit {
  Seconds = "seconds",
  Minutes = "minutes",
  Hours = "hours",
  Days = "days",
}
export enum VC_CONTEXT {
  W3_BASE_CONTEXT = "https://www.w3.org/2018/credentials/v1",
  DI_CONTEXT = "https://vocab.london.cloudapps.digital/contexts/identity-v1.jsonld",
}
export type VerifiableCredential = {
  jti?: string;
  sub: string;
  iss: string;
  nbf: number;
  exp?: number;
  vc: {
    type: Array<string>;
    credentialSubject: unknown;
    "@context"?: Array<string>;
    evidence?: unknown;
  };
};

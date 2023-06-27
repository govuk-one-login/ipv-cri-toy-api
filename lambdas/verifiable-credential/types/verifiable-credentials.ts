export enum ChronoUnit {
  Seconds = "seconds",
  Minutes = "minutes",
  Hours = "hours",
  Days = "days",
}

export type VerifiableCredential = {
  jti?: string;
  sub: string;
  iss: string;
  nbf: number;
  exp?: number;
  vc: {
    type: string[];
    credentialSubject: string;
    "@context"?: undefined | string[];
    evidence?: undefined | unknown;
  };
};

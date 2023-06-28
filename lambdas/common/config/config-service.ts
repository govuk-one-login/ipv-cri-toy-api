import {
  SSMClient,
  GetParametersCommand,
  GetParameterCommand,
} from "@aws-sdk/client-ssm";
import { Parameter } from "aws-sdk/clients/ssm";
import { CommonConfigKey } from "../../types/config-keys";
import { CriAuditConfig } from "../../types/cri-audit-config";

const DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS = 600;
const PARAMETER_PREFIX = process.env.AWS_STACK_NAME || "";
const COMMON_PARAMETER_PREFIX = process.env.COMMON_PARAMETER_NAME_PREFIX || "";

export class ConfigService {
  private readonly authorizationCodeTtlInMillis: number;
  private readonly configEntries: Map<string, string>;
  private readonly clientConfigurations: Map<string, Map<string, string>>;

  constructor(private ssmClient: SSMClient) {
    const envAuthCodeTtl = parseInt(
      process.env.AUTHORIZATION_CODE_TTL || "",
      10
    );
    this.authorizationCodeTtlInMillis =
      (Number.isInteger(envAuthCodeTtl)
        ? envAuthCodeTtl
        : DEFAULT_AUTHORIZATION_CODE_TTL_IN_SECS) * 1000;
    this.configEntries = new Map<string, string>();
    this.clientConfigurations = new Map<string, Map<string, string>>();
  }

  public init(keys: CommonConfigKey[]): Promise<void> {
    return this.getDefaultConfig(keys);
  }

  public getConfigEntry(key: CommonConfigKey) {
    let paramName = `/${PARAMETER_PREFIX}/${key}`;
    if (!PARAMETER_PREFIX.includes("common")) {
      paramName = `/${COMMON_PARAMETER_PREFIX}/${key}`;
    }
    if (!this.configEntries.has(paramName)) {
      throw new Error(`Missing SSM parameter ${paramName}`);
    }
    return this.configEntries.get(paramName) as string;
  }

  private getParameterName(parameterNameSuffix: string) {
    if (!PARAMETER_PREFIX.includes("common")) {
      return `/${COMMON_PARAMETER_PREFIX}/${parameterNameSuffix}`;
    } else {
      return `/${PARAMETER_PREFIX}/${parameterNameSuffix}`;
    }
  }

  public getAuditConfig(): CriAuditConfig {
    const auditEventNamePrefix = process.env["SQS_AUDIT_EVENT_PREFIX"];
    if (!auditEventNamePrefix) {
        throw new Error("Missing environment variable: SQS_AUDIT_EVENT_PREFIX");
    }
    const queueUrl = process.env["SQS_AUDIT_EVENT_QUEUE_URL"];
    if (!queueUrl) {
        throw new Error("Missing environment variable: SQS_AUDIT_EVENT_QUEUE_URL");
    }
    const issuer = this.getConfigEntry(CommonConfigKey.VC_ISSUER);
    return {
        auditEventNamePrefix,
        issuer,
        queueUrl,
    };
}

  private async getDefaultConfig(
    paramNameSuffixes: CommonConfigKey[]
  ): Promise<void> {
    const ssmParamNames = paramNameSuffixes.map((p) =>
      this.getParameterName(p)
    );
    const ssmParameters = await this.getParameters(ssmParamNames);
    ssmParameters?.forEach((p) =>
      this.configEntries.set(p.Name as string, p.Value as string)
    );
  }

  private async getParameters(ssmParamNames: string[]): Promise<Parameter[]> {
    const getParamsResult = await this.ssmClient.send(
      new GetParametersCommand({ Names: ssmParamNames })
    );

    if (getParamsResult?.InvalidParameters?.length) {
      const invalidParameterNames =
        getParamsResult.InvalidParameters?.join(", ");
      throw new Error(`Invalid SSM parameters: ${invalidParameterNames}`);
    }

    return getParamsResult?.Parameters || [];
  }

  public async getParameter(ssmParamName: string): Promise<Parameter> {
    const getParamResult = await this.ssmClient.send(
      new GetParameterCommand({ Name: ssmParamName })
    );
    if (!getParamResult?.Parameter) {
      throw new Error(`Invalid SSM parameter: ${ssmParamName}`);
    }
    return getParamResult?.Parameter;
  }
}

import { DynamoDBDocument, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SessionItem } from "../types/session-item";
import { ConfigService } from "../common/config/config-service";
import { SessionNotFoundError } from "../common/utils/errors";
import { CommonConfigKey } from "../types/config-keys";

export class SessionService {
  constructor(
    private dynamoDbClient: DynamoDBDocument,
    private configService: ConfigService
  ) {}

  public async getSession(sessionId: string | undefined): Promise<SessionItem> {
    const getSessionCommand = new GetCommand({
      TableName: this.getSessionTableName(),
      Key: {
        sessionId: sessionId,
      },
    });
    const result = await this.dynamoDbClient.send(getSessionCommand);
    if (!result.Item) {
      throw new SessionNotFoundError(
        `Could not find session item with id: ${sessionId}`
      );
    }
    return result.Item as SessionItem;
  }

  public hasDateExpired(dateToCheck: number): boolean {
    return dateToCheck < Math.floor(Date.now() / 1000);
  }

  private getSessionTableName(): string {
    return this.configService.getConfigEntry(
      CommonConfigKey.SESSION_TABLE_NAME
    );
  }
}

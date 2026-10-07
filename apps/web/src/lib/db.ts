import { createDatabaseClient, type DatabaseClient } from '@fbuploadpro/database';

let dbClient: DatabaseClient | null = null;

export function getDbClient(): DatabaseClient {
  if (!dbClient) {
    dbClient = createDatabaseClient();
  }
  return dbClient;
}

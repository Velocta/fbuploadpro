import { createDatabaseClient, type DatabaseClient } from '@fbuploadpro/database';

let dbClient: DatabaseClient | null = null;

export function getDbClient(): DatabaseClient {
  dbClient ??= createDatabaseClient();
  return dbClient;
}

// IMPORTS

import dotenv from 'dotenv';
import { logger } from './logger.helper.js';

/**
 * Manages environment variables.
 */
export class Env {
  /**
   * Creates an environment variable manager.
   */
  constructor() {
    dotenv.config();
  }

  /**
   * Returns the GitHub API tokens from the environment variables.
   * @returns The list of GitHub API tokens.
   */
  getGitHubApiTokens() {
    const tokens = Object.entries(process.env)
      .filter(([key]) => key.startsWith('GH_TOKEN_'))
      .map(([, value]) => value)
      .filter(Boolean);
    logger.info(`[env] Tokens load success: tokens=${tokens}`);
    return tokens;
  }

  /**
   * Returns the MongoDB URL from the environment variables.
   * @returns The MongoDB URL.
   */
  getMongoDbUrl() {
    const url = process.env.MONGODB_URL;
    logger.info(`[env] MongoDB URL load success: url=${url}`);
    return url;
  }

  /**
   * Returns the MongoDB database name from the environment variables.
   * @returns The MongoDB database name.
   */
  getMongoDbName() {
    const name = process.env.MONGODB_NAME;
    logger.info(`[env] MongoDB database name load success: name=${name}`);
    return name;
  }
}

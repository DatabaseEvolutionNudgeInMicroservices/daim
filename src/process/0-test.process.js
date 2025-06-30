// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { Process } from './process.process.js';
import { GitHubApiRequest } from '../model/github-api-request.model.js';
import { GitHubApiClient } from '../helper/github-api-client.helper.js';
import { GitHubApiQueue } from '../helper/github-api-queue.helper.js';

/**
 * Represents a process for test purpose only.
 */
class ProcessTest extends Process {
  constructor() {
    super();

    // Dependencies.
    this.env = new Env(); // Environment variables.
    this.githubApiClients = this.env
      .getGitHubApiTokens()
      .map((token) => new GitHubApiClient(token)); // GitHub search API clients.
    this.githubApiQueue = new GitHubApiQueue(this.githubApiClients); // GitHub search API queue.
  }

  /**
   * Executes the process.
   */
  process() {
    this.githubApiQueue.start();

    const test = () => {
      // ============================================================================ CODE BELOW IS FOR TEST PURPOSE ONLY
      this.githubApiQueue.push(
        new GitHubApiRequest(
          `http://api.github.com/repos/torvalds/linux/contributors`, // It will lead to error on purpose.
          {},
          (result) => {
            logger.info(`[test] Result count: ${result.data.length}`);
          },
        ),
      );
      this.githubApiQueue.push(
        new GitHubApiRequest(
          `http://api.github.com/repos/overleaf/overleaf/contributors`,
          {},
          (result) => {
            logger.info(`[test] Result count: ${result.data.length}`);
          },
        ),
      );
      setTimeout(() => {
        this.githubApiQueue.stop();
      }, 6000);
      // ============================================================================ CODE ABOVE IS FOR TEST PURPOSE ONLY
    };
    test();
  }
}

let processTest = new ProcessTest();
processTest.process();

// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import { GitHubApiRequest } from '../model/github-api-request.model.js';
import { GitHubApiClient } from '../helper/github-api-client.helper.js';
import { GitHubApiQueue } from '../helper/github-api-queue.helper.js';

/**
 * Represents a process to scope the search space.
 */
class ProcessScope extends Process {
  constructor() {
    super();

    // Dependencies.
    this.env = new Env(); // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.
    this.githubApiClients = this.env
      .getGitHubApiTokens()
      .map((token) => new GitHubApiClient(token)); // GitHub search API clients.
    this.githubApiQueue = new GitHubApiQueue(this.githubApiClients); // GitHub search API queue.
    this.idleTime = 0; // Time without any request.

    // Constants.
    this.QUEUE_WAITING_TIME = 1000;
    this.IDLE_TIME_MAX = 1000 * 60 * 1; // 1 minute.
    this.MIN_RANGE_SIZE = 500; // 500 KB
    this.MAX_RANGE_SIZE = 1000000; // 1 GB
    this.MIN_STARS = 100;
    this.MAX_RESULTS_PER_PAGE = 1000;
  }

  /**
   * Executes the process to scope the search space.
   */
  process() {
    this.githubApiQueue.start();

    const rangeQueue = [{ min: this.MIN_RANGE_SIZE, max: this.MAX_RANGE_SIZE }];

    const scope = () => {
      // Loops on the range queue waiting for requests.
      if (rangeQueue.length === 0) {
        // Stops the queue loop if the idle time is over the limit.
        if (this.idleTime >= this.IDLE_TIME_MAX) {
          this.githubApiQueue.stop();
          this.mongoDb.disconnect();
          return;
        }
        // Loops.
        this.idleTime += this.QUEUE_WAITING_TIME;
        setTimeout(scope, this.QUEUE_WAITING_TIME);
        return;
      }
      // Builds and queues the requests.
      const requests = [];
      while (rangeQueue.length > 0) {
        // Resets the idle time.
        this.idleTime = 0;
        // Builds the requests.
        const { min, max } = rangeQueue.shift();
        // FILTER: size 500..1000000 && stars >= 100
        const query = `size:${min}..${max} stars:>=${this.MIN_STARS}`;
        const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}`;
        requests.push(
          new GitHubApiRequest(url, {}, (result) => {
            const totalCount = result.data.total_count;
            if (totalCount === 0) {
              // No result, range skipped.
            } else if (min === max) {
              // Same bounds, range kept because indivisible.
              this.mongoDb.saveRange(min, max, totalCount);
            } else if (totalCount <= this.MAX_RESULTS_PER_PAGE) {
              // Different bounds and results less than threshold, range kept.
              this.mongoDb.saveRange(min, max, totalCount);
            } else {
              // Range divisible, split in two.
              const mid = Math.floor((min + max) / 2);
              rangeQueue.push({ min, max: mid }, { min: mid + 1, max });
            }
            logger.info(
              `[scope] Range: range=${min}..${max}, total_count=${totalCount}`,
            );
          }),
        );
      }
      // Queues the requests built.
      this.githubApiQueue.push(...requests);
      setTimeout(scope, 0); // Loops.
    };

    this.mongoDb
      .connect()
      .then(() => {
        scope(); // Process entry point.
      })
      .catch((error) => {
        logger.error(`[scope] ${error.message}`);
      });
  }
}

let processScope = new ProcessScope();
processScope.process();

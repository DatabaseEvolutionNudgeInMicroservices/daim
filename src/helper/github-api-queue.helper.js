// IMPORTS

import { logger } from './logger.helper.js';

/**
 * Manages the GitHub search API queueing shared between multiple GitHub search API clients.
 */
export class GitHubApiQueue {
  /**
   * Creates a GitHub search API queue shared between multiple GitHub search API clients.
   * @param {Array[GitHubApiClient]} clients The GitHub search API clients.
   * @param {Number} maxErrorCountPerRequest The error count limit per request before aborting. Default is 5 errors.
   * @param {Number} maxErrorCountInTotal The total error count limit before stopping the entire queue. Default is maxErrorCountPerRequest * 1000 errors.
   */
  constructor(
    clients,
    maxErrorCountPerRequest = 5,
    maxErrorCountInTotal = maxErrorCountPerRequest * 1000,
  ) {
    this.clients = clients;
    this.queries = [];
    this.isStopped = false;
    this.errorCount = 0;
    this.errorUrls = {};
    this.maxErrorCountPerRequest = maxErrorCountPerRequest;
    this.maxErrorCountInTotal = maxErrorCountInTotal;
  }

  /**
   * Pushes one or several requests to the last position of the queue.
   * @param {GitHubApiRequest} gitHubApiRequest The GitHub API request.
   */
  push(...requests) {
    this.queries.push(...requests);
  }

  /**
   * Pushes one or several requests to the first position of the queue.
   * @param {GitHubApiRequest} gitHubApiRequest The GitHub API request.
   */
  unshift(...requests) {
    this.queries.unshift(...requests);
  }

  /**
   * Starts the queue processing.
   */
  start() {
    logger.info('[queue] Start');
    this.process();
  }

  /**
   * Stops the queue processing.
   */
  stop() {
    logger.info('[queue] Stop');
    this.isStopped = true;
  }

  /**
   * Processes the queue.
   */
  process() {
    const queue = () => {
      // Stops the process if the stop flag is enabled.
      if (this.isStopped) return;

      // Stops if the error count is to high.
      if (this.errorCount >= this.maxErrorCountInTotal) {
        logger.error('[queue] Error: error count too big');
        return;
      }

      // Filters out the available clients.
      const availableClients = this.clients.filter(
        (client) => client.isAuthorized() && !client.isBusy(),
      );

      // Waits if no client is available or if the queue is empty.
      if (this.queries.length === 0 || availableClients.length === 0) {
        //logger.info(`[queue] Waiting 1 sec...`);
        setTimeout(queue, 1000);
        return;
      }

      // Consumes and performs each request from the queue with available clients and returns the result in the callback.
      for (const client of availableClients) {
        if (this.queries.length === 0) break; // Stops if no more requests.

        const request = this.queries.pop();

        client
          .request(request.getUrl(), request.getParams())
          .then((result) => {
            request.runCallback(result);
          })
          .catch((error) => {
            logger.error(`[queue] Error: ${error.message}`);

            // Error rates counters.
            this.errorCount++;
            if (!this.errorUrls[request.getUrl()]) {
              this.errorUrls[request.getUrl()] = 1; // Flags the request as error to keep track and prevent eventual future idempotent errors.
            } else {
              this.errorUrls[request.getUrl()] += 1; // Increments the request error flag to prevent eventual future idempotent errors.
            }

            // Error rates management.
            if (
              this.errorUrls[request.getUrl()] < this.maxErrorCountPerRequest
            ) {
              logger.info(`[queue] Retry: url=${request.getUrl()}`);
              this.unshift(request); // Repushes the request if the request was not flagged too much.
            } else {
              logger.error(
                `[queue] Abort: url=${request.getUrl()}`, // Abort request after maximum number of attempts.
              );
            }
          })
          .finally(() => {
            setTimeout(queue, 0); //Loop.
          });
      }
    };
    queue(); // Queue entry point.
  }

  /**
   * Returns the number of requests in the queue.
   * @returns The number of requests in the queue.
   */
  getQueueLength() {
    return this.queries.length;
  }

  /**
   * Returns the number of failed requests that have been abadoned.
   * @returns The number of failed requests that have been abadoned.
   */
  getRequestFailCount() {
    return Object.keys(this.errorUrls).reduce(
      (acc, url) =>
        this.errorUrls[url] >= this.maxErrorCountPerRequest ? acc + 1 : acc,
      0,
    );
  }
}

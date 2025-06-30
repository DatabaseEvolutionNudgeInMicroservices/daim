// IMPORTS

import { logger } from './logger.helper.js';
import axios from 'axios';

/**
 * Manages a GitHub search API client with a specific token.
 */
export class GitHubApiClient {
  /**
   * Creates a GitHub search API client with a specific token.
   * @param {String} token The specific token.
   * @param {Number} safetyRemainingRequestCount The safety range of remaining requests to avoid complete freezing of the GitHub account. Default is 5 remaining request.
   * @param {Number} tokenResumeBufferTime The additional buffer time at token resume datetime to avoid premature resume. Default is 2000ms.
   */
  constructor(
    token,
    safetyRemainingRequestCount = 5,
    tokenResumeBufferTime = 2000,
  ) {
    this.token = token;
    this.authorized = true;
    this.busy = false;
    this.remainingRequests = 0;
    this.resetAt = 0;
    this.safetyRemainingRequestCount = safetyRemainingRequestCount;
    this.tokenResumeBufferTime = tokenResumeBufferTime;
  }

  /**
   * Tells whether the client is authorized for processing request, meaning if it has enough remaining requests.
   * @returns True if the client is authorized; false otherwise.
   */
  isAuthorized() {
    return this.authorized;
  }

  /**
   * Tells whether the client is busy or not
   * @returns True of the client is busy; false otherwise.
   */
  isBusy() {
    return this.busy;
  }

  /**
   * Performs a request to the GitHub search API with the client.
   * @param {string} url The request URL.
   * @param {Object} params The request parameters.
   * @returns {Promise<any>} The response data.
   */
  request(url, params = {}) {
    // Updates busy status.
    this.busy = true;
    return axios({
      url,
      method: params.method || 'GET',
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github.v3+json',
        ...params.headers,
      },
      data: params.body || null,
    })
      .then((response) => {
        // Updates the rate limit after each request to determine whether the client is ready for the next request.
        this.refresh(response?.headers);

        // Updates busy status.
        this.busy = false;

        // Returns the data.
        logger.info(`[client-${this.getToken()}] Query: url=${url}`);

        return response;
      })
      .catch((error) => {
        // Updates the rate limit after each request to determine whether the client is ready for the next request.
        this.refresh(error?.response?.headers);

        // Updates busy status.
        this.busy = false;

        // Returns the error.
        logger.info(`[client-${this.getToken()}] Query: url=${url}`);
        logger.error(`[client-${this.getToken()}] Error: ${error.message}`);
        return Promise.reject(error);
      });
  }

  /**
   * Updates the rate limit of the client (based on the token) and changes its availability if necessary.
   * @param {Object} headers THe headers of the request.
   * @returns {void}
   */
  refresh(headers) {
    if (
      headers &&
      headers['x-ratelimit-remaining'] &&
      headers['x-ratelimit-reset']
    ) {
      this.remainingRequests = Number.parseInt(
        headers['x-ratelimit-remaining'],
      );
      this.resetAt = Number.parseInt(headers['x-ratelimit-reset']) * 1000; // * 1000 to convert seconds to milliseconds.
      // Pauses until the reset time if the client has no remaining requests.
      if (this.remainingRequests - this.safetyRemainingRequestCount <= 0) {
        this.pause(this.resetAt);
      }
      logger.info(
        `[client-${this.getToken()}] Rate limit: rate_limit=${this.remainingRequests}`,
      );
      logger.info(
        `[client-${this.getToken()}] Reset time: reset_time=${new Date(this.resetAt).toISOString()}`,
      );
    } else {
      this.pause(Date.now() + 1000 * 60); // Pause for 1 minute.
    }
  }

  /**
   * Pauses the client until the reset time. The resuming is automatically defined based on the reset time.
   * @param {Date} resetAt The reset date time at which the client will be authorized again.
   * @returns {void}
   */
  pause(resetAt) {
    // Pauses the client.
    this.authorized = false;
    logger.info(
      `[client-${this.getToken()}] Pause: reset_at=${new Date(resetAt).toISOString()}`,
    );
    // Plans the client resume after the reset time.
    setTimeout(
      () => {
        this.resume();
        logger.info(`[client-${this.getToken()}] Resume`);
      },
      resetAt - Date.now() + this.tokenResumeBufferTime,
    );
  }

  /**
   * Resumes the client after a pause period.
   */
  resume() {
    this.authorized = true;
  }

  /**
   * Gets a shortened version of the token.
   * @returns {string} The shortened token.
   */
  getToken() {
    return this.token.substring(this.token.length - 5);
  }
}

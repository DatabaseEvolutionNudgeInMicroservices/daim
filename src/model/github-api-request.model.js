/**
 * Represents a GitHub search API request.
 */
export class GitHubApiRequest {
  constructor(url, params = {}, callback = () => {}) {
    this.url = url;
    this.params = params;
    this.callback = callback;
  }

  /**
   * Gives the URL of the request.
   * @returns The URL of the request.
   */
  getUrl() {
    return this.url;
  }

  /**
   * Gives the parameters of the request.
   * @returns The parameters of the request.
   */
  getParams() {
    return this.params;
  }

  /**
   * Gives the callback function to execute on given results.
   * @returns The callback function to execute on results.
   */
  getCallback() {
    return this.callback;
  }

  /**
   * Runs the callback function to execute on given results.
   * @returns The callback function to execute on results.
   */
  runCallback(results) {
    return this.callback(results);
  }
}

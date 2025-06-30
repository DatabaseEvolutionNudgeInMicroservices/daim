// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import { GitHubApiRequest } from '../model/github-api-request.model.js';
import { GitHubApiClient } from '../helper/github-api-client.helper.js';
import { GitHubApiQueue } from '../helper/github-api-queue.helper.js';

/**
 * Represents a process to filter the search space.
 */
class ProcessFilter extends Process {
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

    // Constants.
    this.GITHUB_API_CLIENT_STARTUP_DELAY = 60; // 60 sec. of delay.
    this.MIN_STARS = 100;
    this.MIN_UPDATED_DATE = new Date(Date.UTC(2015, 0, 1)); // January 1st, 2015
    this.MIN_FOLDERS = 2;
    this.MIN_README_FILES = 1;
    this.MIN_CONTRIBUTORS = 1;
    this.MIN_COMMITS = 100;
    this.LANGUAGES = [
      'Python',
      'C',
      'C++',
      'C#',
      'Java',
      'JavaScript',
      'TypeScript',
      'Scala',
      'Go',
      'PHP',
      'Ruby',
    ];

    // Working variables.
    this.repositoryTotalCount = 0;
    this.repositoryCurrentCount = 0;
  }

  /**
   * Executes the process to filter repositories looking for non-trivial repositories.
   */
  process() {
    this.githubApiQueue.start();

    const progress = () => {
      this.repositoryCurrentCount++;
      logger.info(
        `[filter] Progress: ${this.repositoryCurrentCount}/${this.repositoryTotalCount} repositories`,
      );
      if (
        this.repositoryCurrentCount +
          this.githubApiQueue.getRequestFailCount() >=
          this.repositoryTotalCount &&
        this.githubApiQueue.getQueueLength() === 0
      ) {
        this.githubApiQueue.stop();
        this.mongoDb.disconnect();
        return;
      }
    };

    const filter = () => {
      // Generates pages queries.
      this.mongoDb.getRanges().then((ranges) => {
        ranges.forEach((range) => {
          // Develops results of each page.
          for (let page = range.pageCount; page > 0; page--) {
            // ---
            // FILTER: size 500..1000000 && stars >= 100
            // ---
            const query = `size:${range.sizeMin}..${range.sizeMax} stars:>=${this.MIN_STARS}`;
            const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=100&page=${page}`;
            this.githubApiQueue.push(
              new GitHubApiRequest(url, {}, (result) => {
                for (let i = 0; i < result.data.items.length; i++) {
                  let repository = result.data.items[i];
                  // ---
                  // FILTER: last commit date >= 2015-01-01
                  // ---
                  const fullName = repository.full_name;
                  const defaultBranch = repository.default_branch;
                  const updatedAt = new Date(repository.pushed_at);
                  if (updatedAt >= this.MIN_UPDATED_DATE) {
                    // ---
                    // FILTER: folder count >= 2 && readme files exist
                    // ---
                    const url = `https://api.github.com/repos/${fullName}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`;
                    this.githubApiQueue.push(
                      new GitHubApiRequest(url, {}, (result) => {
                        const items = result.data.tree;
                        const folders = items
                          .filter((item) => item.type === 'tree')
                          .map((item) => item.path);
                        const files = items
                          .filter((item) => item.type === 'blob')
                          .map((item) => item.path);
                        const readmeRegex =
                          /[a-zA-Z0-9\._-]*(\/[a-zA-Z0-9\._-]*)*[a-zA-Z0-9\._-]*readme[a-zA-Z0-9_-]*(\.(md|txt|html|markdown|mdown|mkdn|rst|doc|adoc|asciidoc|asc|wiki|mediawiki|org|rdoc))?$/i;
                        const readmeFiles = files.filter((file) =>
                          readmeRegex.test(file),
                        );
                        const dockerComposeRegex =
                          /.*docker-compose.*\.ya?ml$/i;
                        const dockerComposeFiles = files.filter((file) =>
                          dockerComposeRegex.test(file),
                        );
                        const servicesFolderRegex = /service(s*)$/i;
                        const serviceFolders = folders.filter((folder) =>
                          servicesFolderRegex.test(folder),
                        );
                        const servicesFilesRegex =
                          /[a-zA-Z0-9\._-]*(\/[a-zA-Z0-9\._-]*)*[a-zA-Z0-9\._-]*services?[a-zA-Z0-9_-]*(\.[a-zA-Z0-9]+)*$/i;
                        const serviceFiles = files.filter((file) =>
                          servicesFilesRegex.test(file),
                        );
                        if (
                          folders.length >= this.MIN_FOLDERS &&
                          readmeFiles.length >= this.MIN_README_FILES
                        ) {
                          // ---
                          // FILTER: commit count >= 100
                          // ---
                          const url = `https://api.github.com/repos/${fullName}/commits?per_page=1`;
                          this.githubApiQueue.push(
                            new GitHubApiRequest(url, {}, (result) => {
                              const commitCount = result.headers.link
                                ? Number.parseInt(
                                    result.headers.link.match(
                                      /page=(\d+)>; rel="last"/,
                                    )?.[1],
                                  )
                                : 1;
                              if (commitCount >= this.MIN_COMMITS) {
                                // ---
                                // FILTER: contributor count >= 1
                                // ---
                                const url = `https://api.github.com/repos/${fullName}/contributors?per_page=${this.MIN_CONTRIBUTORS}`;
                                this.githubApiQueue.push(
                                  new GitHubApiRequest(url, {}, (result) => {
                                    const contributorCount = result.headers.link
                                      ? Number.parseInt(
                                          result.headers.link.match(
                                            /page=(\d+)>; rel="last"/,
                                          )?.[1],
                                        )
                                      : 1;

                                    if (
                                      contributorCount >= this.MIN_CONTRIBUTORS
                                    ) {
                                      // ---
                                      // FILTER: at least one of the most common languages in microservice is used
                                      // ---
                                      const url = `https://api.github.com/repos/${fullName}/languages`;
                                      this.githubApiQueue.push(
                                        new GitHubApiRequest(
                                          url,
                                          {},
                                          (result) => {
                                            const languages = result.data;
                                            let hasLanguage =
                                              this.LANGUAGES.some(
                                                (language) =>
                                                  languages[language],
                                              );
                                            if (hasLanguage) {
                                              this.mongoDb
                                                .saveRepository(
                                                  fullName,
                                                  repository.html_url,
                                                  defaultBranch,
                                                  repository.owner.login,
                                                  repository.name,
                                                  repository.description,
                                                  repository.topics,
                                                  new Date(
                                                    repository.created_at,
                                                  ).toISOString(),
                                                  updatedAt.toISOString(),
                                                  repository.size,
                                                  repository.stargazers_count,
                                                  commitCount,
                                                  contributorCount,
                                                  folders.length,
                                                  serviceFolders,
                                                  serviceFiles,
                                                  readmeFiles,
                                                  [],
                                                  dockerComposeFiles,
                                                  [],
                                                  [],
                                                  [],
                                                  -1,
                                                  [],
                                                  Object.keys(languages),
                                                  'repositories',
                                                )
                                                .then(() => {
                                                  progress();
                                                });
                                            } else {
                                              progress();
                                            }
                                          },
                                        ),
                                      );
                                    } else {
                                      progress();
                                    }
                                  }),
                                );
                              } else {
                                progress();
                              }
                            }),
                          );
                        } else {
                          progress();
                        }
                      }),
                    );
                  } else {
                    progress();
                  }
                }
              }),
            );
            logger.info(
              `[filter] Page: range=${range.sizeMin}..${range.sizeMax}, page=${page}`,
            );
          }
        });
      });
    };

    this.mongoDb
      .connect()
      .then(() => {
        this.mongoDb
          .getRepositoryCount()
          .then((repositoryTotalCount) => {
            // Repository count for monitoring the progess.
            this.repositoryTotalCount = repositoryTotalCount;
            // Shifted startup of GitHub search API clients.
            for (let i = 1; i < this.githubApiClients.length; i++) {
              this.githubApiClients[i].pause(
                Date.now() + 1000 * this.GITHUB_API_CLIENT_STARTUP_DELAY * i,
              );
            }
            // Process entry point.
            filter();
          })
          .catch((error) => {
            reject(error);
          });
      })
      .catch((error) => {
        logger.error(`[filter] ${error.message}`);
      });
  }
}

let processFilter = new ProcessFilter();
processFilter.process();

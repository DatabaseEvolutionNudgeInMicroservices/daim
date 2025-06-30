// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import { GitHubApiRequest } from '../model/github-api-request.model.js';
import { GitHubApiClient } from '../helper/github-api-client.helper.js';
import { GitHubApiQueue } from '../helper/github-api-queue.helper.js';

/**
 * Represents a process to enrich the repositories data.
 */
class ProcessEnrichReadme extends Process {
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

    // Working variables.
    this.repositoryTotalCount = 0;
    this.repositoryCurrentCount = 0;
  }

  /**
   * Executes the process to enrich repositories.
   */
  process() {
    this.githubApiQueue.start();

    const enrich = async () => {
      // Retrieve repositories.
      const cursor = await this.mongoDb.getRepositories('repositories');
      while (await cursor.hasNext()) {
        let repository = await cursor.next();
        // ---
        // ENRICH: README files
        // ---
        let { readme_files } = repository;
        let readmeFiles = readme_files.map(
          (file) => (!file.includes('/') ? file : null), // Only root README files.
        );
        for (let i = 0; i < readmeFiles.length; i++) {
          const file = readmeFiles[i];
          if (file) {
            const url = `https://api.github.com/repos/${repository._id}/contents/${encodeURIComponent(file)}`;
            this.githubApiQueue.push(
              new GitHubApiRequest(url, {}, (result) => {
                if (result && result.data) {
                  let content = '';
                  if (result.data.content) {
                    content = Buffer.from(
                      result.data.content,
                      'base64',
                    ).toString('utf-8');
                  }
                  if (!repository.readme_files_content[i]) {
                    repository.readme_files_content[i] = content;
                    this.mongoDb.saveRepository(
                      repository._id,
                      repository.url,
                      repository.branch,
                      repository.owner,
                      repository.title,
                      repository.description,
                      repository.topics,
                      repository.creation_date,
                      repository.last_updated_date,
                      repository.size,
                      repository.stars_count,
                      repository.commits_count,
                      repository.contributors_count,
                      repository.folders_count,
                      repository.services_directories,
                      repository.services_files,
                      repository.readme_files,
                      repository.readme_files_content,
                      repository.docker_compose_files,
                      repository.docker_compose_files_content,
                      repository.istio_files,
                      repository.istio_files_content,
                      -1,
                      [],
                      repository.languages,
                      'repositories',
                    );
                  }
                  logger.info(
                    `[enrich-readme] Repository: repository_id=${repository._id}, file=${file}`,
                  );
                }
              }),
            );
          }
        }
      }
    };

    this.mongoDb
      .connect()
      .then(() => {
        enrich(); // Process entry point.
      })
      .catch((error) => {
        logger.error(`[enrich-readme] ${error.message}`);
      });
  }
}

let enrichReadme = new ProcessEnrichReadme();
enrichReadme.process();

// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import * as path from 'path';
import * as CSVWriter from 'csv-writer';
import { Process } from './process.process.js';

/**
 * Represents a process to distinguish the repositories.
 */
class ProcessDistinguish extends Process {
  constructor() {
    super();

    // Dependencies.
    this.env = new Env(); // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.
    let createCsvWriter = CSVWriter.createObjectCsvWriter;
    this.csvWriter = createCsvWriter({
      path: path.join('results', 'distinguish.csv'),
      header: [
        { id: 'repository', title: 'REPOSITORY' },
        // { id: 'title_keywords', title: 'TITLE_KEYWORDS' },
        // { id: 'description_keywords', title: 'DESCRIPTION_KEYWORDS' },
        // { id: 'topics_keywords', title: 'TOPICS_KEYWORDS' },
        // { id: 'readme_keywords', title: 'README_KEYWORDS' },
        // { id: 'services_directories', title: 'SERVICES_DIRECTORIES' },
        // { id: 'services_files', title: 'SERVICES_FILES' },
        // { id: 'docker_compose_files', title: 'DOCKER_COMPOSE_FILES' },
        { id: 'docker_compose_services', title: 'DOCKER_COMPOSE_SERVICES' },
        { id: 'languages', title: 'LANGUAGES' },
        { id: 'databases', title: 'DATABASES' },
        { id: 'score', title: 'SCORE' },
      ],
    });

    // Constants.
    this.inclusiveKeywords = [
      'microservice',
      'microservices',
      'micro-service',
      'micro-services',
      'micro service',
      'micro services',
      'rest api',
      'monorepo',
      'mono-repo',
      'multi-repo',
      'multirepo',
    ];
    this.inclusiveKeywordsRegex = new RegExp(
      `\\b(${this.inclusiveKeywords.join('|')})\\b`,
      'gi',
    );
  }

  /**
   * Executes the process to distinguish repositories.
   */
  process() {
    const distinguish = async () => {
      // Retrieve repositories.
      let records = [];
      const cursor = await this.mongoDb.getRepositories('repositories');
      while (await cursor.hasNext()) {
        let repository = await cursor.next();
        let score = 0;
        let {
          _id,
          title,
          description,
          topics,
          readme_files_content,
          services_directories,
          services_files,
          docker_compose_files,
          docker_compose_files_content,
          services_count,
          databases,
          languages,
        } = repository;

        // ---
        // DISTINGUISH: services count
        // ---
        if (services_count > 0) {
          score++;

          // ---
          // DISTINGUISH: title
          // ---
          let titleKeywords = title?.match(this.inclusiveKeywordsRegex) || [];
          if (titleKeywords.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: description
          // ---
          let descriptionKeywords =
            description?.match(this.inclusiveKeywordsRegex) || [];
          if (descriptionKeywords.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: topics
          // ---
          let topicsKeywords = [];
          topics?.forEach(
            (topic) =>
              (topicsKeywords = topicsKeywords.concat(
                topic.match(this.inclusiveKeywordsRegex) || [],
              )),
          );
          if (topicsKeywords.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: readme
          // ---
          let readmeKeywords = [];
          readme_files_content?.forEach((readme) => {
            if (readme)
              readmeKeywords = readmeKeywords.concat(
                readme.match(this.inclusiveKeywordsRegex) || [],
              );
          });
          if (readmeKeywords.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: services directories
          // ---
          if (services_directories.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: services files
          // ---
          if (services_files.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: docker-compose files
          // ---
          if (docker_compose_files.length > 0) {
            score++;
          }

          // ---
          // DISTINGUISH: databases
          // ---
          if (databases.length > 0) {
            score++;
          }

          // Writing results.
          if (
            score > 0 &&
            titleKeywords.length +
              descriptionKeywords.length +
              topicsKeywords.length +
              readmeKeywords.length >
              0 &&
            databases.length > 0 &&
            services_count > databases.length
          ) {
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
              repository.services_count,
              repository.databases,
              repository.languages,
              'repositories_microservices',
            );

            records.push({
              repository: _id,
              // title_keywords: titleKeywords.length,
              // description_keywords: descriptionKeywords.length,
              // topics_keywords: topicsKeywords.length,
              // readme_keywords: readmeKeywords.length,
              // services_directories: services_directories.length,
              // services_files: services_files.length,
              // docker_compose_files: docker_compose_files_content.length,
              docker_compose_services: services_count,
              languages: languages,
              databases: databases,
              score: score,
            });
          }
        }
      }
      this.csvWriter.writeRecords(records).then(() => {
        logger.info('[distinguish] Done');
        this.mongoDb.disconnect();
      });
    };

    this.mongoDb
      .connect()
      .then(() => {
        distinguish(); // Process entry point.
      })
      .catch((error) => {
        logger.error(`[distinguish] ${error.message}`);
      });
  }
}

let processDistinguish = new ProcessDistinguish();
processDistinguish.process();

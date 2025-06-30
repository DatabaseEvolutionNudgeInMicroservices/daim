// IMPORTS

import { MongoClient } from 'mongodb';
import { logger } from '../helper/logger.helper.js';

/**
 * Manages the MongoDB database.
 */
export class MongoDB {
  constructor(url, dbName) {
    this.mongoDbURL = url;
    this.mongoDbName = dbName;
    this.mongoDbClient = new MongoClient(this.mongoDbURL);
  }

  /**
   * Connects to the MongoDB database.
   */
  async connect() {
    try {
      await this.mongoDbClient.connect();

      this.db = this.mongoDbClient.db(this.mongoDbName);
      logger.info('[mongo] MongoDB connection success');
    } catch (error) {
      logger.error(`[mongo] MongoDB connection error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Disconnects from the MongoDB database.
   */
  disconnect() {
    this.mongoDbClient.close();
    logger.info('[mongo] MongoDB connection closed');
  }

  /**
   * Inserts a range in the MongoDB database.
   * @param {int} sizeMin The minimum size of the range targeted in KB.
   * @param {int} sizeMax The maximum size of the range targeted in KB.
   * @param {int} resultCount The number of results in the targeted range.
   */
  async saveRange(sizeMin, sizeMax, resultCount) {
    try {
      const collection = this.db.collection('ranges');
      const pageCount = Math.ceil(resultCount / 100);
      const range_id = `${sizeMin}..${sizeMax}`;
      await collection.updateOne(
        { _id: range_id },
        {
          $setOnInsert: {
            _id: range_id,
            sizeMin,
            sizeMax,
            resultCount,
            pageCount,
            timestamp: new Date(),
          },
        },
        { upsert: true },
      );

      logger.info(
        `[mongo] Insertion: sizeMin=${sizeMin}, sizeMax=${sizeMax}, resultCount=${resultCount}, pageCount=${pageCount}`,
      );
    } catch (error) {
      logger.error(`[mongo] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieves the ranges from the MongoDB database.
   * @returns Returns an array of ranges.
   */
  async getRanges() {
    try {
      const collection = this.db.collection('ranges');
      return await collection.find({}).toArray();
    } catch (error) {
      logger.error(`[mongo] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Inserts a repository in the MongoDB database.
   * @param {string} repository_id  The id of the repository.
   * @param {string} url The URL of the repository.
   * @param {string} branch The default branch of the repository.
   * @param {string} owner The owner of the repository.
   * @param {string} title The title of the repository.
   * @param {string} description The description of the repository.
   * @param {string} topics The topics of the repository.
   * @param {Date} creation_date The creation date of the repository.
   * @param {Date} last_updated_date The last updated date of the repository.
   * @param {int} size The size of the repository.
   * @param {int} stars_count The number of stars of the repository.
   * @param {int} commits_count The number of commits of the repository.
   * @param {int} contributors_count The number of contributors of the repository.
   * @param {int} folders_count The number of folders of the repository.
   * @param {[string]} services_directories The list of services directories.
   * @param {[string]} services_files The list of services files.
   * @param {[string]} readme_files The list of README files.
   * @param {[string]} readme_files_content The content of README files.
   * @param {[string]} docker_compose_files The list of Docker Compose files.
   * @param {[string]} docker_compose_files_content The content of Docker Compose files.
   * @param {[string]} istio_files The list of Istio files.
   * @param {[string]} istio_files_content The content of Istio files.
   * @param {number} services_count The number of services detected.
   * @param {[string]} databases The databases used in the repository.
   * @param {[string]} languages The languages used in the repository.
   * @param {[string]} collectionName The repository collection name where the repository must be saved.
   * @returns {Promise<void>}
   */
  async saveRepository(
    repository_id,
    url,
    branch,
    owner,
    title,
    description,
    topics,
    creation_date,
    last_updated_date,
    size,
    stars_count,
    commits_count,
    contributors_count,
    folders_count,
    services_directories,
    services_files,
    readme_files,
    readme_files_content = [],
    docker_compose_files = [],
    docker_compose_files_content = [],
    istio_files = [],
    istio_files_content = [],
    services_count = -1,
    databases = [],
    languages,
    collectionName,
  ) {
    try {
      // Input validation
      if (!repository_id || typeof repository_id !== 'string') {
        throw new Error('Invalid repository_id parameter');
      }
      if (!url || typeof url !== 'string') {
        throw new Error('Invalid URL parameter');
      }
      if (!branch || typeof branch !== 'string') {
        throw new Error('Invalid branch parameter');
      }
      if (!owner || typeof owner !== 'string') {
        throw new Error('Invalid owner parameter');
      }
      if (!title || typeof title !== 'string') {
        throw new Error('Invalid title parameter');
      }
      if (!topics || !Array.isArray(topics)) {
        throw new Error('Invalid topics parameter');
      }
      if (!creation_date || typeof creation_date !== 'string') {
        throw new Error('Invalid creation_date parameter');
      }
      if (!last_updated_date || typeof last_updated_date !== 'string') {
        throw new Error('Invalid last_updated_date parameter');
      }
      if (typeof size !== 'number' || size < 0) {
        throw new Error('Invalid size parameter');
      }
      if (typeof stars_count !== 'number' || stars_count < 0) {
        throw new Error('Invalid stars_count parameter');
      }
      if (typeof commits_count !== 'number' || commits_count < 0) {
        throw new Error('Invalid commits_count parameter');
      }
      if (typeof contributors_count !== 'number' || contributors_count < 0) {
        throw new Error('Invalid contributors_count parameter');
      }
      if (typeof folders_count !== 'number' || folders_count < 0) {
        throw new Error('Invalid folders_count parameter');
      }
      if (!services_directories || !Array.isArray(services_directories)) {
        throw new Error('Invalid services_directories parameter');
      }
      if (!services_files || !Array.isArray(services_files)) {
        throw new Error('Invalid services_files parameter');
      }
      if (!readme_files || !Array.isArray(readme_files)) {
        throw new Error('Invalid readme_files parameter');
      }
      if (!readme_files_content || !Array.isArray(readme_files_content)) {
        throw new Error('Invalid readme_files_content parameter');
      }
      if (!docker_compose_files || !Array.isArray(docker_compose_files)) {
        throw new Error('Invalid docker_compose_files parameter');
      }
      if (
        !docker_compose_files_content ||
        !Array.isArray(docker_compose_files_content)
      ) {
        throw new Error('Invalid docker_compose_files_content parameter');
      }
      if (!istio_files || !Array.isArray(istio_files)) {
        throw new Error('Invalid istio_files parameter');
      }
      if (!istio_files_content || !Array.isArray(istio_files_content)) {
        throw new Error('Invalid istio_files_content parameter');
      }
      if (typeof services_count !== 'number') {
        throw new Error('Invalid services_count parameter');
      }
      if (!languages || !Array.isArray(languages)) {
        throw new Error('Invalid languages parameter');
      }
      if (!databases || !Array.isArray(databases)) {
        throw new Error('Invalid databases parameter');
      }

      const collection = this.db.collection(collectionName);
      await collection
        .updateOne(
          { _id: repository_id },
          {
            $set: {
              _id: repository_id,
              url,
              branch,
              owner,
              title,
              description,
              topics,
              creation_date,
              last_updated_date,
              size,
              stars_count,
              commits_count,
              contributors_count,
              folders_count,
              services_directories,
              services_files,
              readme_files,
              readme_files_content,
              docker_compose_files,
              docker_compose_files_content,
              istio_files,
              istio_files_content,
              services_count,
              languages,
              databases,
              timestamp: new Date(),
            },
          },
          { upsert: true },
        )
        .then(() => {
          logger.info(`[mongo] Insertion: id=${repository_id}, url=${url}`);
        })
        .catch((error) => {
          logger.error(`[mongo] Error: ${error.message}`);
        });

      /*
      logger.info(
        `[mongo] Insertion: id=${repository_id}, url=${url}, branch=${branch}, owner=${owner}, title=${title}, description=${description}, topics=${topics}, creation_date=${creation_date}, last_updated_date=${last_updated_date}, size=${size}, stars_count=${stars_count}, commits_count=${commits_count}, contributors_count=${contributors_count}, folders_count=${folders_count}, services_directories=${services_directories}, services_files=${services_files}, readme_files=${readme_files}, docker_compose_files=${docker_compose_files}, istio_files=${istio_files}, services_count=${services_count}, databases=${databases}, languages=${languages}}`,
      );
      */
    } catch (error) {
      logger.error(`[mongo] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Retrieves the repositories from the MongoDB database.
   * @param collectionName The repository collection name.
   * @returns Returns an array of repositories.
   */
  async getRepositories(collectionName) {
    try {
      const collection = this.db.collection(collectionName);
      return collection.find({});
    } catch (error) {
      logger.error(`[mongo] Error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gets the repository count from the MongoDB database.
   * @returns Returns the repository count of repositories.
   */
  async getRepositoryCount() {
    try {
      const collection = this.db.collection('ranges');
      const result = await collection
        .aggregate([
          {
            $group: {
              _id: 'total amount of repositories in ranges',
              total: { $sum: '$resultCount' },
            },
          },
        ])
        .toArray();
      return result.length > 0 ? result[0].total : 0;
    } catch (error) {
      logger.error(`[mongo] Error: ${error.message}`);
      throw error;
    }
  }
}

export default MongoDB;

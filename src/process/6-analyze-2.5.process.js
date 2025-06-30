// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import fs from 'fs';
import path from 'path';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze25 extends Process {
  constructor() {
    super();
    // Dependencies.
    this.env = new Env();

    // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.

    this.TOP_DATABASE_TECHNOLOGIES = [
      'PostgreSQL',
      'Redis',
      'MongoDB',
      'Elasticsearch',
      'ApacheCassandra',
      'InfluxDB',
      'Milvus',
      'EventstoreDB',
      'Neo4j',
      'PostGIS',
    ];
  }

  /**
   * Executes the process to analyze repositories.
   */
  process() {
    const chart = (sets, intersections) =>
      `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Databases in Microservices</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: left; }
          </style>
      </head>
      <body>
      <h1>Top Database Technology Associations</h1>
      <div id="chart"><h2>Sets</h2>` +
      sets.map((s) => '<p>' + s.technology + ' = ' + s.size + '</p>').join('') +
      '<h2>Intersections</h2>' +
      //'<p style="color:red;">NOTE: Only non-empty are displayed!</p>' +
      intersections
        .map((i) => '<p>' + i.technology + ' = ' + i.size + '</p>')
        .join('') +
      `</div>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: database technologies co-usage in microservices as sets notations.
      // ---

      // Functions.

      const getSubsets = (arr) => {
        let subsets = [];
        const totalSubsets = Math.pow(2, arr.length);
        for (let i = 0; i < totalSubsets; i++) {
          let subset = [];
          for (let j = 0; j < arr.length; j++) {
            if (i & (1 << j)) {
              subset.push(arr[j]);
            }
          }
          subsets.push(subset);
        }
        return subsets;
      };

      // Variables.

      let microservices = [];

      let sets = [];
      let intersections = [];

      let databaseTechnologiesCombinations = [];
      let databaseTechnologiesCombinationsLabels = [];

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        microservices.push(microservice); // Microservice.
      }

      databaseTechnologiesCombinations = getSubsets(
        this.TOP_DATABASE_TECHNOLOGIES,
      ); // Database technologies combinations.

      databaseTechnologiesCombinations.shift(); // Empty removing.

      databaseTechnologiesCombinationsLabels =
        databaseTechnologiesCombinations.map((s) => {
          if (s.length === 1) {
            // Single database
            return (
              s +
              ' \\ { ' +
              this.TOP_DATABASE_TECHNOLOGIES.reduce((acc, database) => {
                if (database !== s) {
                  acc.push(database);
                }
                return acc;
              }, []).join(' ∪ ') +
              ' }'
            );
          } else {
            // Multiple databases
            return s.map((c) => c).join(' ∩ ');
          }
        }); // Labels generation.

      // Values.

      this.TOP_DATABASE_TECHNOLOGIES.forEach((technology) => {
        sets.push({
          technology: technology,
          size: microservices.reduce((acc, microservice) => {
            if (microservice.databases.includes(technology)) {
              acc += 1;
            }
            return acc;
          }, 0),
        });
      }); // Sets

      for (let i = 0; i < databaseTechnologiesCombinations.length; i++) {
        intersections.push({
          technology: databaseTechnologiesCombinationsLabels[i],
          size: microservices.reduce((acc, microservice) => {
            if (
              [
                ...new Set(
                  microservice.databases.filter((dbName) =>
                    this.TOP_DATABASE_TECHNOLOGIES.includes(dbName),
                  ),
                ),
              ]
                .sort()
                .toString() ===
              databaseTechnologiesCombinations[i].sort().toString()
            ) {
              acc += 1; // The database list is strictly equals to the combination tested.
            }
            return acc;
          }, 0),
        }); // Intersections
      }

      //intersections = intersections.filter((i) => i.size !== 0); // Empty set removing.

      // HTML file.

      let html = path.join('results', 'analyze-25.html');

      fs.writeFileSync(html, chart(sets, intersections), 'utf8');

      logger.info(`[analyze] Chart: ${html}`);

      this.mongoDb.disconnect();
    };

    this.mongoDb
      .connect()
      .then(() => {
        analyze(); // Process entry point.
      })
      .catch((error) => {
        logger.error(`[analyze] ${error.message}`);
      });
  }
}

let process25 = new ProcessAnalyze25();
process25.process();

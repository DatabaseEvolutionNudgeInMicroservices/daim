// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import fs from 'fs';
import path from 'path';
import { DATABASES } from '../constant/analyze.constant.js';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze24 extends Process {
  constructor() {
    super();
    // Dependencies.
    this.env = new Env();

    // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.

    // Constants.
    this.SLICE = 5; // Top database categories to analyze while excluding others.
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
      <h1>Database Categories Associations</h1>
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
      // ANALYZE: database co-usage in microservices as sets notations.
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

      let microservicesPerDatabaseCategory = {};

      let microservicesPerDatabaseTechnology = [];
      Object.keys(DATABASES).forEach((database) => {
        microservicesPerDatabaseTechnology.push({
          technology: database,
          category: DATABASES[database],
          count: 0,
        });
      });

      let databaseCategoriesCombinations = [];
      let databaseCategoriesCombinationsLabels = [];

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { databases } = microservice;

        microservices.push(microservice); // Microservice.

        databases.forEach((database) => {
          microservicesPerDatabaseTechnology.filter(
            (db) => db.technology === database,
          )[0].count += 1;
        }); // Microservices sum by database technology.
      }

      // Sorting.

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.filter((d) => d.count !== 0); // Empty database technology removing.

      microservicesPerDatabaseCategory =
        microservicesPerDatabaseTechnology.reduce((acc, database) => {
          if (acc[database.category]) {
            acc[database.category] += database.count;
          } else {
            acc[database.category] = database.count;
          }
          return acc;
        }, {}); // Microservices sum by database category.

      microservicesPerDatabaseCategory = Object.fromEntries(
        Object.entries(microservicesPerDatabaseCategory).sort(
          (a, b) => b[1] - a[1],
        ),
      ); // Database categories sorting by microservice occurences in descending order.

      microservicesPerDatabaseCategory = Object.fromEntries(
        Object.entries(microservicesPerDatabaseCategory).slice(0, this.SLICE),
      ); // Top database categories slicing.

      databaseCategoriesCombinations = getSubsets(
        Object.keys(microservicesPerDatabaseCategory),
      ); // Categories combinations generation.

      databaseCategoriesCombinations.shift(); // Empty removing.

      databaseCategoriesCombinationsLabels = databaseCategoriesCombinations.map(
        (s) => {
          if (s.length === 1) {
            // Single database
            return (
              s[0].substring(0, 1).toUpperCase() +
              ' \\ { ' +
              Object.keys(microservicesPerDatabaseCategory)
                .reduce((acc, database) => {
                  if (database !== s[0]) {
                    acc.push(database.substring(0, 1));
                  }
                  return acc;
                }, [])
                .join(' ∪ ') +
              ' }'
            );
          } else {
            // Multiple databases
            return s.map((c) => c.substring(0, 1).toUpperCase()).join(' ∩ ');
          }
        },
      ); // Labels generation.

      // Values.

      Object.keys(microservicesPerDatabaseCategory).forEach((category) => {
        sets.push({
          technology: category.substring(0, 1).toUpperCase(),
          size: microservices.reduce((acc, microservice) => {
            if (
              microservice.databases
                .map((dbName) => DATABASES[dbName])
                .includes(category)
            ) {
              acc += 1;
            }
            return acc;
          }, 0),
        });
      }); // Sets

      for (let i = 0; i < databaseCategoriesCombinations.length; i++) {
        intersections.push({
          technology: databaseCategoriesCombinationsLabels[i],
          size: microservices.reduce((acc, microservice) => {
            if (
              [
                ...new Set(
                  microservice.databases
                    .map((dbName) => DATABASES[dbName])
                    .filter(
                      (dbName) => microservicesPerDatabaseCategory[dbName],
                    ),
                ),
              ]
                .sort()
                .toString() ===
              databaseCategoriesCombinations[i].sort().toString()
            ) {
              acc += 1; // The database list is strictly equals to the combination tested.
            }
            return acc;
          }, 0),
        }); // Intersections
      }

      //intersections = intersections.filter((i) => i.size !== 0); // Empty set removing.

      // HTML file.

      let html = path.join('results', 'analyze-24.html');

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

let process24 = new ProcessAnalyze24();
process24.process();

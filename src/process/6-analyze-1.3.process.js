// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import fs from 'fs';
import path from 'path';
import {
  DATABASES,
  DATABASE_CATEGORIES,
} from '../constant/analyze.constant.js';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze13 extends Process {
  constructor() {
    super();
    // Dependencies.
    this.env = new Env();

    // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.
  }

  /**
   * Executes the process to analyze repositories.
   */
  process() {
    const chart = (
      databaseTechnologies,
      databaseCategories,
      totalMicroservices,
    ) =>
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Microservices per Database</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: left; }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
          }
        </style>
      </head>
      <body>
        <div id="graph">
        <h1>Microservices per Database Technologies</h1>
        <table>
        <tr>
          <th>Database</th>
          <th>Category</th>
          <th>Count</th>
          <th>Overal pourcentage</th>
          <th>Category pourcentage</th>
        </tr>
          ` +
      databaseTechnologies
        .map(
          (d) =>
            '<tr><td>' +
            d.technology +
            '</td><td>' +
            d.category +
            '</td><td>' +
            d.count +
            '</td><td>' +
            ((d.count / totalMicroservices) * 100).toFixed(2) +
            '%</td><td>' +
            (
              (d.count /
                databaseCategories.find((c) => c.category === d.category)
                  .count) *
              100
            ).toFixed(2) +
            '%</td></tr>',
        )
        .join('') +
      `
        </table>
        </div>
        <h1>Microservices per Database Categories</h1>
        <table>
        <tr>
          <th>Category</th>
          <th>Count</th>
          <th>Pourcentage</th>
        </tr>
          ` +
      databaseCategories
        .map(
          (c) =>
            '<td>' +
            c.category +
            '</td><td>' +
            c.count +
            '</td><td>' +
            ((c.count / totalMicroservices) * 100).toFixed(2) +
            '%</td></tr>',
        )
        .join('') +
      `
        </table>
        <br/>
        <p style="color:red;">NOTE: Percentages should be treated with caution. As some systems may have more than one database technology and/or more than one category, some databases may be counted more than once!</p>
        <p style="color: orange;">NOTE: A repository is counted in a category if it has at least one technology from it, and having more than one doesn't affect the count.</p>
        </div>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: microservices per database / table with database name, category name, count, and pourcentage columns ; table with category name, count, and pourcentage columns.
      // ---

      // Variables.

      let microservicesPerDatabaseTechnology = [];
      Object.keys(DATABASES).forEach((database) => {
        microservicesPerDatabaseTechnology.push({
          technology: database,
          category: DATABASES[database],
          count: 0,
        });
      });

      let microservicesPerDatabaseCategory = [];
      DATABASE_CATEGORIES.forEach((category) => {
        microservicesPerDatabaseCategory.push({
          category: category,
          count: 0,
        });
      });

      let totalMicroservices = 0;

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { databases } = microservice;

        databases.forEach((database) => {
          microservicesPerDatabaseTechnology.filter(
            (db) => db.technology === database,
          )[0].count += 1; // Microservices sum by database technology.
        });

        DATABASE_CATEGORIES.forEach((category) => {
          if (databases.some((db) => DATABASES[db] === category)) {
            microservicesPerDatabaseCategory.filter(
              (db) => db.category === category,
            )[0].count += 1; // Microservices sum by database category.
          }
        });

        totalMicroservices++;
      }

      // Sorting.

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.filter(
          (d) => d.count !== 0, // Empty technology removing.
        );

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.sort((a, b) => {
          return b.count - a.count; // Database categories sorting by microservice occurences in descending order.
        });

      microservicesPerDatabaseCategory =
        microservicesPerDatabaseCategory.filter(
          (d) => d.count !== 0, // Empty categories removing.
        );

      microservicesPerDatabaseCategory = microservicesPerDatabaseCategory.sort(
        (a, b) => {
          return b.count - a.count; // Database categories sorting by microservice occurences in descending order.
        },
      );

      // HTML file.

      let html = path.join('results', 'analyze-13.html');

      fs.writeFileSync(
        html,
        chart(
          microservicesPerDatabaseTechnology,
          microservicesPerDatabaseCategory,
          totalMicroservices,
        ),
        'utf8',
      );

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

let process13 = new ProcessAnalyze13();
process13.process();

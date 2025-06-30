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
class ProcessAnalyze43 extends Process {
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
      data,
      criteriaAge,
      criteriaAgeSign,
      microservicesPerDatabaseTechnology,
      microservicesPerDatabaseCategory,
    ) =>
      `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Databases per Microservice</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jstat/1.9.4/jstat.min.js"></script>
        <style>
          body { font-family: Arial, sans-serif; text-align: left; }
          table, th, td {
            border: 1px solid black;
            border-collapse: collapse;
          }
          th {
            width: 250px;
          }
        </style>
      </head>
      <body>
        <div id="graph">
        <h1>Aged Microservices Databases Selection</h1>
        <p>Criteria:</p>
        <p>Age: ${criteriaAgeSign}${criteriaAge}</p>
        <br />
        <p style="color: blue;">${data.length} microservice(s) found</p>
        <table>
        <tr>
          <th>Microservice</th>
          <th>Creation date</th>
          <th>Age</th>
          <th>Databases technologies</th>
          <th>Database categories</th>
        </tr>
          ` +
      data
        .map((d) => {
          return (
            '<tr><td><a href="https://www.github.com/' +
            d.id +
            '" target="_blank">' +
            d.id +
            '</a>' +
            '</td><td>' +
            d.creationDate +
            '</td><td>' +
            d.age +
            '</td><td>' +
            d.databases.join('<br/>') +
            '</td><td>' +
            d.categories.join('<br/>') +
            '</td></tr>'
          );
        })
        .join('') +
      `
        </table>
        
        <br />

        <table>
        <tr>
          <th>Database technology</th>
          <th>Count</th>
        </tr>
          ` +
      microservicesPerDatabaseTechnology
        .map((d) => {
          return '<td>' + d.technology + '</td><td>' + d.count + '</td></tr>';
        })
        .join('') +
      `
        </table>

        <br />

        <table>
        <tr>
          <th>Database categories</th>
          <th>Count</th>
        </tr>
          ` +
      Object.entries(microservicesPerDatabaseCategory)
        .map((d) => '<td>' + d[0] + '</td><td>' + d[1] + '</td></tr>')
        .join('');
    `
        </table>
        </div>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: aged microservice databases selection based on criteria.
      // ---

      // Variables.

      let data = [];
      let criteriaAgeSign = '>=';
      let criteriaAge = 13;
      //let criteriaAgeSign = '<=';
      //let criteriaAge = 2;
      let microservicesPerDatabaseTechnology = [];
      Object.keys(DATABASES).forEach((database) => {
        microservicesPerDatabaseTechnology.push({
          technology: database,
          category: DATABASES[database],
          count: 0,
        });
      });
      let microservicesPerDatabaseCategory = {};

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { _id, databases, creation_date } = microservice;
        let age = Math.floor(
          (Date.now() - new Date(creation_date).getTime()) /
            (1000 * 60 * 60 * 24 * 365),
        );
        if (criteriaAgeSign == '>=' ? age >= criteriaAge : age <= criteriaAge) {
          data.push({
            id: _id,
            creationDate: creation_date,
            age: age,
            databases: databases,
            categories: databases
              .map((dbName) => DATABASES[dbName])
              .reduce((acc, databaseCategory) => {
                if (!acc.includes(databaseCategory)) {
                  acc.push(databaseCategory);
                }
                return acc;
              }, []),
          }); // Microservices selection.

          databases.forEach((database) => {
            microservicesPerDatabaseTechnology.filter(
              (db) => db.technology === database,
            )[0].count += 1; // Microservices sum by database technology.
          });
        }
      }

      microservicesPerDatabaseCategory =
        microservicesPerDatabaseTechnology.reduce((acc, database) => {
          if (acc[database.category]) {
            acc[database.category] += database.count;
          } else {
            acc[database.category] = database.count;
          }
          return acc;
        }, {}); // Microservices sum by database category.

      // Sorting

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.filter(
          (d) => d.count !== 0, // Empty technology removing.
        );

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.sort((a, b) => {
          return b.count - a.count; // Database technologies sorting by microservice occurences in descending order.
        });

      microservicesPerDatabaseCategory = Object.fromEntries(
        Object.entries(microservicesPerDatabaseCategory).sort(
          (a, b) => b[1] - a[1],
        ), // Database categories sorting by total count of microservice occurences in descending order.
      );

      // HTML file.

      let html = path.join(
        'results',
        `analyze-43-${criteriaAgeSign == '>=' ? 'ge-' + criteriaAge : 'le-' + criteriaAge}.html`,
      );

      fs.writeFileSync(
        html,
        chart(
          data,
          criteriaAge,
          criteriaAgeSign,
          microservicesPerDatabaseTechnology,
          microservicesPerDatabaseCategory,
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

let process43 = new ProcessAnalyze43();
process43.process();

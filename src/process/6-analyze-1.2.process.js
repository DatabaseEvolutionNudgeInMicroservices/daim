// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import fs from 'fs';
import path from 'path';
import { DATABASES, DATABASE_COLORS } from '../constant/analyze.constant.js';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze12 extends Process {
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
    const chart = (labels, values, colors, categories) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Microservices per Database</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; }
          .legend {
            display: flex;
            flex-wrap: wrap;
            margin-top: 20px;
            width: 100%;
            justify-content: center;
          }
          .legend-item {
            display: flex;
            align-items: center;
            margin-right: 15px;
          }
          .legend-item span {
            font-family: Arial;
          }
          .legend-color-box {
            width: 20px;
            height: 20px;
            margin-right: 5px;
          }
        </style>
      </head>
      <body>
        <h1>Microservices per Database Technologies Grouped By Categories</h1>
        <div id="graph"></div>
        <div class="legend">
          ${Object.keys(categories)
            .map((category) => {
              return `
              <div class="legend-item">
                <div class="legend-color-box" style="background-color: ${DATABASE_COLORS[category]}"></div>
                <span>${category}</span>
              </div>
            `;
            })
            .join('')}
        </div>
    
        <script>
          var data = [{
            x: ${JSON.stringify(labels)},
            y: ${JSON.stringify(values)},
            type: 'bar',
            marker: {
              color: ${JSON.stringify(colors)}
            },
          }];
          
          var layout = {
            xaxis: {
              title: {
                text: 'Database technologies',
                standoff: 15
              },
              tickangle: -45,
              tickmode: 'array',
            },
            yaxis: {
              title: '# Microservices'
            },
            height: 600,
            margin: {
              b: 150
            }
          };
    
          Plotly.newPlot('graph', data, layout);
        </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: microservices per database / X = database technologies sorted in descending order by database categories according to overall microservice occurences and sorted by microservice occurences within the same category ; Y = microservice occurences.
      // ---

      // Variables.

      let microservicesPerDatabaseCategory = {};

      let microservicesPerDatabaseTechnology = [];
      Object.keys(DATABASES).forEach((database) => {
        microservicesPerDatabaseTechnology.push({
          technology: database,
          category: DATABASES[database],
          color: DATABASE_COLORS[DATABASES[database]],
          count: 0,
        });
      });

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
      }

      // Sorting.

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.filter(
          (d) => d.count !== 0, // Empty technology removing.
        );

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
        ), // Database categories sorting by total count of microservice occurences in descending order.
      );

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.sort((a, b) => {
          let order =
            Object.keys(microservicesPerDatabaseCategory).indexOf(a.category) -
            Object.keys(microservicesPerDatabaseCategory).indexOf(b.category);
          if (order !== 0) return order;
          return b.count - a.count; // Database technologies sorting by database categories and then microservice occurences in descending order.
        });

      // Labels.

      let labels = microservicesPerDatabaseTechnology.map((d) => d.technology);

      // Values.

      let values = microservicesPerDatabaseTechnology.map((d) => d.count);

      // Colors.

      let colors = microservicesPerDatabaseTechnology.map((d) => d.color);

      // HTML file.

      let html = path.join('results', 'analyze-12.html');

      fs.writeFileSync(
        html,
        chart(labels, values, colors, microservicesPerDatabaseCategory),
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

let process12 = new ProcessAnalyze12();
process12.process();

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
class ProcessAnalyze23 extends Process {
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
    const chart = (data) => `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Databases in Microservices</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; text-align: left; }
          </style>
      </head>
      <body>

      <h1>Database Categories Pairing</h1>

      <div id="chart"></div>

      <script>
      const elements = [...new Set(${JSON.stringify(data)}.flatMap(d => d.sets))];
      const n = elements.length;
      const matrix = Array.from({ length: n }, () => Array(n).fill(0));

      ${JSON.stringify(data)}.forEach(({ sets, size }) => {
          const [a, b] = sets;
          const i = elements.indexOf(a);
          const j = elements.indexOf(b);
          if (j <= i) {
            matrix[i][j] = size;
          }
      });

      const annotations = [];
      for (let i = 0; i < n; i++) {
          for (let j = 0; j < n; j++) {
              annotations.push({
                  x: elements[j],
                  y: elements[i],
                  text: matrix[i][j] && matrix[i][j] > 0 ? matrix[i][j].toString() + '%' : /*'0%'*/ '',
                  showarrow: false,
                  font: {
                      color: matrix[i][j] > 50 ? 'white' : 'black',
                      size: 14
                  }
              });
          }
      }

      const trace = {
          z: matrix,
          x: elements,
          y: elements,
          zmin: 0,     
          zmax: 100,
          type: 'heatmap',
          colorscale: 'Greys',
          reversescale: true,
          showscale: true,
      };

      const layout = {
          annotations: annotations,
          width: 900,
          height: 800,
          yaxis: {
            autorange: 'reversed'
          },
          xaxis: {
            side: 'top'
          }  
      };

      Plotly.newPlot('chart', [trace], layout);
      </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: database co-usage in microservices as a comparison matrix.
      // ---

      // Variables.

      let microservices = [];

      let sets = [];

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

      // Values.

      Object.keys(microservicesPerDatabaseCategory).forEach((categoryA) => {
        Object.keys(microservicesPerDatabaseCategory).forEach((categoryB) => {
          sets.push({
            sets: [categoryA, categoryB],
            size: (
              (microservices.reduce((acc, microservice) => {
                if (
                  microservice.databases
                    .map((dbName) => DATABASES[dbName])
                    .includes(categoryA) &&
                  microservice.databases
                    .map((dbName) => DATABASES[dbName])
                    .includes(categoryB)
                ) {
                  acc += 1;
                }
                return acc;
              }, 0) /
                microservices.length) *
              100
            ).toFixed(2),
          });
        });
      }); // Intersections.

      // HTML file.

      let html = path.join('results', 'analyze-23.html');

      fs.writeFileSync(html, chart(sets), 'utf8');

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

let process23 = new ProcessAnalyze23();
process23.process();

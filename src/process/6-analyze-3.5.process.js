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
class ProcessAnalyze35 extends Process {
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
      overallRatio1,
      overallRatio2,
      servicesCountMean,
      databasesCountMean,
      sizeCountMean,
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
        </style>
      </head>
      <body>
        <div id="graph">
        <h1>Services, Size, and Databases in Microservices</h1>
        <p style="color: blue;">Overall ratio 1 (( # services / # databases technologies ) / # ratios): ${overallRatio1.toFixed(2)}</p>
        <p style="color: blue;">Overall ratio 2 (( # databases technologies / # services ) / # ratios): ${overallRatio2.toFixed(2)}</p>
        <p style="color: blue;">Services count mean: ${servicesCountMean.toFixed(2)}</p>
        <p style="color: blue;">Database count mean: ${databasesCountMean.toFixed(2)}</p>
        <p style="color: blue;">Size count mean (in KB): ${sizeCountMean.toFixed(2)}</p>
        <table>
        <tr>
          <th>Microservices architecture</th>
          <th>Services</th>
          <th>Size</th>
          <th>Databases</th>
          <th>Ratio 1 ( # services / # databases technologies )</th>
          <th>Ratio 2 ( # databases technologies / # services )</th>
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
            d.nbServices +
            '</td><td>' +
            d.size +
            '</td><td>' +
            d.nbDatabases +
            '</td><td>' +
            d.ratio1.toFixed(2) +
            '</td><td>' +
            d.ratio2.toFixed(2) +
            '</td></tr>'
          );
        })
        .join('') +
      `
        </table>
        </div>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: microservice services and databases metrics.
      // ---

      // Variables.

      let data = [];
      let ratios1 = [];
      let ratios2 = [];
      let overallRatio1 = 0;
      let overallRatio2 = 0;
      let servicesCountMean = 0;
      let servicesCounts = [];
      let databasesCountMean = 0;
      let databasesCounts = [];
      let sizeCountMean = 0;
      let sizeCounts = [];

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { _id, databases, services_count, size } = microservice;
        let nbServices = services_count - databases.length;
        let nbDatabases = databases.length;
        let ratio1 = nbServices / nbDatabases;
        let ratio2 = nbDatabases / nbServices;
        data.push({
          id: _id,
          nbServices: nbServices,
          nbDatabases: nbDatabases,
          size: size,
          ratio1: ratio1,
          ratio2: ratio2,
        });
        ratios1.push(ratio1);
        ratios2.push(ratio2);
        databasesCounts.push(databases.length);
        servicesCounts.push(services_count);
        sizeCounts.push(size);
      }

      overallRatio1 = ratios1.reduce((acc, r) => acc + r) / ratios1.length;
      overallRatio2 = ratios2.reduce((acc, r) => acc + r) / ratios2.length;
      servicesCountMean =
        servicesCounts.reduce((acc, c) => acc + c) / servicesCounts.length;
      databasesCountMean =
        databasesCounts.reduce((acc, c) => acc + c) / databasesCounts.length;
      databasesCountMean =
        databasesCounts.reduce((acc, c) => acc + c) / databasesCounts.length;
      sizeCountMean =
        sizeCounts.reduce((acc, c) => acc + c) / sizeCounts.length;

      // HTML file.

      let html = path.join('results', 'analyze-35.html');

      fs.writeFileSync(
        html,
        chart(
          data,
          overallRatio1,
          overallRatio2,
          servicesCountMean,
          databasesCountMean,
          sizeCountMean,
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

let process35 = new ProcessAnalyze35();
process35.process();

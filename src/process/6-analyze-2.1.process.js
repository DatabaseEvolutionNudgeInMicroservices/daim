// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import { Process } from './process.process.js';
import fs from 'fs';
import path from 'path';
import {
  DATABASES,
  DATABASE_COLORS,
  DATABASE_TECHNICAL_NAMES,
} from '../constant/analyze.constant.js';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze21 extends Process {
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
      databases,
      microservices,
      values,
      colors,
      rateDatabaseHeterogeneity,
    ) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Databases per Microservice</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <style>
          body { font-family: Arial, sans-serif; text-align: left; }
        </style>
      </head>
      <body>
        <h1>Database Technologies per Microservices</h1>
        <p style="color:blue;">
          Heterogeneity rate (number of repositories with at least 2 database technologies on the total number of repositories): ${rateDatabaseHeterogeneity.toFixed(2) * 100} %
        </p>
        <div id="chart"></div>
        <script>
          var DATABASE_TECHNICAL_NAMES = ${JSON.stringify(DATABASE_TECHNICAL_NAMES)}
          // Data
          var data = [{
            x: ${JSON.stringify(databases)},
            y: ${JSON.stringify(microservices)},
            z: ${JSON.stringify(values)},
            type: 'heatmap',
            colorscale:  ${JSON.stringify(colors)},
            showscale: false,
            hovertemplate: 
            '<b>Database:</b> %{x}<br>' +
            '<b>Repository:</b> %{y}<br>' + 
            '<extra></extra>',
          }];

          // Layout
          var layout = {
            xaxis: {
              ticks: '',
              side: 'top',
              tickangle: -90,
              automargin: true,
              showgrid: false,
            },
            yaxis: {
              ticks: '',
              ticksuffix: ' ',
              side: 'left',
              automargin: true,
              showgrid: false,
            },
            height: ${microservices.length * 15},
            width: 2000,
            shapes: []
          };

          for (let i = 1; i < ${databases.length}; i += 1) {
            // Vertical lines
            layout.shapes.push({
                type: 'line',
                x0: i - 0.5,
                x1: i - 0.5,
                y0: -0.5,
                y1: ${microservices.length} - 0.5,
                line: {
                    color: 'white',
                    width: 1
                }
            });
          }

          for (let i = 0; i < ${microservices.length}; i += 1) {
            // Horizontal lines
            layout.shapes.push({
                type: 'line',
                x0: -0.5,
                x1: ${databases.length} - 0.5,
                y0: i - 0.5,
                y1: i - 0.5,
                line: {
                    color: '#eaeaea',
                    width: 1
                }
            });
          }

          Plotly.newPlot('chart', data, layout).then(function() {
            let plotDiv = document.getElementById('chart');
            plotDiv.on('plotly_click', function(eventData) {
              let point = eventData.points[0];
              let repositoryId = point.y;
              let database = point.x;
              window.open('https://github.com/search?q=repo%3A' + repositoryId + '%20' + DATABASE_TECHNICAL_NAMES[database] + '&type=code', '_blank');
            });
          });
        </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: databases per microservice / X = database technologies sorted in descending order by database categories according to overall microservice occurences and sorted by microservice occurences within the same category ; Y = microservices sorted in descending order by number of database (or sorted by alphabetical order).
      // ---

      // Variables.

      let microservices = [];

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

      let databaseTechnologyPerMicroservice = [];

      let labelsX = [];

      let labelsY = [];

      let values = [];

      let colors = [];

      let nbDatabaseHeterogeneity = 0;
      let rateDatabaseHeterogeneity = 0;

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
        }); // Microservices count by database technology.

        databaseTechnologyPerMicroservice.push({
          id: microservice._id,
          count: microservice.databases.length,
        }); // Database technologies per microservice.

        if (microservice.databases.length >= 2) {
          nbDatabaseHeterogeneity++; // Database heterogeneity count.
        }
      }

      rateDatabaseHeterogeneity =
        nbDatabaseHeterogeneity / microservices.length; // Database heterogeneity rate.

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
        ), // Database categories sorting by microservice occurences in descending order.
      );

      microservicesPerDatabaseTechnology =
        microservicesPerDatabaseTechnology.sort((a, b) => {
          let order =
            Object.keys(microservicesPerDatabaseCategory).indexOf(a.category) -
            Object.keys(microservicesPerDatabaseCategory).indexOf(b.category);
          if (order !== 0) return order;
          return b.count - a.count;
        }); // Database technologies sorting by categories and then microservices occurences in descending order.

      microservices = microservices.sort(
        (a, b) =>
          databaseTechnologyPerMicroservice.find((m) => m.id === a._id).count -
          databaseTechnologyPerMicroservice.find((m) => m.id === b._id).count,
      ); // Microservices sorting by number of databases.

      /*
      microservices = microservices.sort((a, b) => b._id.localeCompare(a._id)); // Microservices sorting by alphabetical order.
      */

      // Labels.

      labelsX = microservicesPerDatabaseTechnology.map((db) => db.technology);

      labelsY = microservices.map((r) => r._id);

      // Colors.

      const getColor = (databaseName) => {
        return (labelsX.indexOf(databaseName) + 1) / labelsX.length;
      };

      colors.push([0, 'transparent']);
      microservicesPerDatabaseTechnology.forEach((db) =>
        colors.push([getColor(db.technology), DATABASE_COLORS[db.category]]),
      );

      // Values.

      microservices.forEach((microservice) => {
        let value = labelsX.map((dbName) =>
          microservice.databases?.includes(dbName) ? getColor(dbName) : 0,
        );
        values.push(value);
      });

      // HTML file.

      let html = path.join('results', 'analyze-21.html');

      fs.writeFileSync(
        html,
        chart(labelsX, labelsY, values, colors, rateDatabaseHeterogeneity),
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

let process21 = new ProcessAnalyze21();
process21.process();

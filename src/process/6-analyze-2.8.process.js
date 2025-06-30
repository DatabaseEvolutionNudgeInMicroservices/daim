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
  DATABASE_COLORS,
} from '../constant/analyze.constant.js';

/**
 * Represents a process to analyze the repositories.
 */
class ProcessAnalyze28 extends Process {
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
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Databases per Microservice</title>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/jstat/1.9.4/jstat.min.js"></script>
        <style>
          body { font-family: Arial, sans-serif; text-align: left; }
        </style>
      </head>
      <body>
        <h1>Database Categories per Microservices</h1>
        <div id="chart"></div>
        <div id="details"></div>
        <script>
        
        // Data.

        const x = ${JSON.stringify(data.map((x) => x.id))};
        const y = ${JSON.stringify(data.map((x) => x.databaseCategories))};
        const xData = [];
        const yData = [];
        const colors = [];
        const DATABASE_COLORS = ${JSON.stringify(DATABASE_COLORS)};
        const DATABASE_CATEGORIES = ${JSON.stringify(DATABASE_CATEGORIES)};
        let sortedCategories = {};
        
        x.forEach((xi, i) => {
          DATABASE_CATEGORIES.forEach(yi => {
            xData.push(xi);
            yData.push(yi);
            if (y[i].includes(yi)) {
              colors.push(DATABASE_COLORS[yi]);
              if (!sortedCategories[yi]) {
                sortedCategories[yi] = 1;
              } else {
                sortedCategories[yi]++;
              }
            } else {
              colors.push('transparent');
            }
          });
        });

        sortedCategories =  Object.entries(sortedCategories)
          .sort((a, b) => b[1] - a[1])
          .map(([key]) => key);

        // Plot.

        const scatter = {
          x: xData,
          y: yData,
          mode: 'markers',
          type: 'scatter',
          name: '',
          marker: {
            opacity: 1,
            size: 5,
            color: colors
          },
          hovertemplate: '%{x}',
        };
        
        const plot = [scatter];

        // Layout.

        const layout = {
          xaxis: {
            title: { text: 'Repositories' },
            showticklabels: false,
          },
          yaxis: {
            title: { text: '' },
            categoryorder: 'array',
            categoryarray: sortedCategories,
          },
          hovermode: 'closest',
          height: 400,
          width: 2000,
          legend: {
            x: 1,
            xanchor: 'right',
            y: 1
          }
        };

        // Rendering.

        Plotly.newPlot('chart', plot, layout).then(() => {
          const chart = document.getElementById('chart');
          const details = document.getElementById('details');
          
          chart.on('plotly_click', function(data) {
            const x = data.points[0].x;

            while (details.firstChild) {
              details.removeChild(details.firstChild);
            }
            
            ${JSON.stringify(data)}
              .filter(m => m.id === x)
              .forEach(m => {
                details.innerHTML += \`
                <p>
                  <a href="https://www.github.com/\${m.id}" target="_blank">\${m.id}</a>
                  <ul>
                    <li># services: \${m.serviceCount}</li>
                    <li>Databases categories: \${m.databaseCategories.join(', ')}</li>
                  </ul>
                </p>\`;
              });
            });
          });
      </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: databases per microservice / X = microservices sorted by complexity (i.e., number of services in Docker Compose file excluding databases services) ; Y = database categories (i.e., database categories concerning services in Docker Compose file excluding non-database services).
      // ---

      // Variables.

      let data = [];

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { _id, databases, services_count } = microservice;
        let databaseCategories = databases
          .map((dbName) => DATABASES[dbName])
          .reduce((acc, databaseCategory) => {
            if (!acc.includes(databaseCategory)) {
              acc.push(databaseCategory);
            }
            return acc;
          }, []);
        data.push({
          id: _id,
          databases: databases,
          databaseCategories: databaseCategories,
          serviceCount: services_count,
        });
      }

      // Sorting

      //data = data.sort((a, b) => a.serviceCount - b.serviceCount); // Microservices sorting by service count.
      data = data.sort((a, b) => a.databases.length - b.databases.length); // Microservices sorting by database category count.

      // HTML file.

      let html = path.join('results', 'analyze-28.html');

      fs.writeFileSync(html, chart(data), 'utf8');

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

let process28 = new ProcessAnalyze28();
process28.process();

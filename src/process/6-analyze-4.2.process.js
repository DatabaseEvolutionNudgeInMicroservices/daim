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
class ProcessAnalyze42 extends Process {
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
        <h1>Microservices Age in Comparison with Database Categories</h1>
        <div id="histogram"></div>
        <hr />
        <div id="scatterPlot"></div>
        <hr />
        <div id="pValue"></div>
        <hr />
        <div id="details"></div>
        <script>
        
        // Data.

        const xData = ${JSON.stringify(data.map((x) => x.age))};
        const yData = ${JSON.stringify(data.map((x) => x.nbDatabaseCategories))};

        // Linear regression computing.

        function linearRegressionWithStats(x, y) {
        
          const n = x.length;
          const sumX = x.reduce((a, b) => a + b, 0);
          const sumY = y.reduce((a, b) => a + b, 0);
          const meanX = sumX / n;
          const meanY = sumY / n;

          let Sxx = 0, Sxy = 0;
          for (let i = 0; i < n; i++) {
            Sxx += (x[i] - meanX) ** 2;
            Sxy += (x[i] - meanX) * (y[i] - meanY);
          }

          const slope = Sxy / Sxx;
          const intercept = meanY - slope * meanX;

          let SSE = 0;
          for (let i = 0; i < n; i++) {
            const predicted = slope * x[i] + intercept;
            SSE += (y[i] - predicted) ** 2;
          }

          const SE = Math.sqrt(SSE / (n - 2));
          const SE_slope = SE / Math.sqrt(Sxx);
          const t_stat = slope / SE_slope;
          const p_value = 2 * (1 - jStat.studentt.cdf(Math.abs(t_stat), n - 2));
          const residuals = yData.map((y, i) => y - (slope * xData[i] + intercept));

          return { slope, intercept, residuals, p_value};
        }

        const { slope, intercept, residuals, p_value } = linearRegressionWithStats(xData, yData);

        // Linear regression line.

        const xMin = Math.min(...xData);
        const xMax = Math.max(...xData);
        const regressionLine = {
          x: [xMin, xMax],
          y: [slope * xMin + intercept, slope * xMax + intercept],
          mode: 'lines',
          type: 'scatter',
          name: 'Regression Line',
          line: { color: 'red' }
        };

        // Plots.

        const scatterPlot = {
          x: xData,
          y: yData,
          mode: 'markers',
          type: 'scatter',
          name: 'Repositories',
          marker: {
            opacity: 0.1,
            color: 'black',
            size: 10
          },
          hovertemplate: 'age: %{x}yo, # databases categories: %{y}',
        };
        
        const histogram = {
          x: residuals,
          type: 'histogram',
          name: 'Residuals Histogram',
          opacity: 0.6,
          marker: {color: 'blue'}
        };

        // Layouts.

        const layoutScatterPlot = {
          xaxis: {
            title: { text: 'age (in years)' }
          },
          yaxis: {
            title: { text: '# databases categories' }
          },
          hovermode: 'closest',
          height: 500,
          width: 500,
          legend: {
            x: 1,
            xanchor: 'right',
            y: 1
          }
        };

        const layoutHistogram = {
          title: 'Histogram of Residuals',
          xaxis: {title: 'Residual'},
          yaxis: {title: 'Count'},
          height: 400,
          width: 500
        };

        // Rendering.

        Plotly.newPlot('scatterPlot', [scatterPlot, regressionLine], layoutScatterPlot).then(() => {
          const scatterPlot = document.getElementById('scatterPlot');
          const pValue = document.getElementById('pValue');
          const details = document.getElementById('details');
          
          pValue.innerHTML += '<p style="color: blue;"> p_value = ' + p_value + ' ; ' + (p_value < 0.05 ? 'p_value < 0.05, statistically significant' : 'p_value ≥ 0.05, no proof of statistical significance') + '</p>';

          scatterPlot.on('plotly_click', function(data) {
            const x = data.points[0].x;
            const y = data.points[0].y;

            while (details.firstChild) {
              details.removeChild(details.firstChild);
            }
            
            let counter = 0;
            ${JSON.stringify(data)}
              .filter(m => m.age === x && m.nbDatabases === y)
              .forEach(m => {
                counter++;
                details.innerHTML += \`
                <p>
                  <a href="https://www.github.com/\${m.id}" target="_blank">\${m.id}</a>
                  <ul>
                    <li>Age: \${m.age}</li>
                    <li>Creation date: \${m.creationDate}</li>
                    <li># databases technologies: \${m.nbDatabases}</li>
                    <li>Databases technologies: \${m.databases.join(', ')}</li>
                    <li># databases categories: \${m.nbDatabaseCategories}</li>
                    <li>Databases categories: \${m.databaseCategories.join(', ')}</li>
                  </ul>
                </p><hr/>\`;
              });
              details.innerHTML += '<p>' + counter + ' matching repository(ies)</p>';
            });
          });
        
        Plotly.newPlot('histogram', [histogram], layoutHistogram);
      </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: microservice age in comparison with databases technologies / X = microservice age (in years) ; Y = database technologies (i.e., number of services in Docker Compose file excluding non-database services).
      // ---

      // Variables.

      let data = [];

      // Data.

      const cursor = await this.mongoDb.getRepositories(
        'repositories_microservices',
      );

      while (await cursor.hasNext()) {
        let microservice = await cursor.next();
        let { _id, databases, creation_date } = microservice;
        let creationDate = creation_date;
        let age = Math.floor(
          (Date.now() - new Date(creationDate).getTime()) /
            (1000 * 60 * 60 * 24 * 365),
        );
        let nbDatabases = databases.length;
        let databaseCategories = microservice.databases
          .map((dbName) => DATABASES[dbName])
          .reduce((acc, databaseCategory) => {
            if (!acc.includes(databaseCategory)) {
              acc.push(databaseCategory);
            }
            return acc;
          }, []);
        let nbDatabaseCategories = databaseCategories.length;
        data.push({
          id: _id,
          creationDate: creationDate,
          age: age,
          nbDatabases: nbDatabases,
          databases: databases,
          nbDatabaseCategories: nbDatabaseCategories,
          databaseCategories: databaseCategories,
        });
      }

      // Cleaning.

      const values = data.map((d) => d['age']).sort((a, b) => a - b);
      const q1 = values[Math.floor(values.length * 0.25)];
      const q3 = values[Math.floor(values.length * 0.75)];
      const iqr = q3 - q1;
      const upper = q3 + 1.5 * iqr;
      data = data.filter((d) => d['age'] <= upper); // Removing outliers via interquartile range.

      // HTML file.

      let html = path.join('results', 'analyze-42.html');

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

let process42 = new ProcessAnalyze42();
process42.process();

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
class ProcessAnalyze27 extends Process {
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
      links,
      groupA,
      groupB,
      numberLinks,
      numberLinksOnlyGroupA,
      numberLinksOnlyGroupB,
      numberLinksGroupAnB,
    ) => `
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

      <h1>Database Categories Pairing Comparison by Popularity</h1>

      <p style="color: blue;">
      <span>Links only between group A: ${((numberLinksOnlyGroupA / numberLinks) * 100).toFixed(2)}%</span><br/>
      <span>Links only between group B: ${((numberLinksOnlyGroupB / numberLinks) * 100).toFixed(2)}%</span><br/>
      <span>Links between groups A & B: ${((numberLinksGroupAnB / numberLinks) * 100).toFixed(2)}%</span><br/>
      </p>
      
      <div id="graph" style="width: 800px; height: 600px;"></div>

      <script>
        // Data.
        
        const nodesA = ${JSON.stringify(groupA)};
        const nodesB = ${JSON.stringify(groupB)};
        const links = ${JSON.stringify(links)};
        
        // Layout.
        
        const height = 600;
        const spacingA = height / (nodesA.length + 1);
        const spacingB = height / (nodesB.length + 1);
        const positions = {};
        const shapes = [];
        const degrees = {};
        
        // Layout: group positions.
        
        nodesA.forEach((name, i) => {
          positions[name] = {x: 0.25, y: 1 - (spacingA * (i + 1)) / height}; // 0.25 = Left, group A
        });
        nodesB.forEach((name, i) => {
          positions[name] = {x: 0.75, y: 1 - (spacingB * (i + 1)) / height}; // 0.75 = Right, group B
        });

        // Layout: node degrees.
        
        [...nodesA, ...nodesB].forEach(name => degrees[name] = 0);
        links.forEach(link => {
          degrees[link.source]++;
          degrees[link.target]++;
        });

        // Layout: links position.
        
        const groupedLinks = links.reduce((acc, link) => {
          const key = link.source + '-' + link.target;
          acc[key] = acc[key] || [];
          acc[key].push(link);
          return acc;
        }, {});

        Object.entries(groupedLinks).forEach(([key, group]) => {
          const link = group[0];
          const count = group.length;
          const source = positions[link.source];
          const target = positions[link.target];
          
            // Layout: links curving.

            let path;
            if (source.x === target.x) { // Same group.
              const isLeftGroup = source.x === 0.25;
              const offset = 0.25;
              const midX = source.x + (isLeftGroup ? offset : -offset);
              const midY = (source.y + target.y) / 2;
              path = 'M ' + source.x + ',' + source.y + ' Q ' + midX + ',' + midY + ' ' + target.x + ',' + target.y;
            } else { // Different group.
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2;
              path = 'M ' + source.x + ',' + source.y + ' Q ' + midX + ','+ midY + ' ' + target.x + ',' + target.y;
            }
          
            // Layout: links weights.

            const maxConnections = Math.max(...Object.values(groupedLinks).map(group => group.length));
            const linkWidth = Math.min(10, (count / maxConnections) * 20);
            shapes.push({
              type: 'path',
              path: path,
              line: {
                color: 'gray',
                width: linkWidth
              }
            });
        });

        // Layout: nodes positions.
        
        const labels = Object.keys(positions);
        const x = labels.map(d => positions[d].x);
        const y = labels.map(d => positions[d].y);

        // Layout: node sizes.

        const minNodeSize = 0;
        const maxNodeSize = 50;
        const maxDegree = Math.max(...Object.values(degrees));
        const sizes = labels.map(d => {
          const degree = degrees[d];
          const size = Math.min(maxNodeSize, (degree / maxDegree) * maxNodeSize);
          return Math.max(minNodeSize, size);
        });
        
        // Layout: nodes colors.

        const COLORS = ${JSON.stringify(DATABASE_COLORS)};
        const colors = labels.map(l => COLORS[l]);

        // Layout

        const nodeTrace = {
          type: 'scatter',
          mode: 'markers',
          x: x,
          y: y,
          marker: {
            size: sizes,
            color: colors
          },
        };

        const textTrace = {
          type: 'scatter',
          mode: 'text',
          x: x,
          y: y.map(val => val + 0.05),
          text: labels,
          textposition: 'top center',
          textfont: {
            size: 10,
            color: 'black'
          },
          hoverinfo: 'none',
          showlegend: false
        };

        const layout = {
          shapes: shapes,
          xaxis: {visible: false, range: [0, 1]},
          yaxis: {visible: false, range: [0, 1]},
          margin: {l: 0, r: 0, t: 0, b: 0},
          showlegend: false,
          hovermode: false
        };

        Plotly.newPlot('graph', [nodeTrace, textTrace], layout);
      </script>
      </body>
      </html>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: database category associations between mainstream and specific databases as a graph diagram / Left nodes = most popular databases, Right nodes = less popular databases, Links = associations weighted.
      // ---

      // Variables.

      let microservices = [];

      let links = [];
      let groupA = []; // Most popular database categories.
      let groupB = []; // Less popular database categories.
      let numberLinksOnlyGroupA = 0;
      let numberLinksOnlyGroupB = 0;
      let numberLinksGroupAnB = 0;
      let numberLinks = 0;

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
        }); // Database technology.
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
        }, {}); // Database categories sum by total count of microservice occurences.

      microservicesPerDatabaseCategory = Object.fromEntries(
        Object.entries(microservicesPerDatabaseCategory).sort(
          (a, b) => b[1] - a[1],
        ),
      ); // Database categories sorting by microservice occurences in descending order.

      let half = Math.round(
        Object.keys(microservicesPerDatabaseCategory).length / 2,
      );
      groupA = Object.keys(microservicesPerDatabaseCategory).slice(0, half);
      groupB = Object.keys(microservicesPerDatabaseCategory).slice(half);

      // Values.

      Object.keys(microservicesPerDatabaseCategory).forEach((categoryA) => {
        Object.keys(microservicesPerDatabaseCategory).forEach((categoryB) => {
          microservices.forEach((m) => {
            if (
              m.databases
                .map((dbName) => DATABASES[dbName])
                .includes(categoryA) &&
              m.databases
                .map((dbName) => DATABASES[dbName])
                .includes(categoryB) &&
              categoryA !== categoryB
            ) {
              links.push({ source: categoryA, target: categoryB });
            }
          });
        });
      }); // Intersections.

      numberLinks = links.length;
      links.forEach((l) => {
        if (groupA.includes(l.source) && groupA.includes(l.target)) {
          numberLinksOnlyGroupA++;
        } else if (groupB.includes(l.source) && groupB.includes(l.target)) {
          numberLinksOnlyGroupB++;
        } else {
          numberLinksGroupAnB++;
        }
      });

      //console.log(sets);
      //console.log(links);
      //console.log(groupA);
      //console.log(groupB);

      // HTML file.

      let html = path.join('results', 'analyze-27.html');

      fs.writeFileSync(
        html,
        chart(
          links,
          groupA,
          groupB,
          numberLinks,
          numberLinksOnlyGroupA,
          numberLinksOnlyGroupB,
          numberLinksGroupAnB,
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

let process27 = new ProcessAnalyze27();
process27.process();

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
class ProcessAnalyze26 extends Process {
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
          body {
            font-family: Arial, sans-serif; text-align: left;
          }
          svg {
            width: 100%;
            height: 100vh;
          }
        </style>
    </head>
    <body>
    <h1>Database Categories Associations</h1>
    
    <svg></svg>

    <script src="https://d3js.org/d3.v7.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/d3-sankey@0.12.3/dist/d3-sankey.min.js"></script>
    <script>

    // Layout

    const width = 500
    const height = 1000

    // Colors

    const COLORS = ${JSON.stringify(DATABASE_COLORS)};

    function mixColors(sets) {
      let totalR = 0, totalG = 0, totalB = 0;
      sets.forEach(c => {
        c = COLORS[c].replace(/^#/, '');
        if (c.length === 3) c = c.split('').map(x => x + x).join('');
        totalR += parseInt(c.slice(0, 2), 16);
        totalG += parseInt(c.slice(2, 4), 16);
        totalB += parseInt(c.slice(4, 6), 16);
      });
      const avgR = Math.round(totalR / sets.length);
      const avgG = Math.round(totalG / sets.length);
      const avgB = Math.round(totalB / sets.length);
      return \`#\${(1 << 24 | avgR << 16 | avgG << 8 | avgB).toString(16).slice(1).toUpperCase()}\`;
    }

    // Stankey

    const sankey = d3.sankey()
        .nodeWidth(20)
        .nodePadding(15)
        .size([width, height])
        .nodeId(d => d.label);

    const {nodes: sankeyNodes, links: sankeyLinks} = sankey({
      nodes: ${JSON.stringify(sets)}.map(d => Object.assign({}, d)),
      links: ${JSON.stringify(intersections)}.map(d => Object.assign({}, d))
    });

    // SVG

    const svg = d3.select("svg")
      .attr("viewBox", [width, 0, width, height + 10]);

    // SVG node box

    svg.append("g")
      .selectAll("rect")
      .data(sankeyNodes)
      .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("height", d => d.y1 - d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("fill", (d) => {
          if (!d.label.includes("∩") && !d.label.includes("∪")) {
            return COLORS[d.label];
          } else if(d.label.includes("∪")) {
            return COLORS[d.label.substring(0, d.label.indexOf(" "))]
          } else {
            const sets = d.label.split(" ∩ ");
            return mixColors(sets);
          }
        })
        //.attr("stroke", "#000")
        .append("title")
          .text(d => d.label);

    // SVG node text

    svg.append("g")
      .selectAll("text")
      .data(sankeyNodes)
      .join("text")
        .attr("x", d => d.x0 > (width / 2) ? d.x1 + 10 : d.x0 - 10)
        .attr("y", d => (d.y1 + d.y0) / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", d => d.x0 > (width / 2) ? "start" : "end")
        .text(d => d.label.split(' ').map(t => t.match(/w/) !== 0 ? t.substring(0,1) : t).join(' '));

    // SVG links
    svg.append("g")
      .attr("fill", "none")
      .selectAll("path")
      .data(sankeyLinks)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", d => COLORS[d.source.label] || "#bbb")
        .attr("stroke-width", d => Math.max(1, d.width))
        .attr("stroke-opacity", 0.5)
        .append("title")
          .text(d => \`\${d.source.label} → \${d.target.label}\`);
    </script>
    </body>
    `;

    const analyze = async () => {
      // ---
      // ANALYZE: database co-usage in microservices as a Stankey diagram.
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

      let databaseCategoriesCombinations = [];
      let databaseCategoriesCombinationsLabels = [];

      let microservicesPerDatabaseTechnology = [];
      Object.keys(DATABASES).forEach((database) => {
        microservicesPerDatabaseTechnology.push({
          technology: database,
          category: DATABASES[database],
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
              s[0] +
              ' \\ { ' +
              Object.keys(microservicesPerDatabaseCategory)
                .reduce((acc, database) => {
                  if (database !== s[0]) {
                    acc.push(database);
                  }
                  return acc;
                }, [])
                .join(' ∪ ') +
              ' }'
            );
          } else {
            // Multiple databases
            return s.join(' ∩ ');
          }
        },
      ); // Labels generation.

      // Values.

      Object.keys(microservicesPerDatabaseCategory).forEach((category) => {
        sets.push({
          label: category,
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
          label: databaseCategoriesCombinationsLabels[i],
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

      intersections = intersections.filter((i) => i.size !== 0); // Empty set removing.

      let setsStankey = [];
      sets.forEach((s) =>
        setsStankey.push({
          label: s.label,
        }),
      );

      let intersectionsStankey = [];
      intersections.forEach((i) => {
        if (i.label.includes(' \\')) {
          // No intersection set, e.g., R \ { K ∪ D ∪ S ∪ C }.
          intersectionsStankey.push({
            source: i.label.substring(0, i.label.indexOf(' \\')),
            target: i.label,
            value: i.size,
          });

          setsStankey.push({
            label: i.label,
          });
        } else {
          // Intersection set, e.g., R ∩ K.
          let setsInvolved = i.label.split(' ∩ ');
          setsInvolved.forEach((s) => {
            intersectionsStankey.push({
              source: s,
              target: i.label,
              value: i.size / setsInvolved.length, // As the set size is used for the box height, it is divided by the number of sets to distribute the box height according to the number of sets involved.
            });
          });

          setsStankey.push({
            label: i.label,
          });
        }
      });

      console.log(setsStankey);
      console.log(intersectionsStankey);

      // HTML file.

      let html = path.join('results', 'analyze-26.html');

      fs.writeFileSync(html, chart(setsStankey, intersectionsStankey), 'utf8');

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

let process26 = new ProcessAnalyze26();
process26.process();

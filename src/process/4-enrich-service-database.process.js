// IMPORTS

import { Env } from '../helper/env.helper.js';
import { logger } from '../helper/logger.helper.js';
import { MongoDB } from '../dao/mongodb.dao.js';
import YAML from 'yaml';
import { Process } from './process.process.js';

/**
 * Represents a process to enrich the repositories data.
 */
class ProcessEnrichServiceDatabase extends Process {
  constructor() {
    super();

    // Dependencies.
    this.env = new Env(); // Environment variables.
    this.mongoDb = new MongoDB(
      this.env.getMongoDbUrl(),
      this.env.getMongoDbName(),
    ); // MongoDB connection.

    // Constants.
    this.databasesRegexes = {
      // Relational
      Oracle: new RegExp(
        '(oracle/database|oracle-([0-9]*-)*xe|container-registry.oracle.com/database/free|oracle-free)',
        'gi',
      ),
      MySQL: new RegExp('mysql', 'gi'),
      MicrosoftSqlServer: new RegExp('mssql', 'gi'),
      PostgreSQL: new RegExp('postgres', 'gi'),
      IBMDB2: new RegExp('(-db2|/db2)', 'gi'),
      SQLite: new RegExp('sqlite', 'gi'),
      MariaDB: new RegExp('mariadb', 'gi'),
      MicrosoftAzureSqlEdge: new RegExp('azure-sql-edge', 'gi'),
      SAPHana: new RegExp('saplabs/hanaexpress', 'gi'),
      Teradata: new RegExp('teradata', 'gi'),
      SAPSybase: new RegExp('(-sybase|/sybase)', 'gi'),
      Firebird: new RegExp('firebird', 'gi'),
      IBMInformix: new RegExp('informix', 'gi'),
      DBase: new RegExp('(-dbase|/dbase)', 'gi'),
      H2: new RegExp('h2database', 'gi'),
      SingleStore: new RegExp('singlestore', 'gi'),
      CockroachDB: new RegExp('cockroachdb', 'gi'),
      TiDB: new RegExp('tidb', 'gi'),
      OpenEdge: new RegExp('progresssoftware/prgs-oedb', 'gi'),
      InterBase: new RegExp('interbase', 'gi'),
      Ingres: new RegExp('/ingres', 'gi'),
      HyperSQL: new RegExp('(hsqldb|hypersql)', 'gi'),
      GoogleCloudSpanner: new RegExp('cloud-spanner', 'gi'),
      Oceanbase: new RegExp('oceanbase', 'gi'),
      Yugabyte: new RegExp('yugabytedb', 'gi'),
      SAPMaxdb: new RegExp('maxdb', 'gi'),
      Citus: new RegExp('citusdata', 'gi'),
      EXASOL: new RegExp('exasol', 'gi'),
      Datomic: new RegExp('datomic', 'gi'),
      Tibero: new RegExp('tibero', 'gi'),
      MiniSQL: new RegExp('(-msql|/msql)', 'gi'),
      VoltDB: new RegExp('voltdb', 'gi'),
      PolarDB: new RegExp('polardb', 'gi'),
      HFSQL: new RegExp('hfsql', 'gi'),
      TimesTen: new RegExp('timesten', 'gi'),
      eXtremeDB: new RegExp('extremedb', 'gi'),
      MatrixOne: new RegExp('matrixone', 'gi'),
      SQLBase: new RegExp('sqlbase', 'gi'),
      OpenGauss: new RegExp('opengauss', 'gi'),
      DataEase: new RegExp('dataease', 'gi'),
      Cubrid: new RegExp('cubrid', 'gi'),
      Rockset: new RegExp('rockset', 'gi'),
      Altibase: new RegExp('altibase', 'gi'),
      Infobright: new RegExp('infobright', 'gi'),
      NuoDB: new RegExp('nuodb', 'gi'),
      Dolt: new RegExp('dolthub', 'gi'),
      ActianVector: new RegExp('actian/vector', 'gi'),
      RisingWave: new RegExp('risingwave', 'gi'),
      SQream: new RegExp('sqream', 'gi'),
      Frontbase: new RegExp('frontbase', 'gi'),
      Kingbase: new RegExp('kingbase', 'gi'),
      YDB: new RegExp('ydbplatform', 'gi'),
      NexusDB: new RegExp('nexusdb', 'gi'),

      // Document
      MongoDB: new RegExp('(mongodb|mongo)', 'gi'),
      Couchbase: new RegExp('couchbase', 'gi'),
      CouchDB: new RegExp('couchdb', 'gi'),
      Realm: new RegExp('(-realm|/realm)', 'gi'),
      MarkLogic: new RegExp('marklogic', 'gi'),
      RavenDB: new RegExp('ravendb', 'gi'),
      IBMCloudant: new RegExp('cloudant', 'gi'),
      RethinkDB: new RegExp('rethinkdb', 'gi'),
      PouchDB: new RegExp('pouchdb', 'gi'),
      AmazonDocumentDB: new RegExp('documentdb', 'gi'),
      LiteDB: new RegExp('litedb', 'gi'),
      BigchainDB: new RegExp('bigchaindb', 'gi'),
      CrateDB: new RegExp('crate', 'gi'),
      HarperDB: new RegExp('harperdb', 'gi'),

      // Key-Value
      Redis: new RegExp('redis', 'gi'),
      Memcached: new RegExp('memcached', 'gi'),
      etcd: new RegExp('etcd', 'gi'),
      RiakKV: new RegExp('riak-kv', 'gi'),
      RocksDB: new RegExp('rocksdb', 'gi'),
      ApacheAccumulo: new RegExp('accumulo', 'gi'),
      LevelDB: new RegExp('leveldb', 'gi'),
      Infinispan: new RegExp('infinispan', 'gi'),
      IBMLMDB: new RegExp('/lmdb', 'gi'),
      AmazonSimpleDB: new RegExp('simpledb', 'gi'),
      ApacheGeode: new RegExp('geode', 'gi'),
      Valkey: new RegExp('valkey', 'gi'),
      NCache: new RegExp('/ncache', 'gi'),
      GTM: new RegExp('tsafin/fis-gtm-env', 'gi'),
      KeyDB: new RegExp('keydb', 'gi'),
      BoltDB: new RegExp('boltdb', 'gi'),
      Dragonfly: new RegExp('dragonflydb', 'gi'),

      // Column

      ApacheCassandra: new RegExp('cassandra', 'gi'),
      hBase: new RegExp('hbase', 'gi'),
      Clickhouse: new RegExp('clickhouse', 'gi'),
      DuckDB: new RegExp('duckdb', 'gi'),
      DataStax: new RegExp('datastax', 'gi'),
      ScyllaDB: new RegExp('scylladb', 'gi'),
      ApacheDruid: new RegExp('apache/druid', 'gi'),
      MonetDB: new RegExp('monetdb', 'gi'),
      GBase: new RegExp('/gbase', 'gi'),
      StarRocks: new RegExp('starrocks', 'gi'),
      SciDB: new RegExp('scidb', 'gi'),
      SpliceMachine: new RegExp('splicemachine', 'gi'),
      Atoti: new RegExp('atoti', 'gi'),

      // Graph

      Neo4j: new RegExp('neo4j', 'gi'),
      GraphDB: new RegExp('graphdb', 'gi'),
      Memgraph: new RegExp('memgraph', 'gi'),
      JanusGraph: new RegExp('janusgraph', 'gi'),
      Stardog: new RegExp('stardog', 'gi'),
      Nebula: new RegExp('nebula-graphd', 'gi'),
      TigerGraph: new RegExp('tigergraph', 'gi'),
      Dgraph: new RegExp('dgraph', 'gi'),
      Blazegraph: new RegExp('blazegraph', 'gi'),

      // Time series

      InfluxDB: new RegExp('influxdb', 'gi'),
      kdb: new RegExp('(-kdb|/kdb)', 'gi'),
      TimescaleDB: new RegExp('timescaledb', 'gi'),
      QuestDB: new RegExp('questdb', 'gi'),
      GridDB: new RegExp('griddb', 'gi'),
      TDengine: new RegExp('tdengine', 'gi'),
      RRDtool: new RegExp('rrdtool', 'gi'),
      ApacheIoTDB: new RegExp('iotdb', 'gi'),
      OpenTSDB: new RegExp('opentsdb', 'gi'),
      AmazonTimestream: new RegExp('timestream', 'gi'),
      M3DB: new RegExp('m3db', 'gi'),
      KairosDB: new RegExp('kairosdb', 'gi'),

      // Vector

      Pinecone: new RegExp('pinecone', 'gi'),
      Milvus: new RegExp('milvus', 'gi'),
      Qdrant: new RegExp('qdrant', 'gi'),
      Chroma: new RegExp('chromadb', 'gi'),
      Weaviate: new RegExp('weaviate', 'gi'),

      // Spatial

      PostGIS: new RegExp('postgis', 'gi'),
      GeoMesa: new RegExp('geomesa', 'gi'),

      // Object

      ActianNoSQLDatabase: new RegExp('actian/nsql', 'gi'),
      Db4o: new RegExp('db4o', 'gi'),
      ObjectStore: new RegExp('objectstore', 'gi'),
      ZODB: new RegExp('zodb', 'gi'),
      ObjectDB: new RegExp('objectdb', 'gi'),
      ObjectivityDB: new RegExp('objectivity', 'gi'),

      // Event

      EventstoreDB: new RegExp('eventstore', 'gi'),

      // Search

      Elasticsearch: new RegExp('elasticsearch', 'gi'),
      Splunk: new RegExp('splunk', 'gi'),
      ApacheSolr: new RegExp('(solr:|/solr|-solr)', 'gi'),
      OpenSearch: new RegExp('opensearch', 'gi'),
      Algolia: new RegExp('algolia', 'gi'),
      AmazonCloudSearch: new RegExp('cloudsearch', 'gi'),
      Meilisearch: new RegExp('meilisearch', 'gi'),
      Typesense: new RegExp('typesense', 'gi'),
      Vespa: new RegExp('vespaengine', 'gi'),

      // Others

      AmazonDynamoDB: new RegExp('dynamodb', 'gi'),
      AzureCosmosDB: new RegExp('cosmosdb', 'gi'),
      Vertica: new RegExp('(vertica/|demisto/vertica)', 'gi'),
      Aerospike: new RegExp('aerospike', 'gi'),
      OracleNoSQL: new RegExp('oracle/nosql', 'gi'),
      Virtuoso: new RegExp('virtuoso', 'gi'),
      ApacheIgnite: new RegExp('apacheignite/ignite', 'gi'),
      ArangoDB: new RegExp('arangodb', 'gi'),
      Adabas: new RegExp('adabas', 'gi'),
      OrientDB: new RegExp('orientdb', 'gi'),
      DolphinDB: new RegExp('dolphindb', 'gi'),
      Fauna: new RegExp('fauna', 'gi'),
      BaseX: new RegExp('basex', 'gi'),
      GridGain: new RegExp('gridgain', 'gi'),
      Mnesia: new RegExp('(-mnesia|/mnesia)', 'gi'),
      ObjectBox: new RegExp('objectboxio', 'gi'),
      SurrealDB: new RegExp('surrealdb', 'gi'),
      FoundationDB: new RegExp('foundationdb', 'gi'),
      RDF4J: new RegExp('rdf4j', 'gi'),
      AllegroGraph: new RegExp('allegrograph', 'gi'),
      eXistdb: new RegExp('existdb', 'gi'),
      TypeDB: new RegExp('typedb', 'gi'),
    };
    this.databasesKeys = Object.keys(this.databasesRegexes);
  }

  /**
   * Executes the process to enrich repositories.
   */
  process() {
    const enrich = async () => {
      // Retrieve repositories.
      const cursor = await this.mongoDb.getRepositories('repositories');
      while (await cursor.hasNext()) {
        let repository = await cursor.next();
        let { docker_compose_files_content } = repository;
        if (docker_compose_files_content.length > 0) {
          // ---
          // ENRICH: service count
          // ---
          let dockerComposeServices = [];
          let dockerComposeServicesImages = [];
          docker_compose_files_content?.forEach((docker_compose_file) => {
            if (docker_compose_file) {
              try {
                let parsedYaml = YAML.parse(docker_compose_file, {
                  logLevel: 'silent',
                });
                if (parsedYaml && parsedYaml.services) {
                  let services = Object.keys(parsedYaml.services);
                  dockerComposeServices =
                    dockerComposeServices.concat(services);
                  dockerComposeServices.forEach((service) => {
                    let image = parsedYaml.services[service]?.image;
                    if (image) {
                      dockerComposeServicesImages.push(image.toLowerCase());
                    }
                  });
                }
              } catch (error) {
                // Skip
              }
            }
          });
          repository.services_count = dockerComposeServices.length;

          // ---
          // ENRICH: databases
          // ---
          let databases = [];
          dockerComposeServicesImages.forEach((service) => {
            this.databasesKeys.forEach((database) => {
              if (service.match(this.databasesRegexes[database])) {
                if (!databases.includes(database)) {
                  databases.push(database);
                }
              }
            });
          });
          repository.databases = databases;

          this.mongoDb.saveRepository(
            repository._id,
            repository.url,
            repository.branch,
            repository.owner,
            repository.title,
            repository.description,
            repository.topics,
            repository.creation_date,
            repository.last_updated_date,
            repository.size,
            repository.stars_count,
            repository.commits_count,
            repository.contributors_count,
            repository.folders_count,
            repository.services_directories,
            repository.services_files,
            repository.readme_files,
            repository.readme_files_content,
            repository.docker_compose_files,
            repository.docker_compose_files_content,
            repository.istio_files,
            repository.istio_files_content,
            repository.services_count,
            repository.databases,
            repository.languages,
            'repositories',
          );
        }
      }
    };

    this.mongoDb
      .connect()
      .then(() => {
        enrich(); // Process entry point.
      })
      .catch((error) => {
        logger.error(`[enrich-database] ${error.message}`);
      });
  }
}

let processEnrichServiceDatabase = new ProcessEnrichServiceDatabase();
processEnrichServiceDatabase.process();

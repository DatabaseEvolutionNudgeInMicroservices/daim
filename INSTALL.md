# DAIM

## Installation

### Prerequisites

1. NodeJS:

- [Install NodeJS](https://nodejs.org/fr/download).

2. Docker Desktop:

- Linux : [Install Docker Engine](https://docs.docker.com/engine/install/) or [Install Docker Desktop](https://docs.docker.com/desktop/setup/install/linux/).
- Windows : [Install Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/).
- MacOS : [Install Docker Desktop](https://docs.docker.com/desktop/setup/install/mac-install/).

3. Docker:

- The official MongoDB image downloaded [mongo - Official Image | Docker Hub](https://hub.docker.com/_/mongo).

4. GitHub:

- The mining phase is performed through the GitHub Search API. This one allows retrieving repositories, code, and other relevant data based on specific search queries. It also enables filtering results and performing further analyses using various fine-grained parameters such as keywords, programming languages, repository stars, creation dates, etc.
- For using this API, tokens are required. Since the mining process could take a while and since GitHub defines limits, we allow to add several tokens. The more you add, the faster the mining process will be, as each token works in parallel and in pooling. See token generation instructions at the next point.
- DISCLAIMER: While this project is a valuable and helpful tool, it is essential to follow certain rules, particularly regarding API rate limits, authentication, and responsible token management. Adhering to these constraints ensures compliance with GitHub's policies and prevents disruptions in data collection. The authors of these scripts have taken all necessary measures to ensure compliance with the rules, regarding API rate limits and authentication management, particularly in the case of pooling and parallelization to name but a few. However, users of these scripts remain solely responsible for any consequences. The authors disclaim all responsibility in the event of misuse, abuse, circumvention, sanctions, non-compliance, or any other violation. Further reading [\[GitHub (2022, a)\]](https://docs.github.com/en/rest/about-the-rest-api/about-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, b)\]](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, c)\]](https://docs.github.com/en/rest/authentication/keeping-your-api-credentials-secure?apiVersion=2022-11-28), [\[GitHub (2022, d)\]](https://docs.github.com/en/rest/using-the-rest-api/getting-started-with-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, e)\]](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, f)\]](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, g)\]](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api?apiVersion=2022-11-28), [\[GitHub (2022, h)\]](https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#limitations-on-query-length), [\[GitHub (2022, i)\]](https://docs.github.com/en/rest/search/search?apiVersion=2022-11-28#about-search).
- Generate and collect GitHub tokens from one or more active GitHub accounts. [GitHub](https://github.com/) > [Settings](https://github.com/settings/profile) > [Developer Settings](https://github.com/settings/apps) > [Personal access tokens](https://github.com/settings/personal-access-tokens) > [Generate new token](https://github.com/settings/personal-access-tokens/new) > Enter a "Token name" > Define an "Expiration" date > Select "Public Repositories (read-only)" > Click on "Generate token".

5. Git LFS:

- Install [GitHub LFS](https://git-lfs.com/) for the MongoDB dump restoration using the following command.

```
git lfs install
```

⚠️ This command must be run after downloading and installing Git LFS for your operating system and before cloning the repository for the first time.

⚠️ If you have already cloned it, some files in the [`/results`](./results) directory are just git lfs placeholders. After the previous step, you can run the following command to integrate the lfs handled files.

```
git lfs pull
```

6. Environment variables:

- Create an `.env` file with the following content.
  - Before setting up the environment variables for MongoDB (URL and name), you have to create a container with the MongoDB image downloaded. Then, depending on your setup, you have to specify the URL and the name. The [`.env_sample`](/.env_sample) file gives you an example with default settings. If you want to populate the database with our existing dataset, you can upload the collections that are located in the [`/results/`](./results/) directory as JSON files prefixed by "daim." in the file name. In that case, you can directory to the [analysis process](README.md#6-analyze).
  - The XX in the `GH_TOKEN_XX` tag represents an identifier (which you can freely define) for the account to which the GitHub token belongs. Several GitHub tokens can be added. The more you add, the faster the script will be, as each token works in parallel and in pooling.
  ```shell
  MONGO_URL=...
  MONGODB_NAME=...
  GH_TOKEN_XX=...
  GH_TOKEN_XX=...
  GH_TOKEN_XX=...
  ...
  ```
  See `.env_sample` for example.

### Setup

You have the tree following options.

#### Setup from source code

- Open the project in an IDE and install the dependencies.

  ```shell
  npm install
  ```

#### Setup from source code with Docker

- Open the project in an IDE and install the dependencies.

  ```shell
  npm install
  ```

The project contains a `Dockerfile` at its root in order to create an image of the application.

A `docker-compose.yml` file also exists at the root in order to launch easily a container for the application.

- Build the image and launch the container.

  ```bash
  docker-compose up -d
  ```

Warning! This command must be executed at the location of the `docker-compose.yml` file and have to be run as with the right privileges (administrator).

### Usage

See [README > Usage](README.md#-usage).

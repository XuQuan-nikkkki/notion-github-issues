import { Client } from "@notionhq/client";
import { QueryDatabaseResponse } from "@notionhq/client/build/src/api-endpoints";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const ISSUES_DB_ID = process.env.NOTION_ISSUES_DB_ID!;
const USERS_DB_ID = process.env.NOTION_USERS_DB_ID!;
const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!;

export async function checkIfIssueExists(issueUrl: string): Promise<boolean> {
  const response = await notion.databases.query({
    database_id: ISSUES_DB_ID,
    filter: {
      property: "URL",
      url: {
        equals: issueUrl,
      },
    },
  });

  return response.results.length > 0;
}

export async function getOrCreateUser(
  githubLogin: string,
  profileUrl: string
): Promise<string> {
  const searchRes: QueryDatabaseResponse = await notion.databases.query({
    database_id: USERS_DB_ID,
    filter: {
      property: "URL",
      url: {
        equals: profileUrl,
      },
    },
  });

  if (searchRes.results.length > 0) {
    return searchRes.results[0].id;
  }

  const userPage = await notion.pages.create({
    parent: { database_id: USERS_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: githubLogin } }],
      },
      URL: {
        url: profileUrl,
      },
    },
  });

  return userPage.id;
}

export async function getOrCreateProject(
  name: string,
  projectURL: string
): Promise<string> {
  const searchRes: QueryDatabaseResponse = await notion.databases.query({
    database_id: PROJECTS_DB_ID,
    filter: {
      property: "URL",
      url: {
        equals: projectURL,
      },
    },
  });

  if (searchRes.results.length > 0) {
    return searchRes.results[0].id;
  }

  const projectPage = await notion.pages.create({
    parent: { database_id: PROJECTS_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: name } }],
      },
      URL: {
        url: projectURL,
      },
    },
  });

  return projectPage.id;
}

export async function addIssueToNotion(data: {
  title: string;
  url: string;
  description: string;
  githubUser: {
    login: string;
    html_url: string;
  };
  repo: {
    name: string;
    html_url: string;
  };
}): Promise<string> {
  const alreadyExists = await checkIfIssueExists(data.url);
  if (alreadyExists) {
    throw new Error("Issue already exists");
  }

  const userId = await getOrCreateUser(
    data.githubUser.login,
    data.githubUser.html_url
  );

  const projectId = await getOrCreateProject(data.repo.name, data.repo.html_url);

  const issuePage = await notion.pages.create({
    parent: { database_id: ISSUES_DB_ID },
    properties: {
      Name: {
        title: [{ text: { content: data.title } }],
      },
      URL: {
        url: data.url,
      },
      Description: {
        rich_text: [
          { text: { content: data.description || "No description provided." } },
        ],
      },
      User: {
        relation: [{ id: userId }],
      },
      Project: {
        relation: [{ id: projectId }],
      },
    },
  });

  await setSelfReference(issuePage.id);

  return issuePage.id;
}

async function setSelfReference(pageId: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Self Reference": {
        relation: [{ id: pageId }],
      },
    },
  });
}

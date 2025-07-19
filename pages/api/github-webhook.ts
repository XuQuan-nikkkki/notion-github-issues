import { NextApiRequest, NextApiResponse } from "next";
import { addIssueToNotion } from "../../lib/notion";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const event = req.headers["x-github-event"];
  const payload = req.body;

  if (event === "issues" && payload.action === "opened") {
    const { issue, repository } = payload;

    const data = {
      title: issue.title,
      url: issue.html_url,
      description: issue.body || "",
      githubUser: {
        login: issue.user.login,
        html_url: issue.user.html_url,
      },
      repo: {
        name: repository.name,
        html_url: repository.html_url,
      },
    };

    try {
      const newPageId = await addIssueToNotion(data);
      return res.status(200).json({ success: true, pageId: newPageId });
    } catch (err) {
      console.error("Error creating issue in Notion:", err);
      return res.status(500).json({ error: "Failed to add issue to Notion" });
    }
  }

  return res.status(200).json({ received: true });
}

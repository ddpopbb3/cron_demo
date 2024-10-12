import { DOMParser } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";
import showdown from "https://esm.sh/showdown@1.9.1";

Deno.cron("sample cron", "30 3 * * *", () => {
  try {
    const result = main(); // 获取 main 函数的结果
    return new Response(JSON.stringify(result), { status: 200 }); // 返回成功响应
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
    }); // 返回错误响应
  }
});

class Config {
  static APP_TOKEN = "AT_ARG2LV1hvLXQhqrp8QMcIRFK8ek1kxTf"; // 替换为您的实际应用令牌
  static TOPIC_IDS = [34192]; // 替换为您的实际主题 ID
  static UIDS = []; // UID_xozJUs6EZrUzNFqU8m9DdjXhqInf
  static CONTENT_TYPE = 3;
  static VERIFY_PAY_TYPE = 0;
}

class Issue {
  constructor(
    public year: string,
    public month: string,
    public issueNumber: string,
    public title: string,
    public link: string,
  ) {}
  toString() {
    return `Issue(year=${this.year}, month=${this.month}, issueNumber=${this.issueNumber}, title=${this.title}, link=${this.link})`;
  }
}

class Message {
  constructor(
    public appToken: string,
    public content: string,
    public summary: string,
    public contentType: number,
    public topicIds: number[],
    public uids: string[],
    public url: string,
    public verifyPayType: number,
  ) {}
  toJson() {
    return {
      appToken: this.appToken,
      content: this.content,
      summary: this.summary,
      contentType: this.contentType,
      topicIds: this.topicIds,
      uids: this.uids,
      url: this.url,
      verifyPayType: this.verifyPayType,
    };
  }
}

async function downloadMarkdownFile(url: string): Promise<string> {
  const response = await fetch(url);
  if (response.ok) {
    return await response.text();
  } else {
    throw new Error(`Failed to download file from ${url}`);
  }
}

function parseMarkdownA(markdownText: string): Record<string, string> {
  const converter = new showdown.Converter();
  const html = converter.makeHtml(markdownText);
  const sections: Record<string, string> = {};
  const regex = /<h2>(.*?)<\/h2>(.*?)<h2>|<h2>(.*?)<\/h2>(.*)/gs;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const title = match[1] || match[3];
    const content = match[2] || match[4];
    sections[title] = content.trim();
  }
  return sections;
}

async function getRandomIssue(): Promise<Issue> {
  const url =
    "https://raw.githubusercontent.com/ruanyf/weekly/refs/heads/master/README.md";
  const markdownText = await downloadMarkdownFile(url);
  const issues = parseMarkdownForIssue(markdownText);
  return issues[Math.floor(Math.random() * issues.length)];
}

function parseMarkdownForIssue(markdown_text: string): Issue[] {
  // 将 Markdown 转换为 HTML
  const converter = new showdown.Converter();
  const html = converter.makeHtml(markdown_text);
  const parser = new DOMParser();
  const document = parser.parseFromString(html, "text/html");
  const issues: Issue[] = [];
  let year: string | null = null;
  let month: string | null = null;

  if (document) {
    const elements = document.body.children;

    for (const element of elements) {
      // 检查年份
      if (
        element.tagName === "H2" && isFourDigitNumber(element.textContent || "")
      ) {
        year = element.textContent || null;
      }
      // 检查月份
      if (element.tagName === "P") {
        month = element.textContent || null;
      }
      // 处理列表项
      if (element.tagName === "UL") {
        const listItems = element.getElementsByTagName("LI");

        for (const li of listItems) {
          const anchor = li.querySelector("A");
          if (anchor) {
            issues.push(
              new Issue(
                year!,
                convertChineseMonthToNumber(month!),
                extractIssueNumber(li.textContent || ""),
                anchor.textContent || "",
                anchor.getAttribute("href") || "",
              ),
            );
          }
        }
      }
    }
  }

  return issues; // 返回解析后的问题列表
}

function isFourDigitNumber(s: string): boolean {
  // Match four-digit number using regular expression
  const pattern = "^\\d{4}$";
  const regex = new RegExp(pattern);
  return regex.test(s) != null;
}

function extractIssueNumber(s: string): string | null {
  const pattern = /第 (\d+) 期/;
  const match = s.match(pattern);
  return match ? match[1] : null;
}
function convertChineseMonthToNumber(chineseMonth: string): string | null {
  const monthMapping: Record<string, string> = {
    "一月": "01",
    "二月": "02",
    "三月": "03",
    "四月": "04",
    "五月": "05",
    "六月": "06",
    "七月": "07",
    "八月": "08",
    "九月": "09",
    "十月": "10",
    "十一月": "11",
    "十二月": "12",
  };
  return monthMapping[chineseMonth] || null;
}
async function sendMessage(message: Message): Promise<any> { // 修改返回类型为 Promise<any>
  const response = await fetch(
    "https://wxpusher.zjiecode.com/api/send/message",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message.toJson()),
    },
  );
  if (response.ok) {
    console.log("Message sent successfully!");
    return await response.json(); // 返回响应 JSON
  } else {
    console.error(`Failed to send message. Status code: ${response.status}`);
    throw new Error(await response.text()); // 抛出错误
  }
}
async function main(): Promise<any> { // 修改返回类型为 Promise<any>
  const issue = await getRandomIssue();
  const originUrl =
    `https://www.ruanyifeng.com/blog/${issue.year}/${issue.month}/weekly-issue-${issue.issueNumber}.html`;
  const url =
    `https://raw.githubusercontent.com/ruanyf/weekly/refs/heads/master/${issue.link}`;
  const markdownText = await downloadMarkdownFile(url);
  const message = new Message(
    Config.APP_TOKEN,
    markdownText,
    `第${issue.issueNumber}期: ${issue.title}`,
    Config.CONTENT_TYPE,
    Config.TOPIC_IDS,
    Config.UIDS,
    originUrl,
    Config.VERIFY_PAY_TYPE,
  );
  return await sendMessage(message); // 返回 sendMessage 的结果
}

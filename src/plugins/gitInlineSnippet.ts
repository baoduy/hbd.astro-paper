import { type Plugin } from "unified";
import { visit } from "unist-util-visit";
import type { Root } from "mdast";
import * as Path from "path";
//import fetch from "node-fetch";

// eslint-disable-next-line
export type Options = {
  // If this string is detected in a link text, the link will be replaced with a code snippet
  // Default: "inline"
  inlineMarker?: string;
  // The comment placed on top of the linked code snippet, <url> will be replaced with the URL
  // of the link. If undefined, no comment will be added.
  // Default: undefined
  originComment?: string;
  // Function that gets called with an error if a fetch fails. If undefined, the error will be
  // ignored.
  // Default: undefined
  logError?: (error: Error) => void;
};
const DEFAULT_SETTINGS: Options = {
  inlineMarker: "inline",
  logError: () => {},
};

type InlineSnippet = {
  inline: (codeblock: any) => void;
  url: string;
};

const RemarkInlineGithubCodeSnippet: Plugin<[Options?], Root> = (
  options: Options | undefined,
) => {
  const settings = Object.assign({}, DEFAULT_SETTINGS, options);

  return async (tree) => {
    const inlineSnippets: InlineSnippet[] = [];

    // find all snippets
    visit(tree, (node, index, parent) => {
      // Search for links starting with github.com and containing the inlineMarker
      if (
        node.type === "link" &&
        node.children[0].type === "text" &&
        node.children[0].value === settings.inlineMarker &&
        node.url.startsWith("https://github.com")
      ) {
        inlineSnippets.push({
          url: node.url,
          inline: (codeblock) => {
            parent!.children[index!] = codeblock;
          },
        });
      }
    });

    // replace all snippets
    await Promise.all(
      inlineSnippets.map(async (snippet) => {
        // e.g. https://github.com/hashicorp/terraform/blob/main/internal/promising/promise.go#L30-L41
        const hashParts = new URL(snippet.url).hash.replace("#", "").split("-");
        if (hashParts.length != 2) {
          throw new Error(
            `Inlining snippet points to ${snippet.url} with an invalid hash. Expected #L<number>-L<number>`,
          );
        }
        const [start, end] = hashParts.map((p) => parseInt(p.replace("L", ""), 10));

        let content;
        try {
          content = await fetch(
            snippet.url
              .replace("https://github.com", "https://raw.githubusercontent.com")
              .replace("blob", ""),
          ).then((res) => {
            if (!res.ok) {
              throw new Error(`Failed to fetch ${snippet.url}, skipping`);
            }
            return res.text();
          });
        } catch (e: any) {
          if (settings.logError) {
            settings.logError(e);
          }

          return;
        }
        const ext = Path.parse(new URL(snippet.url).pathname.split("/").slice(5).join("/")).ext;

        const snippetContent = content
          .split("\n")
          .slice(start - 1, end)
          .join("\n");
        snippet.inline({
          type: "code",
          lang: pathExtensionToMarkdownLanguageTag(ext),
          value: settings.originComment
            ? `${commentOutBasedOnLanguage(ext, settings.originComment.replaceAll("<url>", snippet.url))}` +
              snippetContent
            : snippetContent,
        });
      }),
    );
  };
};

type LanguageHandler = {
  markdown: string;
  comment: (comment: string) => string;
};
export const supportedLanguageExtensions: Record<string, LanguageHandler> = {
  ".js": {    markdown: "javascript",    comment: (c) => `// ${c}\n`,  },
  ".ts": {    markdown: "typescript",    comment: (c) => `// ${c}\n`,  },
  ".py": {    markdown: "python",    comment: (c) => `# ${c}\n`,  },
  ".sh": {    markdown: "bash",    comment: (c) => `# ${c}\n`,  },
  ".json": {    markdown: "json",    comment: () => "",  },
  ".yaml": {    markdown: "yaml",    comment: (c) => `# ${c}\n`,  },
  ".yml": {    markdown: "yaml",    comment: (c) => `# ${c}\n`,  },
  ".tf": {    markdown: "terraform",    comment: (c) => `# ${c}\n`,  },
  ".hcl": {    markdown: "hcl",    comment: (c) => `# ${c}\n`,  },
  ".tfstacks.hcl": {    markdown: "hcl",    comment: (c) => `# ${c}\n`,  },
  ".go": {    markdown: "go",    comment: (c) => `// ${c}\n`,  },
  ".cs": {    markdown: "csharp",    comment: (c) => `// ${c}\n`,  },
  ".csproj": {    markdown: "xml",    comment: (c) => `// ${c}\n`,  },
  ".runsettings": {    markdown: "xml",    comment: (c) => `// ${c}\n`,  },
} as const;

const defaultLanguageExtension: LanguageHandler = {
  markdown: "",
  comment: (c) => `// ${c}\n`,
};

export function commentOutBasedOnLanguage(ext: string, code: string) {
  return (supportedLanguageExtensions[ext] || defaultLanguageExtension).comment(code);
}

export function pathExtensionToMarkdownLanguageTag(ext: string) {
  return (supportedLanguageExtensions[ext] || defaultLanguageExtension).markdown;
}

export default RemarkInlineGithubCodeSnippet;
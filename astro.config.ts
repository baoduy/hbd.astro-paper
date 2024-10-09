import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import react from "@astrojs/react";
import remarkToc from "remark-toc";
import remarkCollapse from "remark-collapse";
import remarkGfm from "remark-gfm";
import remarkHint from 'remark-hint';
import h2Reformat from './src/plugins/h2Reformat';
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkInlineGithubCodeSnippet from "remark-inline-github-code-snippets";
import sitemap from "@astrojs/sitemap";
import partytown from "@astrojs/partytown";
import { SITE } from "./src/config";

// https://astro.build/config
export default defineConfig({
  site: SITE.website,
  integrations: [
    tailwind({
      applyBaseStyles: false,
    }),
    react(),
    sitemap(),
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
  ],
  markdown: {
    remarkPlugins: [
      h2Reformat,
      remarkHint,
      remarkToc,
      [
        remarkCollapse,
        {
          test: "Table of contents",
        },
      ],
      remarkGfm,
      [
        remarkInlineGithubCodeSnippet,
        {
          inlineMarker: "inline",
          //originComment: "source: <url>"
        },
      ],
      remarkRehype,
      rehypeStringify,
    ],
    shikiConfig: {
      // For more themes, visit https://shiki.style/themes
      themes: { light: "github-light", dark: "github-dark" },
      wrap: true,
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
  scopedStyleStrategy: "where",
  experimental: {
    contentLayer: true,
  },
});

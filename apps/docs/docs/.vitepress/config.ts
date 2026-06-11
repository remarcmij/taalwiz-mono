import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";
import footnote from "markdown-it-footnote";

export default withMermaid(
  defineConfig({
  title: "Taalwiz Guide",
  description: "Documentation for Taalwiz content creators and administrators.",
  base: "/guide/",
  markdown: {
    config: (md) => {
      md.use(footnote);
    },
  },
  themeConfig: {
    nav: [{ text: "Home", link: "/" }],
    sidebar: [
      {
        text: "About",
        items: [{ text: "Project Overview", link: "/overview" }],
      },
      {
        text: "How it works",
        items: [{ text: "How search works", link: "/how-search-works" }],
      },
      {
        text: "Content & Admin",
        items: [{ text: "Content Management Guide", link: "/content-guide" }],
      },
    ],
    socialLinks: [],
    docFooter: {
      prev: "Vorige pagina",
      next: "Volgende pagina",
    },
    outlineTitle: "Op deze pagina",
    darkModeSwitchLabel: "Weergave",
    sidebarMenuLabel: "Menu",
    returnToTopLabel: "Terug naar boven",
    langMenuLabel: "Taal",
  },
  }),
);

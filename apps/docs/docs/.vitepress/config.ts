import { defineConfig } from "vitepress";
import footnote from "markdown-it-footnote";

export default defineConfig({
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
        items: [{ text: "Project Overview", link: "/guide/overview" }],
      },
      {
        text: "Content & Admin",
        items: [{ text: "Content Management Guide", link: "/guide/content-guide" }],
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
});

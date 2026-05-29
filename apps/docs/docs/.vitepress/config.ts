import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Taalwiz Guide",
  description: "Documentation for Taalwiz content creators and administrators.",
  base: "/guide/",
  themeConfig: {
    nav: [{ text: "Home", link: "/" }],
    sidebar: [
      {
        text: "Content & Admin",
        items: [{ text: "Content & Admin Guide", link: "/guide/content-guide" }],
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

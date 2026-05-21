import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Taalwiz Guide",
  description: "User documentation for the Taalwiz language learning app.",
  base: "/guide/",
  themeConfig: {
    nav: [{ text: "Home", link: "/" }],
    sidebar: [
      {
        text: "Help",
        items: [
          { text: "Help (NL)", link: "/guide/help.nl" },
          { text: "Help (EN)", link: "/guide/help.en" },
        ],
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

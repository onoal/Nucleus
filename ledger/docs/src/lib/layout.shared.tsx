import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: "Registry Framework",
    url: "/",
    transparentMode: "top", // Transparent navbar when at top of page
  },
  links: [
    {
      text: "Documentation",
      url: "/docs",
      active: "nested-url",
    },
    {
      text: "GitHub",
      url: "https://github.com/onoal/onoal-os",
      external: true,
    },
  ],
};

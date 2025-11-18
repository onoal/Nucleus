import { source } from "@/lib/source";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import { baseOptions } from "@/lib/layout.shared";

export default function Layout({ children }: LayoutProps<"/docs">) {
  const { nav, ...base } = baseOptions;

  return (
    <DocsLayout
      tree={source.pageTree}
      {...base}
      nav={{ ...nav, mode: "top" }}
      sidebar={{
        defaultOpenLevel: 0, // Don't expand folders by default
        prefetch: true, // Enable prefetching for faster navigation
        collapsible: true, // Allow collapsing sidebar sections
        footer: (
          <div className="mt-auto p-4 text-xs text-muted-foreground border-t">
            <p className="font-medium">Registry Framework</p>
            <p className="text-xs mt-1">v0.1.0</p>
          </div>
        ),
      }}
      githubUrl="https://github.com/onoal/onoal-os"
      searchToggle={{
        enabled: true,
      }}
      themeSwitch={{
        enabled: true,
      }}
      tabMode="navbar"
    >
      {children}
    </DocsLayout>
  );
}

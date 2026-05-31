import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Note App",
    short_name: "Notes",
    description:
      "A GitHub-backed personal notes workspace. Write Markdown notes that sync to your repositories.",
    id: "/",
    start_url: "/workspace",
    scope: "/",
    lang: "en",
    dir: "ltr",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: "#4f46e5",
    categories: ["productivity", "utilities"],
    shortcuts: [
      {
        name: "New note",
        short_name: "New",
        description: "Create a new note",
        url: "/workspace/new",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }],
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

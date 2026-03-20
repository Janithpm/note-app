"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

function openSearchPalette() {
  document.dispatchEvent(
    new KeyboardEvent("keydown", {
      key: "k",
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    })
  );
}

function getBreadcrumbData(pathname: string, owner: string, repo: string) {
  const segments = pathname.split("/").filter(Boolean);
  const route = segments.slice(3);
  const repoHref = `/workspace/${owner}/${repo}`;

  if (route.length === 0) {
    return {
      repoHref,
      parentLabel: owner,
      pageLabel: repo,
    };
  }

  if (route[0] === "new") {
    return {
      repoHref,
      parentLabel: repo,
      pageLabel: "New note",
    };
  }

  if (route[0] === "blob") {
    const pathSegments = route.slice(1).map(decodeURIComponent);
    const pageLabel = pathSegments[pathSegments.length - 1] ?? repo;
    const parentLabel =
      pathSegments.length > 1
        ? pathSegments.slice(0, -1).join(" / ")
        : repo;

    return {
      repoHref,
      parentLabel,
      pageLabel,
    };
  }

  return {
    repoHref,
    parentLabel: repo,
    pageLabel: route.map(decodeURIComponent).join(" / "),
  };
}

export function RepositoryHeader({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}) {
  const pathname = usePathname();
  const { repoHref, parentLabel, pageLabel } = getBreadcrumbData(
    pathname,
    owner,
    repo
  );

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <SidebarTrigger />
      <Separator
        orientation="vertical"
        className="mr-1 data-[orientation=vertical]:h-4"
      />

      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList>
          <BreadcrumbItem className="hidden md:block">
            <BreadcrumbLink asChild>
              <Link href={repoHref}>{repo}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden md:block" />
          <BreadcrumbItem className="hidden lg:block">
            <BreadcrumbPage className="max-w-[22rem] truncate">
              {parentLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="hidden lg:block" />
          <BreadcrumbItem>
            <BreadcrumbPage className="max-w-[16rem] truncate">
              {pageLabel}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={openSearchPalette}
          title="Search workspace"
        >
          <Search />
          <span className="sr-only">Search workspace</span>
        </Button>
        <Button asChild size="sm" className="hidden sm:inline-flex">
          <Link href={`/workspace/${owner}/${repo}/new`}>
            <Plus />
            <span>New note</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}

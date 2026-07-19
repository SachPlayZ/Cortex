import type { ReactNode } from "react";
import { Badge } from "./ui/badge";

export function PageShell({
  eyebrow,
  title,
  description,
  action,
  children
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh px-4 pb-24 pt-28 sm:px-6 md:pt-32 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 md:gap-10">
        <header className="flex flex-col gap-6 border-b border-border pb-8 md:flex-row md:items-end md:justify-between md:pb-10">
          <div className="flex max-w-4xl flex-col items-start gap-4">
            {eyebrow ? <Badge variant="outline">{eyebrow}</Badge> : null}
            <h1 className="m-0 max-w-3xl text-3xl font-semibold leading-[1.04] tracking-[-0.03em] text-balance text-foreground sm:text-4xl md:text-5xl">
              {title}
            </h1>
            {description ? <p className="m-0 max-w-2xl text-base leading-7 text-pretty text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap items-center gap-3">{action}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

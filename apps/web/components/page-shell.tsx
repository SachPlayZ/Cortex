import type { ReactNode } from "react";

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
    <div className="min-h-dvh px-5 pb-24 pt-32 md:px-8 md:pt-36">
      <div className="mx-auto flex max-w-7xl flex-col gap-10">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-4xl flex-col gap-4">
            {eyebrow ? <p className="m-0 text-sm font-medium text-primary">{eyebrow}</p> : null}
            <h1 className="m-0 text-4xl font-semibold leading-[0.96] tracking-normal text-foreground md:text-6xl">
              {title}
            </h1>
            {description ? <p className="m-0 max-w-2xl text-base leading-7 text-muted-foreground">{description}</p> : null}
          </div>
          {action ? <div className="flex shrink-0 flex-wrap gap-3">{action}</div> : null}
        </header>
        {children}
      </div>
    </div>
  );
}

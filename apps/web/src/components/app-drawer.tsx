"use client";

import type { ReactNode } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@almedia/ui/components/drawer";
import { useIsMobile } from "@almedia/ui/hooks/use-mobile";
import { cn } from "@almedia/ui/lib/utils";

const SIZE_CLASS = {
  md: "data-[vaul-drawer-direction=right]:sm:max-w-md",
  lg: "data-[vaul-drawer-direction=right]:w-full data-[vaul-drawer-direction=right]:sm:max-w-xl data-[vaul-drawer-direction=right]:md:max-w-2xl",
} as const;

export function AppDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  size = "md",
  bodyClassName,
  titleClassName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** md ≈ graph inspector; lg ≈ evidence viewer */
  size?: keyof typeof SIZE_CLASS;
  /** Override body layout (default: scrollable padded region) */
  bodyClassName?: string;
  titleClassName?: string;
}) {
  const isMobile = useIsMobile();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
      shouldScaleBackground={false}
    >
      <DrawerContent
        className={cn(
          "min-h-0",
          isMobile ? "max-h-[85dvh]" : cn("h-full max-h-none w-full", SIZE_CLASS[size]),
        )}
      >
        <DrawerHeader className="shrink-0 border-b border-border text-left md:text-left">
          <DrawerTitle className={cn("pr-2 text-base tracking-tight", titleClassName)}>
            {title}
          </DrawerTitle>
          {description != null && description !== "" ? (
            <DrawerDescription className="text-xs">{description}</DrawerDescription>
          ) : null}
        </DrawerHeader>
        <div
          className={cn(
            "min-h-0 flex-1 overscroll-contain",
            bodyClassName ?? "overflow-y-auto px-4 py-3",
          )}
        >
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

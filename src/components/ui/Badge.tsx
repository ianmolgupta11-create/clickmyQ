"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "primary" | "success" | "warning" | "error" | "info" | "secondary";
  size?: "sm" | "md" | "lg";
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", size = "md", children, ...props }, ref) => {
    const variants = {
      default: "bg-secondary-100 text-secondary-800",
      primary: "bg-primary-100 text-primary-800",
      success: "bg-success-50 text-success-700",
      warning: "bg-warning-50 text-warning-700",
      error: "bg-error-50 text-error-700",
      info: "bg-info-50 text-info-700",
      secondary: "bg-secondary-200 text-secondary-900",
    };
    
    const sizes = {
      sm: "px-2 py-0.5 text-xs",
      md: "px-2.5 py-1 text-sm",
      lg: "px-3 py-1.5 text-base",
    };
    
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center font-medium rounded-full",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export { Badge };

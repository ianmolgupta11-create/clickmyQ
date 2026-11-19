"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "xl";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";
    
    const variants = {
      primary: "bg-gradient-to-r from-primary-500 to-primary-700 text-white hover:from-primary-600 hover:to-primary-800 hover:shadow-primary hover:-translate-y-0.5 active:translate-y-0",
      secondary: "bg-secondary-900 text-white hover:bg-secondary-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
      outline: "border-2 border-primary-500 text-primary-700 hover:bg-primary-50 hover:border-primary-600 active:bg-primary-100",
      ghost: "text-secondary-700 hover:bg-secondary-100 hover:text-secondary-900 active:bg-secondary-200",
      danger: "bg-error-600 text-white hover:bg-error-700 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0",
    };
    
    const sizes = {
      sm: "px-4 py-2 text-sm rounded-lg",
      md: "px-6 py-2.5 text-base rounded-lg",
      lg: "px-8 py-3 text-base rounded-xl",
      xl: "px-10 py-4 text-lg rounded-xl",
    };
    
    return (
      <button
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };

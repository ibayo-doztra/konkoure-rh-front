import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-[6px] border border-[#EAEAEA] dark:border-[rgb(55_65_81)] bg-transparent bg-clip-padding px-[15px] py-[5px] text-[16px] font-normal leading-[1.5] text-black dark:text-foreground [transition:border-color_.15s_ease-in-out,box-shadow_.15s_ease-in-out] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 max-md:mb-[0.625rem]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };

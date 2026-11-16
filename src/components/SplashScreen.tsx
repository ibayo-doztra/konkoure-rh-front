import iconAsset from "@/assets/konkoure-icon.png";

export function SplashScreen() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-5 bg-background">
      <span className="inline-flex items-center rounded-xl dark:bg-white dark:p-2">
        <img
          src={iconAsset}
          alt="Konkouré"
          className="h-16 w-16 animate-pulse object-contain"
          width={64}
          height={64}
        />
      </span>
      <div className="text-lg font-medium tracking-tight text-foreground">Konkouré</div>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

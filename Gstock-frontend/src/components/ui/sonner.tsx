import { CircleCheck, Info, Loader2, OctagonX, TriangleAlert } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

// Notifications « Marché » : contour encre, ombre décalée, thème clair uniquement.
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-center"
      icons={{
        success: <CircleCheck className="size-5 text-paid-ink" />,
        info: <Info className="size-5 text-primary" />,
        warning: <TriangleAlert className="size-5 text-warn" />,
        error: <OctagonX className="size-5 text-destructive" />,
        loading: <Loader2 className="size-5 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-md !border-2 !border-foreground !bg-card !text-foreground !shadow-hard !font-sans !text-[15px] !font-semibold",
          description: "!text-muted-foreground !font-normal",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

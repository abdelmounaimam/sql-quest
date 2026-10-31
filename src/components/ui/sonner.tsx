import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Sonner restyled as paper slips with a ledge (Lantern Atlas §6.3). */
const Toaster = ({ ...props }: ToasterProps) => {
	return (
		<Sonner
			className="toaster group"
			richColors={false}
			icons={{
				success: <CircleCheckIcon className="size-5 text-success" />,
				info: <InfoIcon className="size-5 text-info" />,
				warning: <TriangleAlertIcon className="size-5 text-warning" />,
				error: <OctagonXIcon className="size-5 text-destructive" />,
				loading: <Loader2Icon className="size-5 animate-spin" />,
			}}
			toastOptions={{
				classNames: {
					toast:
						"!rounded-[18px] !border-2 !border-border !bg-popover !text-popover-foreground !shadow-[0_4px_0_var(--ledge),0_12px_24px_-12px_var(--ink-shadow)] !font-sans",
					title: "!font-extrabold !text-[15px]",
					description: "!text-[13px] !text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };

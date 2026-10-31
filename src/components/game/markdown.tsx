import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "#/lib/utils";

/**
 * Inline code chips up to this many characters never split across lines
 * (`white-space: nowrap` in .md code). Longer ones get data-long and wrap
 * anywhere, so a chip can never be wider than a 375px phone column.
 */
const SHORT_CHIP = 24;

const components: Components = {
	code({ node: _node, children, ...props }) {
		const text =
			typeof children === "string" ? children : String(children ?? "");
		const long = text.length > SHORT_CHIP || text.includes("\n");
		return (
			<code {...props} data-long={long ? "" : undefined}>
				{children}
			</code>
		);
	},
};

export function Markdown({
	children,
	className,
}: {
	children: string;
	className?: string;
}) {
	return (
		<div className={cn("md text-[0.95rem] text-muted-foreground", className)}>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{children}
			</ReactMarkdown>
		</div>
	);
}

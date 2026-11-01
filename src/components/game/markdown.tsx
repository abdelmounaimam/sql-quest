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
	// A table wider than the card scrolls sideways inside its own box. While it
	// can scroll, a horizontal drag scrolls the table instead of swiping the
	// lesson card away (the card listens to pointerdown for its swipe).
	table({ node: _node, ...props }) {
		return (
			<div
				className="md-table"
				onPointerDownCapture={(e) => {
					const el = e.currentTarget;
					if (el.scrollWidth > el.clientWidth + 1) e.stopPropagation();
				}}
			>
				<table {...props} />
			</div>
		);
	},
};

/** Inline flavour: paragraphs become plain runs, so the text sits in a label or a sentence. */
const inlineComponents: Components = {
	...components,
	p({ node: _node, children }) {
		return <>{children}</>;
	},
};

export function Markdown({
	children,
	className,
	inline = false,
}: {
	children: string;
	className?: string;
	/** Render inside a span with no paragraph margins (quiz choices, one-line stories). */
	inline?: boolean;
}) {
	if (inline)
		return (
			<span className={cn("md md-inline", className)}>
				<ReactMarkdown
					remarkPlugins={[remarkGfm]}
					components={inlineComponents}
				>
					{children}
				</ReactMarkdown>
			</span>
		);
	return (
		<div className={cn("md text-[0.95rem] text-muted-foreground", className)}>
			<ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
				{children}
			</ReactMarkdown>
		</div>
	);
}

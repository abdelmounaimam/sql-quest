import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import TanStackQueryDevtools from "./tanstack-query/devtools";

export default function Devtools() {
	return (
		<TanStackDevtools
			// Hidden unless the URL carries ?tanstack-devtools, so the trigger never covers game controls.
			config={{ position: "bottom-left", requireUrlFlag: true }}
			plugins={[
				{ name: "Tanstack Router", render: <TanStackRouterDevtoolsPanel /> },
				TanStackQueryDevtools,
			]}
		/>
	);
}

import { useEffect, useState } from "react";

export function useMediaQuery(query: string, initial = false): boolean {
	const [match, setMatch] = useState(() =>
		typeof window === "undefined" ? initial : window.matchMedia(query).matches,
	);
	useEffect(() => {
		const mq = window.matchMedia(query);
		const on = () => setMatch(mq.matches);
		on();
		mq.addEventListener("change", on);
		return () => mq.removeEventListener("change", on);
	}, [query]);
	return match;
}

export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)", true);

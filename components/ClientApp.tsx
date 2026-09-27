"use client";

import dynamic from "next/dynamic";

// The map is drawn with d3 and check-ins live in the browser, so the app is
// rendered on the client only.
const PubMapApp = dynamic(() => import("./PubMapApp"), { ssr: false });

export default function ClientApp() {
  return <PubMapApp />;
}

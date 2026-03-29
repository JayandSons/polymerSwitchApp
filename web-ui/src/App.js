import { useEffect, useState } from "react";
export function App() {
    const [health, setHealth] = useState(null);
    useEffect(() => {
        fetch("/api/health")
            .then((r) => r.json())
            .then(setHealth)
            .catch(() => setHealth(null));
    }, []);
    return (<div style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>Kanban Agent Runner</h1>
      <p>Board UI coming in Loop 1.</p>
      {health && (<p style={{ color: "#666", fontSize: "0.875rem" }}>
          Server: {health.status} (uptime: {Math.round(health.uptime)}s)
        </p>)}
    </div>);
}

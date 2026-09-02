import clsx from "clsx";

export type ConnectionState = "connecting" | "connected" | "disconnected" | "reconnecting";

interface ConnectionStatusProps {
  status: ConnectionState;
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  if (status === "connected") return null;

  return (
    <div
      className={clsx(
        "px-3 py-1.5 text-xs text-center font-medium transition-colors border-b",
        status === "connecting" && "bg-blue-950/60 border-blue-800/50 text-blue-200",
        status === "reconnecting" && "bg-amber-950/60 border-amber-800/50 text-amber-200",
        status === "disconnected" && "bg-red-950/60 border-red-800/50 text-red-200"
      )}
    >
      {status === "connecting" && "Connecting to live chat..."}
      {status === "reconnecting" && "Connection lost. Reconnecting to live chat..."}
      {status === "disconnected" && "Live chat disconnected. Refresh to reconnect."}
    </div>
  );
}

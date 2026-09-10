export { useConnectivityStore, recordConnectivityFailure } from "./store/connectivityStore";
export type { FailureEntry } from "./store/connectivityStore";
export { isConnectivityFailure, statusOf, stripQuery } from "./lib/failureKind";
export { default as ConnectivityWall } from "./ui/ConnectivityWall";

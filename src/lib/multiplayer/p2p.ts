/**
 * Unused template leftover. The archive (and the public repo) imported this
 * module from `index.ts` without shipping the implementation. Nothing in the
 * wardrobe app calls it. The exports exist so `tsc` can resolve the import.
 */

export const defaultIceServers: RTCIceServer[] = [];

export type SignalKind = "offer" | "answer" | "ice";

export type PeerInfo = {
  id: string;
  name?: string;
};

export type P2PRoomOptions = {
  roomId: string;
  iceServers?: RTCIceServer[];
};

export type PeerRow = {
  id: string;
  roomId: string;
};

export type SignalRow = {
  id: string;
  kind: SignalKind;
  payload: string;
};

export type RtcPollResponse = {
  peers: PeerRow[];
  signals: SignalRow[];
};

export class P2PRoom {
  readonly roomId: string;

  constructor(options: P2PRoomOptions) {
    this.roomId = options.roomId;
  }
}

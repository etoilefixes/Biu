import { create } from 'zustand';
import { User, FriendRequest } from '@biu/shared';

interface FriendStore {
  receivedRequests: FriendRequest[];
  sentRequests: FriendRequest[];
  friends: User[];
  pendingRequestCount: number;
  setReceivedRequests: (requests: FriendRequest[]) => void;
  setSentRequests: (requests: FriendRequest[]) => void;
  setFriends: (friends: User[]) => void;
  addReceivedRequest: (request: FriendRequest) => void;
  removeReceivedRequest: (requestId: string) => void;
  clear: () => void;
}

export const useFriendStore = create<FriendStore>((set) => ({
  receivedRequests: [],
  sentRequests: [],
  friends: [],
  pendingRequestCount: 0,
  setReceivedRequests: (requests) => set({ receivedRequests: requests, pendingRequestCount: requests.length }),
  setSentRequests: (requests) => set({ sentRequests: requests }),
  setFriends: (friends) => set({ friends }),
  addReceivedRequest: (request) =>
    set((state) => ({
      receivedRequests: [request, ...state.receivedRequests],
      pendingRequestCount: state.pendingRequestCount + 1,
    })),
  removeReceivedRequest: (requestId) =>
    set((state) => ({
      receivedRequests: state.receivedRequests.filter((r) => r.id !== requestId),
      pendingRequestCount: state.pendingRequestCount - 1,
    })),
  clear: () =>
    set({
      receivedRequests: [],
      sentRequests: [],
      friends: [],
      pendingRequestCount: 0,
    }),
}));

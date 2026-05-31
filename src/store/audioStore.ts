type Listener = () => void;

let muted = true;
const listeners = new Set<Listener>();

export const audioStore = {
  getMuted: () => muted,
  setMuted: (value: boolean) => {
    muted = value;
    listeners.forEach((l) => l());
  },
  toggle: () => audioStore.setMuted(!muted),
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

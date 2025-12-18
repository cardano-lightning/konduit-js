import { reactive, readonly } from "vue";

export type LogType = 'info' | 'success' | 'warning' | 'error' | 'debug'

export type LogEntry = {
  id: bigint;
  message: string;
  payload: unknown;
  type: LogType;
  timestamp: number;
}

type LogState = {
  pending: LogEntry[]
  history: LogEntry[]
}

const state = reactive<LogState>({
  pending: [],
  history: []
})

export function isEmpty(): boolean {
  return state.pending.length == 0
}

export type Id = bigint

let idCounter: Id = 0n

export function push(message: string, type: LogEntry['type'] = 'info', payload: unknown = null): Id {
  const entry: LogEntry = {
    id: idCounter++,
    message,
    payload,
    type,
    timestamp: Date.now()
  }

  state.pending.push(entry)
  return entry.id
}

export function pop(): LogEntry | null {
  const head: LogEntry | undefined = state.pending.shift();
  if (head) {
    state.history.unshift(head);
    return head;
  }
  return null;
}

// Move a log entry directly to the history
export function archive(message: string, type: LogEntry['type'] = 'info', payload: unknown = null): Id {
  const entry: LogEntry = {
    id: idCounter++,
    message,
    payload,
    type,
    timestamp: Date.now()
  }
  state.history.unshift(entry);
  return entry.id;
}

export function preview(entryId: Id): LogEntry | null {
  if(entryId > 0n && entryId < idCounter) {
    for (const entry of state.pending) {
      if (entry.id === entryId) {
        return entry;
      }
    }
    for (const entry of state.history) {
      if (entry.id === entryId) {
        return entry;
      }
    }
  }
  return null;
}

export function clearHistory(): void {
  state.history = []
}

export function clearPending(): void {
  state.pending = []
}

export const logs = readonly(state)

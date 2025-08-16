// Event system for handling processing events

export interface Event {
  type: string;
  payload: any;
  timestamp: number;
  id: string;
}

export type EventHandler = (event: Event) => Promise<void>;

export class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  async emit(eventType: string, payload: any): Promise<void> {
    const event: Event = {
      type: eventType,
      payload,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    };

    const handlers = this.handlers.get(eventType) || [];
    
    // Execute all handlers concurrently
    await Promise.allSettled(
      handlers.map(handler => handler(event))
    );
  }

  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}
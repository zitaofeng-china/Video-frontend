// chatDeduplication.ts - Utility for chat message deduplication
import { MessageDeduplication } from '../types';

export class ChatDeduplicationManager implements MessageDeduplication {
  messageIds: Set<string>;
  maxSize: number = 1000;
  pruneSize: number = 200;
  private messageIdArray: string[] = []; // Track insertion order

  constructor(maxSize: number = 1000, pruneSize: number = 200) {
    this.messageIds = new Set();
    this.maxSize = maxSize;
    this.pruneSize = pruneSize;
  }

  /**
   * Generate a stable message ID
   */
  static generateMessageId(timestamp: number, sender: string): string {
    return `chat-${timestamp}-${sender}`;
  }

  /**
   * Check if a message ID is a duplicate
   */
  isDuplicate(messageId: string): boolean {
    return this.messageIds.has(messageId);
  }

  /**
   * Add a new message ID
   */
  addMessageId(messageId: string): void {
    if (!this.messageIds.has(messageId)) {
      this.messageIds.add(messageId);
      this.messageIdArray.push(messageId);
      
      // Auto-prune if size exceeds max
      if (this.messageIds.size > this.maxSize) {
        this.pruneOldMessages();
      }
    }
  }

  /**
   * Prune old message IDs when size exceeds limit
   */
  pruneOldMessages(): void {
    if (this.messageIdArray.length <= this.maxSize) {
      return;
    }

    // Remove oldest entries
    const toRemove = this.messageIdArray.splice(0, this.pruneSize);
    toRemove.forEach(id => this.messageIds.delete(id));
    
    console.log(`[ChatDeduplication] Pruned ${toRemove.length} old message IDs`);
  }

  /**
   * Clear all message IDs (when leaving room)
   */
  clear(): void {
    this.messageIds.clear();
    this.messageIdArray = [];
  }

  /**
   * Get current size
   */
  size(): number {
    return this.messageIds.size;
  }
}

// Helper function to format timestamp for display
export function formatMessageTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  
  if (isToday) {
    return `${hours}:${minutes}`;
  } else {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  }
}

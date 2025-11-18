/**
 * Analytics Service
 *
 * Handles event tracking and batching for analytics providers.
 */

import type { AnalyticsEvent } from "./index.js";

export class AnalyticsService {
  private eventQueue: AnalyticsEvent[] = [];
  private flushTimer?: NodeJS.Timeout;

  constructor(
    private provider: string,
    private apiKey: string,
    private batchSize: number = 100,
    private flushInterval: number = 5000,
    private customHandler?: (events: AnalyticsEvent[]) => Promise<void>
  ) {
    this.startFlushTimer();
  }

  /**
   * Track an analytics event
   */
  track(event: AnalyticsEvent): void {
    this.eventQueue.push({
      ...event,
      timestamp: event.timestamp || Date.now(),
    });

    // Flush if batch is full
    if (this.eventQueue.length >= this.batchSize) {
      this.flush();
    }
  }

  /**
   * Flush queued events to analytics provider
   */
  private async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0, this.batchSize);

    try {
      if (this.provider === "mixpanel") {
        await this.sendToMixpanel(events);
      } else if (this.provider === "segment") {
        await this.sendToSegment(events);
      } else if (this.provider === "custom" && this.customHandler) {
        await this.customHandler(events);
      }
    } catch (error) {
      console.error("Analytics flush failed:", error);
      // Re-queue events for retry (simple approach - in production, use proper queue)
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Send events to Mixpanel
   */
  private async sendToMixpanel(events: AnalyticsEvent[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Mixpanel API key not provided");
    }

    // Mixpanel Track API
    const url = `https://api.mixpanel.com/track`;

    for (const event of events) {
      const mixpanelEvent = {
        event: event.event,
        properties: {
          ...event.properties,
          token: this.apiKey,
          time: event.timestamp,
          distinct_id: event.userId || "anonymous",
        },
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify([mixpanelEvent]),
        });

        if (!response.ok) {
          throw new Error(
            `Mixpanel API error: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        console.error("Failed to send event to Mixpanel:", error);
        throw error;
      }
    }
  }

  /**
   * Send events to Segment
   */
  private async sendToSegment(events: AnalyticsEvent[]): Promise<void> {
    if (!this.apiKey) {
      throw new Error("Segment write key not provided");
    }

    // Segment Track API
    const url = `https://api.segment.io/v1/track`;

    for (const event of events) {
      const segmentEvent = {
        userId: event.userId,
        event: event.event,
        properties: event.properties,
        timestamp: new Date(event.timestamp || Date.now()).toISOString(),
      };

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(this.apiKey + ":").toString("base64")}`,
          },
          body: JSON.stringify(segmentEvent),
        });

        if (!response.ok) {
          throw new Error(
            `Segment API error: ${response.status} ${response.statusText}`
          );
        }
      } catch (error) {
        console.error("Failed to send event to Segment:", error);
        throw error;
      }
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop the flush timer (cleanup)
   */
  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    // Flush remaining events
    this.flush();
  }
}

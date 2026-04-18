import { DsuClient } from "../lib/core/DsuClient.ts";
import { Event } from "../lib/core/Event.ts";

// Needs to be default export if you plan to add it.

//@ts-expect-error "clientEventName" is not valid.
export class EventName extends Event<"clientEventName"> {
  constructor(client: DsuClient) {
    /**
     * super call takes client and the eventName as keyof ClientEvents.
     */
    super(client, "clientEventName");
  }

  /**
   * run arguments relate to the Discord.js event implementation
   * @see https://discord.js.org/docs/packages/discord.js/14.18.0/ClientEvents:Interface
   */
  async run() {}
}

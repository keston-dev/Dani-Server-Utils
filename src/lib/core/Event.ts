import { ClientEvents } from "discord.js";
import { DsuClient } from "./DsuClient.ts";

export abstract class Event<Key extends keyof ClientEvents = keyof ClientEvents> {
  name: Key;

  client: DsuClient;

  constructor(client: DsuClient, name: Key) {
    this.client = client;
    this.name = name;
  }

  /**
   * The method used to handle the gateway event.
   * @param args The appropriate args based on {@link ClientEvents}
   */
  abstract run(...args: ClientEvents[Key]): Promise<void>;
}

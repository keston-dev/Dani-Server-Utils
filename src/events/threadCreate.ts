import { DsuClient } from "../lib/core/DsuClient.ts";
import { AnyThreadChannel } from "discord.js";
import { Event } from "../lib/core/Event.ts";

export default class ThreadCreate extends Event<"threadCreate"> {
  constructor(client: DsuClient) {
    super(client, "threadCreate");
  }

  override async run(thread: AnyThreadChannel) {
    await this.client.utilities.autoPing.onThreadCreated(thread);
  }
}

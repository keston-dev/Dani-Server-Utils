import { MessageReaction, User } from "discord.js";

import { DsuClient } from "../lib/core/DsuClient.ts";
import { EmojiSuggestionsUtility } from "../lib/utilities/emojiSuggestions";
import { Event } from "../lib/core/Event.ts";

export default class MessageReactionAdd extends Event<"messageReactionAdd"> {
  constructor(client: DsuClient) {
    super(client, "messageReactionAdd");
  }

  async run(messageReaction: MessageReaction, user: User) {
    await EmojiSuggestionsUtility.onReaction(this.client, messageReaction, user);
  }
}

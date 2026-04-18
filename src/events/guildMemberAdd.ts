import { DsuClient } from "../lib/core/DsuClient.ts";
import { GuildMember } from "discord.js";
import { Event } from "../lib/core/Event.ts";

export default class GuildMemberAdd extends Event<"guildMemberAdd"> {
  constructor(client: DsuClient) {
    super(client, "guildMemberAdd");
  }

  override async run(member: GuildMember) {
    const name = await this.client.utilities.badName.getNameFromMemory(
      member.id,
      member.guild.id,
    );
    if (name) {
      await member.setNickname(name);
    }
  }
}

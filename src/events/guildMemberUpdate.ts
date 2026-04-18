import { DsuClient } from "../lib/core/DsuClient.ts";
import { GuildMember } from "discord.js";
import { Event } from "../lib/core/Event.ts";

export default class GuildMemberUpdate extends Event<"guildMemberUpdate"> {
  constructor(client: DsuClient) {
    super(client, "guildMemberUpdate");
  }

  override async run(oldMember: GuildMember, newMember: GuildMember) {
    const newNickName = newMember.nickname ?? newMember.user.username;
    if (oldMember.nickname !== newNickName) {
      const nameInMemory = await this.client.utilities.badName.getNameFromMemory(
        newMember.id,
        newMember.guild.id,
      );
      if (nameInMemory !== "" && nameInMemory !== newNickName) {
        await this.client.utilities.badName.setNameInMemory(
          newMember.id,
          newMember.guild.id,
          "",
        );
      }
    }
  }
}

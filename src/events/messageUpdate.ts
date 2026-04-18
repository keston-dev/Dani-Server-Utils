import { DsuClient } from "../lib/core/DsuClient.ts";
import { Message, OmitPartialGroupDMChannel } from "discord.js";
import { SettingsModel } from "models/Settings";
import { Event } from "../lib/core/Event.ts";

export default class MessageUpdate extends Event<"messageUpdate"> {
  constructor(client: DsuClient) {
    super(client, "messageUpdate");
  }

  async run(_: OmitPartialGroupDMChannel<Message>, newMessage: Message) {
    if (newMessage.author.bot) return;
    if (newMessage.guild && !this.client.settings.has((newMessage.guild || {}).id)) {
      // We don't have the settings for this guild, find them or generate empty settings
      const s = await SettingsModel.findOneAndUpdate(
        { _id: newMessage.guild.id },
        { toUpdate: true },
        {
          upsert: true,
          setDefaultsOnInsert: true,
          new: true,
        },
      )
        .populate("mentorRoles")
        .populate("commands");

      this.client.logger.info(
        `Setting sync: Fetch Database -> Client (${newMessage.guild.id})`,
      );

      this.client.settings.set(newMessage.guild.id, s);
      newMessage.settings = s;
    } else {
      const s = this.client.settings.get(
        newMessage.guild ? newMessage.guild.id : "default",
      );
      if (!s) return;
      newMessage.settings = s;
    }

    const level = this.client.getPermLevel(newMessage, newMessage.member!);
    const link = this.client.utilities.linkHandler.parseMessageForLink(
      newMessage.content,
    );

    const canSendLinks = await this.client.utilities.linkHandler.checkLinkPermissions(
      newMessage.guildId ?? "",
      newMessage.channelId,
      newMessage.author.id,
      newMessage.member?.roles.cache.map((role) => role.id) ?? [],
    );

    if (!canSendLinks && level < 3 && link.hasUrls) {
      await newMessage
        .delete()
        .catch(() =>
          this.client.logger.error(`Failed to delete message containing link.`),
        );
      return;
    }
  }
}

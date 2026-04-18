import { Interaction, MessageFlags } from "discord.js";

import { DsuClient } from "../lib/core/DsuClient.ts";
import { ISettings } from "types/mongodb";
import { SettingsModel } from "models/Settings";
import { TriggerModel } from "models/Trigger";
import { Event } from "../lib/core/Event.ts";

export default class InteractionCreate extends Event<"interactionCreate"> {
  constructor(client: DsuClient) {
    super(client, "interactionCreate");
  }

  override async run(interaction: Interaction) {
    if (!interaction.guild) return;
    if (interaction.guild && !this.client.settings.has((interaction.guild || {}).id)) {
      // We don't have the settings for this guild, find them or generate empty settings
      const s: ISettings = await SettingsModel.findOneAndUpdate(
        { _id: interaction.guild.id },
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
        `Setting sync: Fetch Database -> Client (${interaction.guild.id})`,
      );

      this.client.settings.set(interaction.guild.id, s);
      interaction.settings = s;
    } else {
      const s = this.client.settings.get(
        interaction.guild ? interaction.guild.id : "default",
      );
      if (!s) return;
      interaction.settings = s;
    }

    const isAutocomplete = interaction.isAutocomplete();

    if (isAutocomplete) {
      await this.client.utilities.autoPing.onForumTagComplete(interaction);
    }

    // TODO emojis

    const isButton = interaction.isButton();

    // can't be moved since its dynamic
    if (isButton) {
      const triggerIds = interaction.settings.triggers.map((t) => `trigger-${t.id}`);

      for (const id of triggerIds) {
        if (interaction.customId != id) {
          continue;
        }

        const user = interaction.user;
        const optedOut = await TriggerModel.exists({
          guildId: interaction.guild.id,
          userId: user.id,
          triggerId: id,
        });

        if (optedOut) {
          // Nuh uh
          await interaction.reply({
            content: "You have already opted out in this guild.",
            flags: [MessageFlags.Ephemeral],
          });
        } else {
          await new TriggerModel({
            guildId: interaction.guild.id,
            userId: user.id,
            triggerId: id,
          }).save();

          await interaction.reply({
            content: "We will not remind you in this guild again.",
            flags: [MessageFlags.Ephemeral],
          });
        }
      }
    }

    try {
      if (interaction.isChatInputCommand()) {
        const command = this.client.commands.get(interaction.commandName);

        if (!command) return;

        await command.preCheck(interaction);
      } else if (interaction.isAutocomplete()) {
        const command = this.client.commands.get(interaction.commandName);
        if (command && command.autoComplete) {
          const focused = interaction.options.getFocused(true);
          return command.autoComplete(interaction, focused);
        }
      }
    } catch (error) {
      this.client.logger.error(`Failed to handle command ${interaction.id}: ${error}`);
    }
  }
}

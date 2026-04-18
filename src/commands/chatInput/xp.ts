import { Command } from "../../lib/core/Command.ts";
import { DsuClient } from "../../lib/core/DsuClient.ts";
import { PermissionLevels } from "types/commands.ts";
import {
  APIEmbed,
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  AttachmentBuilder,
  ChatInputCommandInteraction,
  InteractionContextType,
} from "discord.js";
import { XpModel } from "models/Xp.ts";
import XpManager from "../../lib/core/XpManager.ts";
import { generateXpCard } from "../../lib/ui/xpCard.ts";
import { SettingsModel } from "models/Settings.ts";

const BOT_COMMANDS_CHANNEL = "594178859453382696";

export default class XpCommand extends Command {
  constructor(client: DsuClient) {
    super(client, {
      name: "xp",
      description: "View xp related commands",
      minimumPermissionLevel: PermissionLevels.USER,
      type: ApplicationCommandType.ChatInput,
      contexts: [InteractionContextType.Guild],
      integration: [ApplicationIntegrationType.GuildInstall],
      options: [
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "get",
          description: "Show your own or someone else's current xp level!",
          permissionLevel: PermissionLevels.USER,
          options: [
            {
              name: "user",
              description: "The user to check the XP level for.",
              type: ApplicationCommandOptionType.User,
              required: false,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "leaderboard",
          description: "Show the XP leaderboard!",
          permissionLevel: PermissionLevels.USER,
          options: [
            {
              name: "limit",
              description: "The max amount of leaderboard positions to show.",
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              max_value: 25,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "transfer",
          description: "Transfer XP to another user.",
          permissionLevel: PermissionLevels.ADMINISTRATOR,
          options: [
            {
              name: "old_account",
              description: "The user to remove XP from.",
              type: ApplicationCommandOptionType.User,
              required: true,
            },
            {
              name: "new_account",
              description: "The user the XP will transfer to.",
              type: ApplicationCommandOptionType.User,
              required: true,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "calc",
          description: "Calculate time needed to reach a level!",
          permissionLevel: PermissionLevels.USER,
          options: [
            {
              name: "level",
              description: "Target level to calculate",
              type: ApplicationCommandOptionType.Number,
              min_value: 1,
              required: true,
            },
            {
              name: "user",
              description: "The user to check the XP level for.",
              type: ApplicationCommandOptionType.User,
              required: false,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "addrole",
          description: "Add an XP role to the server!",
          permissionLevel: PermissionLevels.ADMINISTRATOR,
          options: [
            {
              name: "role",
              description: "The role to add to the XP roles!",
              type: ApplicationCommandOptionType.Role,
              required: true,
            },
            {
              name: "level",
              description: "The level to add the role to!",
              type: ApplicationCommandOptionType.Number,
              required: true,
              min_value: 1,
              max_value: 100,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "removerole",
          description: "Remove an XP role from the server!",
          permissionLevel: PermissionLevels.ADMINISTRATOR,
          options: [
            {
              name: "role",
              description: "The role to remove from the XP roles!",
              type: ApplicationCommandOptionType.Role,
              required: true,
            },
          ],
        },
        {
          type: ApplicationCommandOptionType.Subcommand,
          name: "listroles",
          description: "List all XP roles for the server!",
          permissionLevel: PermissionLevels.ADMINISTRATOR,
        },
      ],
    });
  }

  override async run(interaction: ChatInputCommandInteraction) {
    try {
      if (interaction.channelId !== BOT_COMMANDS_CHANNEL) {
        await interaction.deferReply({ flags: "Ephemeral" });
      } else {
        await interaction.deferReply();
      }
    } catch (error) {
      return;
    }

    if (!interaction.guild) return;

    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case "get":
        await this.handleGet(interaction);
        break;
      case "leaderboard":
        await this.handleLeaderboard(interaction);
        break;
      case "calc":
        await this.handleCalc(interaction);
        break;
      case "addrole":
        await this.handleRole(interaction, "add");
        break;
      case "removerole":
        await this.handleRole(interaction, "remove");
        break;
      case "listroles":
        await this.handleRole(interaction, "list");
        break;
      case "transfer":
        await this.handleTransfer(interaction);
        break;
    }
  }

  private async handleGet(interaction: ChatInputCommandInteraction) {
    const user = interaction.options.getUser("user") ?? interaction.user;
    const xpModel = await this.getOrCreateXpModel(interaction.guildId!, user.id);
    const xpManager = new XpManager(xpModel.expAmount);

    const rank =
      (await XpModel.countDocuments({
        guildId: interaction.guildId,
        expAmount: { $gt: xpModel.expAmount },
      })) + 1;

    const buffer = await generateXpCard({
      username: user.displayName,
      avatarURL: user.displayAvatarURL({ extension: "png", size: 256 }),
      level: xpManager.level,
      xpNeeded: xpManager.exp + xpManager.next,
      xp: xpManager.exp,
      rank,
    });

    const attachment = new AttachmentBuilder(buffer, { name: "xp_card.png" });

    await interaction.editReply({ files: [attachment] });
  }

  private async handleLeaderboard(interaction: ChatInputCommandInteraction) {
    const limit = Math.min(interaction.options.getNumber("limit") ?? 10, 25);
    const topUsers = await XpModel.find({ guildId: interaction.guildId })
      .select("userId expAmount")
      .sort({ expAmount: -1 })
      .limit(limit);

    if (topUsers.length === 0) {
      return interaction.editReply({
        embeds: [
          {
            title: "Failed to retrieve leaderboard.",
            color: this.client.config.colors.error,
            description: "No XP data available for this server yet.",
          },
        ],
      });
    }

    const leaderboardEntries = topUsers.map((user, index) => {
      const xpManager = new XpManager(user.expAmount);
      return {
        rank: index + 1,
        user: user.userId,
        level: xpManager.level,
        totalExp: user.expAmount,
      };
    });

    const leaderboardText = leaderboardEntries
      .map(
        (entry) =>
          `**${entry.rank}${this.getSuffix(entry.rank)}**, at level **${entry.level}** (${entry.totalExp.toLocaleString()} total exp) - <@${entry.user}>`,
      )
      .join("\n");

    const embed = {
      title: `${interaction.guild?.name}'s XP Leaderboard`,
      description: leaderboardText,
      color: this.client.config.colors.primary,
      footer: {
        text: `Total participants: ${await XpModel.countDocuments({ guildId: interaction.guildId })}`,
      },
    } satisfies APIEmbed;

    return interaction.editReply({ embeds: [embed] });
  }

  private async handleCalc(interaction: ChatInputCommandInteraction) {
    const targetLevel = interaction.options.getNumber("level", true);
    const user = interaction.options.getUser("user") ?? interaction.user;

    const xpModel = await XpModel.findOne({
      guildId: interaction.guildId,
      userId: user.id,
    });

    if (!xpModel) {
      return interaction.editReply({
        embeds: [
          {
            title: "Failed to retrieve calc info.",
            color: this.client.config.colors.error,
            description: "User has no XP data yet.",
          },
        ],
      });
    }

    const xpManager = new XpManager(xpModel.expAmount);
    const targetResult = xpManager.digestLevel(targetLevel);
    const currentResult = xpManager.digestExp(xpModel.expAmount);
    const xpNeeded = targetResult.totalExp - currentResult.totalExp;
    const messagesNeeded = Math.ceil(xpNeeded / XpManager.EXP_PER_MESSAGE);
    const timeLeftMs = messagesNeeded * XpManager.EXP_COOLDOWN;

    const totalMessages = Math.ceil(
      (xpManager.totalExp + xpNeeded) / XpManager.EXP_PER_MESSAGE,
    );
    const totalTimeMs = totalMessages * XpManager.EXP_COOLDOWN;
    const messagesSoFar = Math.ceil(xpManager.totalExp / XpManager.EXP_PER_MESSAGE);
    const timeSpentMs = messagesSoFar * XpManager.EXP_COOLDOWN;

    const timeString = this.client.utilities.timeParser.parseDurationToString(
      totalTimeMs,
      {
        allowedUnits: ["day", "hour", "minute"],
      },
    );
    const timeSpent = this.client.utilities.timeParser.parseDurationToString(
      timeSpentMs,
      {
        allowedUnits: ["day", "hour", "minute"],
      },
    );
    const timeLeft = this.client.utilities.timeParser.parseDurationToString(timeLeftMs, {
      allowedUnits: ["day", "hour", "minute"],
    });

    return interaction.editReply({
      embeds: [
        {
          title: `Xp Calculation for Level ${targetLevel}`,
          color: this.client.config.colors.primary,
          fields: [
            {
              name: "Current Level",
              value: `${currentResult.level}`,
              inline: true,
            },
            {
              name: "Current XP Progress",
              value: `${currentResult.totalExp.toLocaleString()} total XP`,
              inline: true,
            },
            {
              name: "XP Needed for Target",
              value: `${(targetResult.totalExp - currentResult.totalExp).toLocaleString()} XP`,
              inline: true,
            },
            {
              name: "Target Level Total XP",
              value: `${targetResult.totalExp.toLocaleString()} XP`,
              inline: true,
            },
            {
              name: "XP Progress to Target",
              value: `${currentResult.totalExp.toLocaleString()} / ${targetResult.totalExp.toLocaleString()} XP`,
              inline: true,
            },
            {
              name: "Time Investment (Total)",
              value: timeString || "0 minutes",
            },
            { name: "Time Spent", value: timeSpent || "0 minutes" },
            { name: "Time Left", value: timeLeft || "0 minutes" },
          ],
        } as APIEmbed,
      ],
    });
  }

  private async handleRole(
    interaction: ChatInputCommandInteraction,
    state: "add" | "remove" | "list",
  ) {
    const role = interaction.options.getRole("role", true);
    const settings = await SettingsModel.findOne({ _id: interaction.guildId });

    if (!settings) return;

    let description: string;

    if (state === "add") {
      const level = interaction.options.getNumber("level", true);
      settings.xpRoles.push({ roleId: role.id, level });
      description = `Added XP role ${role} to level ${level}.`;
    } else if (state === "remove") {
      settings.xpRoles = settings.xpRoles.filter((r) => r.roleId !== role.id);
      description = `Removed XP role ${role}.`;
    } else {
      description =
        settings.xpRoles.length > 0
          ? settings.xpRoles.map((r) => `**${r.level}**: <@&${r.roleId}>`).join("\n")
          : "No XP roles have been configured for this server.";
      return interaction.editReply({
        embeds: [
          {
            color: this.client.config.colors.primary,
            description,
          },
        ],
      });
    }
    await settings.save();

    return interaction.editReply({
      embeds: [
        {
          title: `Updated roles.`,
          color: this.client.config.colors.primary,
          description,
        },
      ],
    });
  }

  private async handleTransfer(interaction: ChatInputCommandInteraction) {
    const oldAccount = interaction.options.getUser("old_account", true);
    const newAccount = interaction.options.getUser("new_account", true);
    const oldTable = await XpModel.findOne({ userId: oldAccount.id });

    if (!oldTable) {
      return interaction.followUp({
        flags: "Ephemeral",
        embeds: [
          {
            color: this.client.config.colors.error,
            title: "Failed to locate user.",
            description: `Could not find existing XP entry for user: ${oldAccount.username}`,
          },
        ],
      });
    }

    let newTable = await this.getOrCreateXpModel(interaction.guildId!, newAccount.id);

    await newTable.updateOne({
      $inc: {
        expAmount: oldTable.expAmount,
      },
      $set: {
        lastXpTimestamp: oldTable.lastXpTimestamp,
      },
    });

    await oldTable.updateOne({ $set: { expAmount: 0 } });

    return interaction.followUp({
      flags: "Ephemeral",
      embeds: [
        {
          color: this.client.config.colors.success,
          title: "Transferred XP.",
          description: `Moved ${oldAccount}'s XP data to ${newAccount}.`,
        },
      ],
    });
  }
  private async getOrCreateXpModel(guildId: string, userId: string) {
    return XpModel.findOneAndUpdate(
      { guildId, userId },
      { $setOnInsert: { expAmount: 0, messageCount: 0 } },
      { upsert: true, new: true },
    );
  }

  private getSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return "st";
    if (j === 2 && k !== 12) return "nd";
    if (j === 3 && k !== 13) return "rd";
    return "th";
  }
}

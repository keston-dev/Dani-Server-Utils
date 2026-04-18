import { CommandData, PermissionLevels, ResolvedCommandData } from "types/commands.ts";
import { DsuClient } from "./DsuClient.ts";
import {
  APIEmbed,
  ApplicationIntegrationType,
  AutocompleteFocusedOption,
  AutocompleteInteraction,
  Collection,
  CommandInteraction,
  GuildMember,
  InteractionContextType,
  MessageFlags,
} from "discord.js";
import { Times } from "types/index.ts";

export abstract class Command {
  public readonly client: DsuClient;

  public readonly data: ResolvedCommandData;

  public readonly cooldowns = new Collection<string, number>();

  constructor(client: DsuClient, data: CommandData) {
    const options = data.options ?? [];

    options.forEach((option) => {
      if ("permissionLevel" in option) {
        this.validatePermissionLevel(
          option.name,
          data.minimumPermissionLevel,
          option.permissionLevel,
        );
      }
    });

    this.client = client;
    this.data = {
      ...data,
      contexts: data.contexts ?? [InteractionContextType.Guild],
      integration: data.integration ?? [ApplicationIntegrationType.GuildInstall],
      options,
    };
  }

  private validatePermissionLevel(
    subcommandName: string,
    minimumPermissionLevel: PermissionLevels,
    commandPermissionLevel?: PermissionLevels,
  ) {
    if (!commandPermissionLevel) return;

    if (minimumPermissionLevel > commandPermissionLevel) {
      throw new Error(
        `Cannot set permission level of command lower than the minimum permission level.\n
                  Please raise the minimum, or lower this subcommand's permission level.\n
                  Subcommand: ${subcommandName}, ${minimumPermissionLevel} vs ${commandPermissionLevel}`,
      );
    }
  }

  private async validate(interaction: CommandInteraction, permLevel: PermissionLevels) {
    // We don't need to validate a user-installed command...
    if (!this.data.integration.includes(ApplicationIntegrationType.GuildInstall)) {
      return null;
    }

    const subCommand = interaction.isChatInputCommand()
      ? interaction.options.getSubcommand(false)
      : null;

    const requiredLevel = subCommand
      ? this.data.options.find((command) => command.name === subCommand)?.permissionLevel
      : this.data.minimumPermissionLevel;

    const embed: APIEmbed = {
      title: "Missing Permissions",
    };

    if (requiredLevel !== undefined && requiredLevel > permLevel) {
      embed.description = `Incorrect permission. (${requiredLevel} vs ${permLevel})`;
      return embed;
    }

    return null;
  }

  private checkCooldown(
    interaction: CommandInteraction,
    permissionLevel: PermissionLevels,
  ) {
    if (permissionLevel >= PermissionLevels.MODERATOR) return null;

    const now = Date.now();
    const cooldownTimer = (this.data.cooldown ?? 0) * Times.SECOND;
    const expiration = (this.cooldowns.get(interaction.user.id) ?? 0) + cooldownTimer;

    if (this.cooldowns.has(interaction.user.id) && now < expiration) {
      return this.client.utilities.misc.generateEmbed("error", {
        title: "Command on cooldown",
        description: `Try again in <t:${Math.round(expiration / 1000)}:R>`,
      });
    }

    this.cooldowns.set(interaction.user.id, now);
    setTimeout(() => this.cooldowns.delete(interaction.user.id), cooldownTimer);

    return null;
  }

  public async preCheck(interaction: CommandInteraction) {
    const permLevel = this.client.getPermLevel(
      undefined,
      interaction.member as GuildMember,
    );

    const validationError = await this.validate(interaction, permLevel);

    if (validationError) {
      return interaction.reply({
        embeds: [validationError],
        flags: MessageFlags.Ephemeral,
      });
    }

    const cooldownError = this.checkCooldown(interaction, permLevel);

    if (cooldownError) {
      return interaction.reply({
        embeds: [cooldownError],
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      await this.run(interaction);
    } catch (error) {
      this.client.logger.error(`[${this.data.name}] Error: ${error}`);

      const errorEmbed = this.client.utilities.misc.generateEmbed("error", {
        title: "Something went wrong.",
        description: "An unexpected error occurred. Please try again later.",
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [errorEmbed] }).catch(() => {});
      } else {
        await interaction.reply({ embeds: [errorEmbed], flags: MessageFlags.Ephemeral });
      }
    }
  }

  public abstract run(interaction: CommandInteraction): Promise<void>;

  public async autoComplete(
    _interaction: AutocompleteInteraction,
    _option: AutocompleteFocusedOption,
  ): Promise<void> {}
}

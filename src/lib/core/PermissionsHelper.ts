import { GuildMember, Message, Role } from "discord.js";
import { ISettings } from "types/mongodb.ts";
import { ClientConfig } from "types/index.ts";

/**
 * Helper class to break up repeat logic for permission checks.
 */
export class PermissionsHelper {
  /**
   * Resolves which type actually is being checked, mainly only for Mentor.
   * @param msg - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   * @returns The resolved source, or `null` if neither were provided.
   */
  static resolveSource(
    msg?: Message | null,
    member?: GuildMember | null,
  ): Message | GuildMember | null {
    return msg ?? member ?? null;
  }

  /**
   * Gets the {@link ISettings} object from either available interaction source.
   * @param msg - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   * @returns The resolved `ISettings`, or `null` if not found.
   */
  static resolveSettings(
    msg?: Message | null,
    member?: GuildMember | null,
  ): ISettings | null {
    return msg?.settings ?? member?.settings ?? null;
  }

  /**
   * Resolves a {@link Role} object from either available interaction source.
   * @param roleId - The ID of the role to resolve
   * @param msg - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   * @returns The Resolved `Role`, or `null` if neither source has a guild or the role doesn't exist.
   */
  static resolveRole(
    roleId: string,
    msg?: Message | null,
    member?: GuildMember | null,
  ): Role | null {
    if (msg?.guild) return msg.guild.roles.resolve(roleId) ?? null;
    if (member?.guild) return member.guild.roles.resolve(roleId) ?? null;
    return null;
  }

  /**
   * Checks if the interaction source has a given role its in cache
   * @param role - The {@link Role} to check for.
   * @param msg - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   */
  static hasRole(role: Role, msg?: Message | null, member?: GuildMember | null): boolean {
    return Boolean(
      msg?.member?.roles.cache.has(role.id) || member?.roles.cache.has(role.id),
    );
  }

  /**
   * Checks whether the source has a role based on the key in {@link ISettings}'s `roles`.
   * @param key - The key of the roleId within `<ISettings>.roles`
   * @param msg - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   */
  static hasRoleByKey(
    key: keyof ISettings["roles"],
    msg?: Message | null,
    member?: GuildMember | null,
  ): boolean {
    const settings = PermissionsHelper.resolveSettings(msg, member);
    if (!settings) return false;

    const role = PermissionsHelper.resolveRole(settings.roles[key], msg, member);

    return !!role && PermissionsHelper.hasRole(role, msg, member);
  }

  /**
   * Resolves the permission level for the source by checking each level function, in descending order.
   * @param permLevels - The {@link ClientConfig} perm levels to run the checks of.
   * @param message - The {@link Message} resource from the interaction
   * @param member - The {@link GuildMember} from the interaction
   * @returns The highest passing level
   */
  static resolvePermLevel(
    permLevels: ClientConfig["permLevels"],
    message?: Message | null,
    member?: GuildMember | null,
  ) {
    const permOrder = [...permLevels].sort((a, b) => b.level - a.level);

    for (const level of permOrder) {
      if (level.guildOnly && !(message?.guild || member?.guild)) continue;
      if (level.check(message, member)) return level.level;
    }

    return 0;
  }
}

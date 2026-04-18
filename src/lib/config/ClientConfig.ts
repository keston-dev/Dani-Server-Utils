import {
  ActivityType,
  IntentsBitField,
  PermissionsBitField,
  PermissionsString,
  PresenceData,
} from "discord.js";

import { ClientConfig } from "types/index.ts";
import { PermissionsHelper } from "../core/PermissionsHelper.ts";

const pkgFile = await Bun.file("./package.json").text();
const pkg = JSON.parse(pkgFile);

export const clientConfig = {
  colors: {
    primary: parseInt("6749d6", 16),
    success: parseInt("3deb54", 16),
    warning: parseInt("fff714", 16),
    error: parseInt("d92323", 16),
  },
  intents: [
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildIntegrations,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
  ],

  presence: {
    activities: [
      {
        type: ActivityType.Custom,
        state: "⚙️",
        name: "Running " + (pkg.version || "1.0.0"),
      },
    ],

    status: "online",
  } as PresenceData,

  ownerId: process.env.OWNER_ID,

  /**
   * The permissions the client will take advantage of.
   */
  requiredPermissions: ["Administrator"] as PermissionsString[],

  permLevels: [
    {
      level: 0,
      name: "User",
      check: () => true,
    },
    {
      level: 1,
      name: "Mentor",
      check: (msg, member): boolean => {
        const source = PermissionsHelper.resolveSource(msg, member);

        if (!source) return false;

        const mentorRoleIds = source.settings.mentorRoles
          .filter((r) => source.guild?.roles.resolve(r.roleID))
          .map((r) => r.roleID);

        return mentorRoleIds.some((id) =>
          "member" in source
            ? source.member?.roles.cache.has(id)
            : source.roles.cache.has(id),
        );
      },
    },
    {
      level: 2,
      name: "Helper",
      check: (msg, member) => PermissionsHelper.hasRoleByKey("helper", msg, member),
    },
    {
      level: 3,
      name: "Moderator",
      check: (msg, member) => PermissionsHelper.hasRoleByKey("moderator", msg, member),
    },
    {
      level: 4,
      name: "Administrator",
      check: (msg, member) => {
        const hasPermission = Boolean(
          msg?.member?.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
          member?.permissions.has(PermissionsBitField.Flags.ManageGuild),
        );

        return hasPermission || PermissionsHelper.hasRoleByKey("admin", msg, member);
      },
    },
    {
      level: 5,
      name: "Server Owner",
      check: (msg, member) =>
        Boolean(
          (msg && msg.member && msg.guild?.ownerId === msg.author.id) ||
          (member && member.guild.ownerId === member.id),
        ),
    },
    {
      level: 10,
      name: "Bot Owner",
      check: (message, member) =>
        Boolean(
          (message && message.author.id === clientConfig.ownerId) ||
          (member && member.id === clientConfig.ownerId),
        ),
    },
  ],
} as ClientConfig;

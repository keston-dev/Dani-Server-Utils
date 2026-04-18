import {
  ApplicationCommandOptionData,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
} from "discord.js";

export enum PermissionLevels {
  USER = 0,
  MENTOR = 1,
  HELPER = 2,
  MODERATOR = 3,
  ADMINISTRATOR = 4,
  SERVER_OWNER = 5,
  BOT_OWNER = 10,
}

type CustomApplicationCommandOptions = ApplicationCommandOptionData & {
  permissionLevel?: PermissionLevels;
};

export type CommandData = {
  type: ApplicationCommandType;
  contexts?: InteractionContextType[];
  integration?: ApplicationIntegrationType[];
  name: string;
  description: string;
  options?: CustomApplicationCommandOptions[];
  minimumPermissionLevel: PermissionLevels;
  cooldown?: number;
};

export type ResolvedCommandData = Required<
  Pick<CommandData, "contexts" | "integration" | "options">
> &
  Omit<CommandData, "contexts" | "integration">;

import { Client, ClientOptions, Collection, GuildMember, Message } from "discord.js";
import { ISettings } from "types/mongodb.ts";
import { Logger } from "./Logger.ts";
import { SettingsModel } from "models/Settings.ts";
import { TimeoutHandler } from "./TimeoutHandler.ts";
import { clientConfig } from "../config/ClientConfig.ts";
import { readdirSync } from "fs";
import mongoose from "mongoose";
import { join, resolve } from "path";
import {
  AnchorUtility,
  AutoArchiveUtility,
  AutoPingUtility,
  BadNameUtility,
  CachedAutoSlow,
  EmojiSuggestions,
  LinkHandlerUtility,
  SuggestionUtility,
  TimeParserUtility,
} from "../utilities";
import MiscUtilities from "../utilities/miscUtilities.ts";
import { Event } from "./Event.ts";
import { Command } from "./Command.ts";
import { PermissionsHelper } from "./PermissionsHelper.ts";

export class DsuClient extends Client {
  /** A more location accurate replacement for __dirname that matches the source correctly. */
  public __dirname: string;

  /** A config file with information for the client. */
  public readonly config: typeof clientConfig;
  /**
   * A more detailed logger than a typical console.log
   */
  public logger: Logger;
  /**
   * Db settings per-guild for MongoDB.
   */
  public settings: Collection<string, ISettings>;

  /**
   * A collection of our events.
   */
  public events: Map<string, Event>;

  /**
   * A collection of commands
   */
  public commands: Collection<string, Command>;

  public utilities = {
    anchor: new AnchorUtility(this),
    autoArchive: new AutoArchiveUtility(this),
    autoSlow: new CachedAutoSlow(),
    autoPing: new AutoPingUtility(this),
    badName: new BadNameUtility(),
    linkHandler: new LinkHandlerUtility(),
    misc: new MiscUtilities(),
    suggestions: new SuggestionUtility(),
    timeParser: new TimeParserUtility(),
  };

  /**
   * Cache of any string keys, key is and value is the keys they use
   * For example, triggers would be <"trigger", ["each", "trigger", "here"]
   */
  public stringKeyCache: Collection<string, Set<string>>;

  /** Chain message storage */
  public channelMessages: Collection<
    string,
    {
      word: string;
      count: number;
    }[]
  >;

  /** Temporary storage for emoji caching for emoji suggestions. */
  public emojiEventCache: Map<string, EmojiSuggestions>;

  /**
   * A timeout handler for chains.
   */
  public dirtyCooldownHandler: TimeoutHandler;

  constructor(options: ClientOptions) {
    super(options);

    this.__dirname = resolve();

    this.config = clientConfig;
    this.logger = new Logger();

    this.settings = new Collection();

    this.events = new Map();

    this.commands = new Collection();

    this.stringKeyCache = new Collection();
    this.channelMessages = new Collection();
    this.dirtyCooldownHandler = new TimeoutHandler();

    this.emojiEventCache = new Map();
  }

  public async initialize() {
    await this.connectMongo();
    await this.loadCommands();
    await this.loadEvents();
  }

  /**
   * Connect our client to the database.
   */
  private async connectMongo() {
    await mongoose.connect(process.env.MONGODB_URL as string).catch((e) => {
      this.logger.error(e);
      process.exit(1);
    });

    this.settings.set(
      "default",
      await SettingsModel.findOneAndUpdate(
        { _id: "default" },
        { toUpdate: true },
        { upsert: true, setDefaultsOnInsert: true, new: true },
      ),
    );
  }

  /**
   * A recursive method to load all commands
   * @param directory - The directory our files are stored in
   */
  private async loadCommands(directory?: string) {
    const commandsPath = directory ?? join(this.__dirname, "src", "commands");

    try {
      const items = readdirSync(commandsPath, {
        withFileTypes: true,
      });

      for (const item of items) {
        const fullPath = join(commandsPath, item.name);
        if (item.isDirectory()) {
          await this.loadCommands(fullPath);
          continue;
        }

        if (!item.name.endsWith(".ts") && !item.name.endsWith(".js")) continue;
        try {
          const commandModule = await import(fullPath);
          const CommandClass = commandModule.default;
          if (!CommandClass) {
            this.logger.warn(`No default export in command file: ${fullPath}`);
            continue;
          }

          const command: Command = new CommandClass(this);
          this.commands.set(command.data.name, command);
          this.logger.info(`Loaded command: ${command.data.name}`);
        } catch (error) {
          this.logger.error(`Failed to load command ${fullPath}:`, error);
        }
      }

      if (!directory) {
        this.logger.info(`Loaded ${this.commands.size} commands`);
      }
    } catch (error) {
      this.logger.error(`Failed to read directory ${commandsPath}:`, error);
    }
  }

  /**
   * Load all the event files and map them to our collection.
   */
  private async loadEvents(): Promise<void> {
    const eventsPath = join(this.__dirname, "src", "events");

    try {
      const eventFiles = readdirSync(eventsPath);

      for (const file of eventFiles) {
        if (!file.endsWith(".ts") && !file.endsWith(".js")) continue;

        try {
          const eventModule = await import(join(eventsPath, file));
          const EventClass = eventModule.default;

          if (!EventClass) {
            this.logger.warn(`No default export in event file: ${file}`);
            continue;
          }

          const event: Event = new EventClass(this);

          this.events.set(event.name, event);

          this.on(event.name, (...args) => event.run(...args));

          this.logger.info(`Loaded event: ${event.name}`);
        } catch (error) {
          this.logger.error(`Failed to load event ${file}:`, error);
        }
      }

      this.logger.info(`Loaded ${this.events.size} events`);
    } catch (error) {
      this.logger.error("Failed to read events directory:", error);
    }
  }

  /**
   * Returns an integer representing the GuildMembers current permission level.
   * @param message The message sent within the command
   * @param member The represented GuildMember
   * @returns {number}
   */
  getPermLevel(message?: Message, member?: GuildMember): number {
    if (!member && !message) return 0;

    if (member) {
      const settings = this.settings.get(member.guild.id);
      if (settings) member.settings = settings;
    }

    return PermissionsHelper.resolvePermLevel(this.config.permLevels, message, member);
  }
}

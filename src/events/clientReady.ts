import { DsuClient } from "../lib/core/DsuClient.ts";
import { ISettings } from "types/mongodb";
import { SettingsModel } from "models/Settings";
import { Times } from "types/index";
import _ from "lodash";
import { startServer } from "../lib/server/server.ts";
import { Event } from "../lib/core/Event.ts";

export default class ClientReady extends Event<"clientReady"> {
  constructor(client: DsuClient) {
    super(client, "clientReady");
  }

  private async ensureGuildConfig(
    client: DsuClient,
    guildId: string,
  ): Promise<ISettings> {
    const existing = await SettingsModel.findById(guildId)
      .populate("commands")
      .populate("mentorRoles");

    if (existing) return existing;

    try {
      return await new SettingsModel({ _id: guildId })
        .save()
        .then((doc) => doc.populate("mentorRoles"))
        .then((doc) => doc.populate("commands"));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.code === 11000) {
        const existingConfig = await SettingsModel.findById(guildId)
          .populate("commands")
          .populate("mentorRoles");

        if (!existingConfig) {
          throw new Error(
            `Failed to find config for guild ${guildId} after duplicate key error`,
          );
        }
        return existingConfig;
      }
      client.logger.error("Failed to ensure guild config", { guildId, error });
      throw error;
    }
  }

  private async syncSettings(client: DsuClient, guildId: string) {
    const dbSettings = await this.ensureGuildConfig(client, guildId);
    const cachedSettings = client.settings.get(guildId);

    if (
      !cachedSettings ||
      !_.isEqual(cachedSettings, dbSettings) ||
      dbSettings.toUpdate
    ) {
      if (cachedSettings?.mentorRoles.toString() !== dbSettings.mentorRoles.toString()) {
        client.logger.info("Setting sync", {
          action: "Fetch",
          message: `Database.mentorRoles -> Client.mentorRoles (${guildId})`,
        });
        client.settings.set(guildId, dbSettings);
      }
    }
  }

  private async updateStringKeys(client: DsuClient, guildId: string) {
    let settings = client.settings.get(guildId);

    if (!settings) return;

    let cache = client.stringKeyCache.get("triggers");

    const dbTriggers = new Set(settings.triggers.map((t) => t.id));

    if (cache) {
      for (const t of dbTriggers) cache.add(t);
    } else {
      client.stringKeyCache.set("triggers", dbTriggers);
    }
  }

  override async run() {
    const updateSettings = async () => {
      if (this.client.isReady()) {
        // Should catch the AsyncEventEmitter "memory leak"?
        // Presence data isn't available until the client is *truly* ready, so doing it here should fix anything from that.
        this.client.user?.setPresence({
          activities: [{ name: `v${process.env.npm_package_version}` }],
        });
      }

      await Promise.all(
        Array.from(this.client.settings.keys()).map((guildId) => {
          this.syncSettings(this.client, guildId).catch((e) =>
            this.client.logger.error("Sync failed for guild", { guildId, error: e }),
          );
          this.updateStringKeys(this.client, guildId).catch((e) =>
            this.client.logger.error("Failed to update string keys for guild", {
              guildId,
              error: e,
            }),
          );
        }),
      );
    };

    await updateSettings();

    const interval = setInterval(
      () =>
        updateSettings().catch((e) =>
          this.client.logger.error("Periodic update failed", e),
        ),
      Times.SECOND * 3,
    );

    this.client.once("destroy", () => clearInterval(interval));

    await this.client.utilities.autoArchive.handleAutoArchive();
    await this.client.utilities.anchor.checkAnchorInactivity();

    this.client.logger.info(`Bot logged in as ${this.client.user?.tag}.`);

    startServer(this.client);
  }
}

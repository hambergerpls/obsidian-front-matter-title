import { inject, injectable, named } from "inversify";
import SI from "@config/inversify.types";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import { Feature } from "@src/Enum";
import { CachedMetadata, MetadataCacheExt, TFile } from "obsidian";
import AbstractFeature from "@src/Feature/AbstractFeature";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { AppEvents } from "@src/Types";
import ListenerRef from "@src/Components/EventDispatcher/Interfaces/ListenerRef";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";
import { MetadataCacheFactory } from "@config/inversify.factory.types";

@injectable()
export class FirstHeadingFeature extends AbstractFeature<Feature> {
    private enabled = false;
    private ref: ListenerRef<"metadata:cache:changed"> = null;

    constructor(
        @inject(SI.logger)
        @named("first:heading")
        private logger: LoggerInterface,
        @inject(SI["event:dispatcher"])
        private dispatcher: EventDispatcherInterface<AppEvents>,
        @inject(SI["facade:obsidian"])
        private facade: ObsidianFacade,
        @inject(SI["factory:metadata:cache"])
        private factory: MetadataCacheFactory<MetadataCacheExt>
    ) {
        super();
    }

    static getId(): Feature {
        return Feature.FirstHeading;
    }

    disable(): void {
        if (this.ref) {
            this.dispatcher.removeListener(this.ref);
            this.ref = null;
        }
        this.enabled = false;
    }

    enable(): void {
        this.ref = this.dispatcher.addListener({
            name: "metadata:cache:changed",
            cb: e => this.update(e.get().path, e.get().cache),
        });
        this.enabled = true;
        this.refresh().catch(console.error);
    }

    getId(): Feature {
        return FirstHeadingFeature.getId();
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    private async update(path: string, metadata: CachedMetadata = null): Promise<void> {
        if (!metadata) {
            return;
        }

        const firstHeading = metadata.headings?.[0]?.heading;
        if (!firstHeading) {
            return;
        }

        const currentTitle = metadata.frontmatter?.title;

        if (currentTitle !== firstHeading) {
            const file = this.facade.getTFile(path);
            if (file instanceof TFile) {
                this.logger.log(`Syncing first heading to frontmatter title for ${path}: ${firstHeading}`);
                await this.facade.processFrontMatter(file, (frontmatter: any) => {
                    frontmatter.title = firstHeading;
                });
            }
        }
    }

    private async refresh(): Promise<void> {
        const cache = this.factory();
        const promises = [];
        for (const path of cache.getCachedFiles()) {
            promises.push(this.update(path, cache.getCache(path)));
        }
        await Promise.all(promises);
    }
}

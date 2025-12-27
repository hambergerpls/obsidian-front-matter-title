import { mock } from "jest-mock-extended";
import { CachedMetadata, MetadataCacheExt, TFile } from "obsidian";
import { FirstHeadingFeature } from "@src/Feature/FirstHeading/FirstHeadingFeature";
import LoggerInterface from "@src/Components/Debug/LoggerInterface";
import { Feature } from "@src/Enum";
import EventDispatcherInterface from "@src/Components/EventDispatcher/Interfaces/EventDispatcherInterface";
import { AppEvents } from "@src/Types";
import ObsidianFacade from "@src/Obsidian/ObsidianFacade";

const mockCache = mock<MetadataCacheExt>();
const mockCacheFactory = jest.fn(() => mockCache);
const mockDispatcher = mock<EventDispatcherInterface<AppEvents>>();
const mockFacade = mock<ObsidianFacade>();
const mockLogger = mock<LoggerInterface>();

const feature = new FirstHeadingFeature(mockLogger, mockDispatcher, mockFacade, mockCacheFactory);

const fooPath = "path/to/foo.md";

describe("FirstHeadingFeature", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("Should have correct ID", () => {
        expect(feature.getId()).toEqual(Feature.FirstHeading);
        expect(FirstHeadingFeature.getId()).toEqual(Feature.FirstHeading);
    });

    test("Should be disabled by default", () => {
        expect(feature.isEnabled()).toBeFalsy();
    });

    test("Should add listener and refresh on enable", async () => {
        mockCache.getCachedFiles.mockReturnValueOnce([fooPath]);
        mockCache.getCache.mockReturnValueOnce({
            headings: [{ heading: "My Heading", level: 1 }],
            frontmatter: { title: "Old Title" },
        } as unknown as CachedMetadata);

        const mockFile = new TFile();
        mockFacade.getTFile.mockReturnValueOnce(mockFile);

        feature.enable();

        expect(mockDispatcher.addListener).toBeCalledTimes(1);
        expect(mockDispatcher.addListener).toBeCalledWith({
            name: "metadata:cache:changed",
            cb: expect.anything(),
        });

        expect(feature.isEnabled()).toBeTruthy();

        // Wait for refresh to complete (it's async but called without await in enable)
        await new Promise(process.nextTick);

        expect(mockFacade.processFrontMatter).toHaveBeenCalledWith(mockFile, expect.anything());
    });

    test("Should remove listener on disable", () => {
        const mockRef = { name: "metadata:cache:changed", cb: jest.fn() };
        mockDispatcher.addListener.mockReturnValueOnce(mockRef as any);

        feature.enable();
        feature.disable();

        expect(mockDispatcher.removeListener).toHaveBeenCalledWith(mockRef);
        expect(feature.isEnabled()).toBeFalsy();
    });

    test("Should sync title when heading changes", async () => {
        const metadata = {
            headings: [{ heading: "New Heading", level: 1 }],
            frontmatter: { title: "Old Title" },
        } as unknown as CachedMetadata;

        const mockFile = new TFile();
        mockFacade.getTFile.mockReturnValueOnce(mockFile);

        // Manually trigger the update logic (usually called via listener)
        // @ts-ignore - accessing private method for test
        await feature.update(fooPath, metadata);

        expect(mockFacade.processFrontMatter).toHaveBeenCalledWith(mockFile, expect.anything());

        // Test the callback passed to processFrontMatter
        const callback = mockFacade.processFrontMatter.mock.calls[0][1];
        const frontmatter = { title: "Old Title" };
        callback(frontmatter);
        expect(frontmatter.title).toEqual("New Heading");
    });

    test("Should not sync if heading is the same as title", async () => {
        const metadata = {
            headings: [{ heading: "Same Title", level: 1 }],
            frontmatter: { title: "Same Title" },
        } as unknown as CachedMetadata;

        // @ts-ignore
        await feature.update(fooPath, metadata);

        expect(mockFacade.processFrontMatter).not.toHaveBeenCalled();
    });

    test("Should sync if title is missing", async () => {
        const metadata = {
            headings: [{ heading: "New Heading", level: 1 }],
            frontmatter: {},
        } as unknown as CachedMetadata;

        const mockFile = new TFile();
        mockFacade.getTFile.mockReturnValueOnce(mockFile);

        // @ts-ignore
        await feature.update(fooPath, metadata);

        expect(mockFacade.processFrontMatter).toHaveBeenCalled();
    });

    test("Should not sync if no headings found", async () => {
        const metadata = {
            headings: [],
            frontmatter: { title: "Title" },
        } as unknown as CachedMetadata;

        // @ts-ignore
        await feature.update(fooPath, metadata);

        expect(mockFacade.processFrontMatter).not.toHaveBeenCalled();
    });
});

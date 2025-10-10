import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
/**
 * Cache of known prompt keys for quick lookup and runtime validation.
 */
const KNOWN_PROMPT_KEYS = new Set([
    'discord.chat.system',
    'discord.image.system',
    'discord.image.developer',
    'discord.realtime.system',
    'discord.planner.system',
    'discord.summarizer.system',
    'discord.news.system'
]);
/**
 * Tiny helper that converts `file:` URLs into absolute filesystem paths. Using
 * URL utilities keeps the implementation compatible whether we execute from the
 * TypeScript source or the compiled JavaScript output.
 */
const resolveRelativePath = (target) => {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = path.dirname(currentFile);
    return path.resolve(currentDir, target);
};
/**
 * Performs a simple `{{placeholder}}` substitution. The routine is intentionally
 * light-weight: it does not implement conditionals or loops, only flat
 * replacements so that prompts remain readable for non-engineers editing YAML.
 */
const interpolateTemplate = (template, variables) => {
    return template.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_match, key) => {
        const raw = variables[key];
        if (raw === undefined || raw === null) {
            return '';
        }
        if (typeof raw === 'string') {
            return raw;
        }
        return String(raw);
    });
};
/**
 * PromptRegistry is the single source of truth for loading, merging, and
 * retrieving prompt templates. It understands both the built-in defaults and an
 * optional operator-supplied override file.
 */
export class PromptRegistry {
    prompts;
    constructor(options = {}) {
        const defaults = this.loadPromptFile(resolveRelativePath('../../prompts/defaults.yaml'), false);
        const merged = { ...defaults };
        if (options.overridePath) {
            const overrideData = this.loadPromptFile(options.overridePath, true);
            Object.assign(merged, overrideData);
        }
        this.prompts = merged;
    }
    /**
     * Retrieves a prompt definition or throws a descriptive error if missing.
     */
    getPrompt(key) {
        const prompt = this.prompts[key];
        if (!prompt) {
            throw new Error(`Prompt not found for key: ${key}`);
        }
        return prompt;
    }
    /**
     * Convenience wrapper that resolves a prompt and performs interpolation.
     */
    renderPrompt(key, variables = {}) {
        const definition = this.getPrompt(key);
        const content = interpolateTemplate(definition.template, variables);
        return {
            content,
            description: definition.description,
            cache: definition.cache
        };
    }
    /**
     * Indicates whether a prompt is defined. Useful for lightweight startup
     * assertions without forcing interpolation.
     */
    hasPrompt(key) {
        return Boolean(this.prompts[key]);
    }
    /**
     * Ensures that each requested key has a corresponding definition. This is
     * handy for startup checks so operators immediately know if their overrides
     * omitted any critical prompts.
     */
    assertKeys(keys) {
        for (const key of keys) {
            if (!this.hasPrompt(key)) {
                throw new Error(`Missing prompt definition for key: ${key}`);
            }
        }
    }
    /**
     * Loads and flattens a YAML prompt file into the internal map representation.
     */
    loadPromptFile(filePath, optional) {
        const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
            if (optional) {
                return {};
            }
            throw new Error(`Prompt configuration file not found: ${resolvedPath}`);
        }
        const fileContents = fs.readFileSync(resolvedPath, 'utf-8');
        const parsed = yaml.load(fileContents);
        if (!parsed || typeof parsed !== 'object') {
            throw new Error(`Prompt configuration did not parse to an object: ${resolvedPath}`);
        }
        return this.flattenPromptTree(parsed);
    }
    /**
     * Recursively walks a nested object structure, producing dot-delimited keys
     * that match the PromptKey union.
     */
    flattenPromptTree(tree, prefix = '') {
        const result = {};
        for (const [segment, value] of Object.entries(tree)) {
            const key = prefix ? `${prefix}.${segment}` : segment;
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                const candidate = value;
                const template = candidate.template ?? candidate.prompt;
                if (typeof template === 'string' && isPromptKey(key)) {
                    result[key] = {
                        template,
                        description: typeof candidate.description === 'string' ? candidate.description : undefined,
                        cache: typeof candidate.cache === 'object' && candidate.cache !== null
                            ? candidate.cache
                            : undefined
                    };
                    continue;
                }
                Object.assign(result, this.flattenPromptTree(candidate, key));
            }
        }
        return result;
    }
}
/**
 * Runtime guard used while flattening the YAML tree.
 */
const isPromptKey = (value) => KNOWN_PROMPT_KEYS.has(value);
/**
 * Holds onto the active registry instance so that callers can use the
 * functional `renderPrompt` helper without threading references everywhere.
 */
let activePromptRegistry = null;
/**
 * Registers the singleton prompt registry for downstream helpers. Typically
 * invoked from the Discord bot's environment bootstrap after loading overrides.
 */
export const setActivePromptRegistry = (registry) => {
    activePromptRegistry = registry;
};
/**
 * Retrieves the currently configured registry or throws a helpful error when
 * it has not yet been initialised.
 */
export const getActivePromptRegistry = () => {
    if (!activePromptRegistry) {
        throw new Error('Prompt registry has not been initialised. Call setActivePromptRegistry() first.');
    }
    return activePromptRegistry;
};
/**
 * Convenience wrapper preferred by many call-sites. It simply defers to the
 * configured registry while keeping metadata in the response.
 */
export const renderPrompt = (key, variables = {}) => {
    return getActivePromptRegistry().renderPrompt(key, variables);
};
// Initialise the module-level registry with the built-in defaults so that unit
// tests or lightweight scripts can call renderPrompt without explicitly
// bootstrapping the environment. Deployment code can overwrite this singleton
// by invoking setActivePromptRegistry with a custom instance (for example, one
// that incorporates operator overrides).
if (!activePromptRegistry) {
    activePromptRegistry = new PromptRegistry();
}
//# sourceMappingURL=promptRegistry.js.map
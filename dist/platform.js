"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTlockPlatform = void 0;
const settings_1 = require("./settings");
const platformAccessory_1 = require("./platformAccessory");
const api_1 = require("./api");
/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin.
 */
class TTlockPlatform {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.apiClient = new api_1.TTlockApiClient(this);
        this.accessories = [];
        this.log.debug('Finished initializing platform:', this.config.name);
        this.api.on('didFinishLaunching', () => {
            this.log.debug('Executed didFinishLaunching callback');
            void this.discoverDevices();
        });
    }
    configureAccessory(accessory) {
        this.log.info('Loading accessory from cache:', accessory.displayName);
        this.accessories.push(accessory);
    }
    getNumberConfig(key, defaultValue) {
        const rawValue = this.config[key];
        const parsedValue = Number(rawValue);
        return Number.isFinite(parsedValue) ? parsedValue : defaultValue;
    }
    getStringArrayConfig(key) {
        const rawValue = this.config[key];
        if (Array.isArray(rawValue)) {
            return rawValue
                .map((value) => String(value).trim())
                .filter((value) => value.length > 0);
        }
        if (typeof rawValue === 'string') {
            return rawValue
                .split(/[\n,;]+/)
                .map((value) => value.trim())
                .filter((value) => value.length > 0);
        }
        return [];
    }
    normalizeIdentifier(value) {
        return String(value ?? '').trim().toLowerCase();
    }
    matchesIdentifier(device, identifier) {
        const normalizedIdentifier = this.normalizeIdentifier(identifier);
        if (!normalizedIdentifier) {
            return false;
        }
        const candidates = [
            device.lockAlias,
            device.lockName,
            device.lockMac,
            device.lockId,
        ].map((value) => this.normalizeIdentifier(value));
        return candidates.includes(normalizedIdentifier);
    }
    shouldExposeDevice(device) {
        const hideLocks = this.getStringArrayConfig('hideLocks');
        if (hideLocks.some((identifier) => this.matchesIdentifier(device, identifier))) {
            return false;
        }
        return true;
    }
    async discoverDevices() {
        try {
            const response = await this.apiClient.getLocksAsync();
            const returnedLocks = Array.isArray(response.list) ? response.list : [];
            const visibleLocks = returnedLocks.filter((device) => this.shouldExposeDevice(device));
            const visibleAccessoryUuids = new Set();
            this.log.debug(`Number of TTLock locks returned from API: ${returnedLocks.length}`);
            this.log.debug(`Number of TTLock locks exposed to HomeKit: ${visibleLocks.length}`);
            for (const device of visibleLocks) {
                const uuid = this.api.hap.uuid.generate(String(device.lockId));
                visibleAccessoryUuids.add(uuid);
                let detail = null;
                try {
                    detail = await this.apiClient.getLockDetailAsync(Number(device.lockId));
                }
                catch (error) {
                    this.log.warn(`Unable to fetch detail for lock ${device.lockId}, using list data only: ${error}`);
                }
                const mergedDevice = {
                    ...device,
                    ...(detail && typeof detail === 'object' ? detail : {}),
                };
                const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
                if (existingAccessory) {
                    this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
                    existingAccessory.context.device = mergedDevice;
                    this.api.updatePlatformAccessories([existingAccessory]);
                    new platformAccessory_1.TTlockPlatformAccessory(this, existingAccessory, detail);
                    continue;
                }
                this.log.info('Adding new accessory:', mergedDevice.lockAlias);
                const accessory = new this.api.platformAccessory(mergedDevice.lockAlias, uuid);
                accessory.context.device = mergedDevice;
                new platformAccessory_1.TTlockPlatformAccessory(this, accessory, detail);
                this.api.registerPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, [accessory]);
                this.accessories.push(accessory);
            }
            const accessoriesToRemove = this.accessories.filter((accessory) => !visibleAccessoryUuids.has(accessory.UUID));
            if (accessoriesToRemove.length > 0) {
                for (const accessory of accessoriesToRemove) {
                    this.log.info('Removing hidden or missing accessory:', accessory.displayName);
                }
                this.api.unregisterPlatformAccessories(settings_1.PLUGIN_NAME, settings_1.PLATFORM_NAME, accessoriesToRemove);
                for (const accessory of accessoriesToRemove) {
                    const index = this.accessories.findIndex((currentAccessory) => currentAccessory.UUID === accessory.UUID);
                    if (index >= 0) {
                        this.accessories.splice(index, 1);
                    }
                }
            }
        }
        catch (error) {
            this.log.error(`Error while discovering TTLock devices: ${error}`);
            this.log.error('Ensure your TTLock API keys and username/password are correct in the config.');
        }
    }
}
exports.TTlockPlatform = TTlockPlatform;
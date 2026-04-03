"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTlockPlatformAccessory = void 0;
/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers.
 */
class TTlockPlatformAccessory {
    constructor(platform, accessory, detail = null) {
        var _a, _b;
        this.platform = platform;
        this.accessory = accessory;
        this.detail = detail;
        this.Characteristic = this.platform.api.hap.Characteristic;
        this.batteryLevelValue = 100;
        this.stateRefreshPromise = null;
        this.batteryRefreshPromise = null;
        if (this.detail && typeof this.detail === 'object') {
            this.accessory.context.device = {
                ...this.accessory.context.device,
                ...this.detail,
            };
        }
        this.accessoryName = String((_a = this.accessory.context.device.lockAlias) !== null && _a !== void 0 ? _a : this.accessory.displayName);
        this.lockId = Number(this.accessory.context.device.lockId);
        this.currentLockValue = this.Characteristic.LockCurrentState.UNKNOWN;
        this.targetLockValue = this.Characteristic.LockTargetState.SECURED;
        this.accessory.getService(this.platform.Service.AccessoryInformation)
            .setCharacteristic(this.platform.Characteristic.Manufacturer, 'TTLock Homebridge Platform')
						.setCharacteristic(this.platform.Characteristic.SerialNumber, String((_b = this.accessory.context.device.lockMac) !== null && _b !== void 0 ? _b : this.lockId))
            .setCharacteristic(this.platform.Characteristic.Model, String(this.detail.lockName))
            .setCharacteristic(this.platform.Characteristic.FirmwareRevision, String(this.detail.firmwareRevision));
        this.service = this.accessory.getService(this.platform.Service.LockMechanism)
            || this.accessory.addService(this.platform.Service.LockMechanism);
        this.batteryService = this.accessory.getService(this.platform.Service.BatteryService)
            || this.accessory.addService(this.platform.Service.BatteryService, `${this.accessoryName} Battery`, 'battery');
        this.service.setCharacteristic(this.platform.Characteristic.Name, this.accessoryName);
        this.batteryService.setCharacteristic(this.platform.Characteristic.Name, `${this.accessoryName} Battery`);
        this.service.getCharacteristic(this.platform.Characteristic.LockTargetState)
            .onSet(this.handleLockTargetStateSet.bind(this))
            .onGet(this.handleLockTargetStateGet.bind(this));
        this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState)
            .onGet(this.handleLockCurrentStateGet.bind(this));
        this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel)
            .onGet(this.handleLockBatteryLevelGet.bind(this));
        this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery)
            .onGet(this.handleLockStatusLowBatteryGet.bind(this));
        this.initializeFromContext();
    }
    initializeFromContext() {
        const initialBattery = Number(this.accessory.context.device.electricQuantity);
        if (Number.isFinite(initialBattery) && initialBattery >= 0) {
            this.batteryLevelValue = this.clampBatteryLevel(initialBattery);
            this.updateBatteryCharacteristics(this.batteryLevelValue);
        }
        const cachedCurrent = Number(this.accessory.context.currentLockValue);
        const cachedTarget = Number(this.accessory.context.targetLockValue);
        if (cachedCurrent === this.Characteristic.LockCurrentState.SECURED || cachedCurrent === this.Characteristic.LockCurrentState.UNSECURED) {
            this.currentLockValue = cachedCurrent;
        }
        if (cachedTarget === this.Characteristic.LockTargetState.SECURED || cachedTarget === this.Characteristic.LockTargetState.UNSECURED) {
            this.targetLockValue = cachedTarget;
        }
        if ((this.currentLockValue === this.Characteristic.LockCurrentState.SECURED || this.currentLockValue === this.Characteristic.LockCurrentState.UNSECURED)
            && (this.targetLockValue !== this.Characteristic.LockTargetState.SECURED && this.targetLockValue !== this.Characteristic.LockTargetState.UNSECURED)) {
            this.targetLockValue = this.currentLockValue === this.Characteristic.LockCurrentState.UNSECURED
                ? this.Characteristic.LockTargetState.UNSECURED
                : this.Characteristic.LockTargetState.SECURED;
        }
        this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(this.currentLockValue);
        this.service.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(this.targetLockValue);
    }
    getPostActionRefreshDelayMs() {
        return Math.max(0, this.platform.getNumberConfig('postActionRefreshDelayMs', 1500));
    }
    getLowBatteryThreshold() {
        return this.platform.getNumberConfig('batteryLowLevel', 15);
    }
    clampBatteryLevel(level) {
        return Math.min(100, Math.max(0, Math.round(level)));
    }
    updateBatteryCharacteristics(batteryLevel) {
        const isLowBattery = batteryLevel < this.getLowBatteryThreshold();
        this.batteryService.getCharacteristic(this.platform.Characteristic.BatteryLevel).updateValue(batteryLevel);
        this.batteryService.getCharacteristic(this.platform.Characteristic.StatusLowBattery).updateValue(isLowBattery ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL);
    }
    persistCurrentTargetValues() {
        this.accessory.context.currentLockValue = this.currentLockValue;
        this.accessory.context.targetLockValue = this.targetLockValue;
    }
    updateLockCharacteristics(source) {
        this.persistCurrentTargetValues();
        this.service.getCharacteristic(this.platform.Characteristic.LockCurrentState).updateValue(this.currentLockValue);
        this.service.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(this.targetLockValue);
        this.platform.log.debug(`${this.accessoryName} state updated from ${source}: current=${this.currentLockValue}, target=${this.targetLockValue}`);
    }
    mapApiStateToCurrentValue(apiState) {
        if (apiState === 0) {
            return this.Characteristic.LockCurrentState.SECURED;
        }
        if (apiState === 1) {
            return this.Characteristic.LockCurrentState.UNSECURED;
        }
        return null;
    }
    applyStateFromApiResponse(response, source) {
        const mappedCurrentValue = this.mapApiStateToCurrentValue(Number(response === null || response === void 0 ? void 0 : response.state));
        if (mappedCurrentValue === null) {
            this.platform.log.debug(`${this.accessoryName} returned unknown state from ${source}, keeping current=${this.currentLockValue} target=${this.targetLockValue}`);
            return this.currentLockValue;
        }
        this.currentLockValue = mappedCurrentValue;
        this.targetLockValue = mappedCurrentValue === this.Characteristic.LockCurrentState.UNSECURED
            ? this.Characteristic.LockTargetState.UNSECURED
            : this.Characteristic.LockTargetState.SECURED;
        this.updateLockCharacteristics(source);
        return this.currentLockValue;
    }
    async refreshStateFromApi(source = 'api') {
        if (this.stateRefreshPromise) {
            return await this.stateRefreshPromise;
        }
        this.stateRefreshPromise = (async () => {
            const response = await this.platform.apiClient.getLockStateAsync(this.lockId);
            return this.applyStateFromApiResponse(response, source);
        })().catch((error) => {
            this.platform.log.warn(`Error while getting lock state for ${this.accessoryName}: ${error}`);
            throw error;
        }).finally(() => {
            this.stateRefreshPromise = null;
        });
        return await this.stateRefreshPromise;
    }
    async refreshBatteryFromApi(source = 'api') {
        if (this.batteryRefreshPromise) {
            return await this.batteryRefreshPromise;
        }
        this.batteryRefreshPromise = (async () => {
            const response = await this.platform.apiClient.getLockDetailAsync(this.lockId);
            if (response && typeof response === 'object') {
                this.accessory.context.device = {
                    ...this.accessory.context.device,
                    ...response,
                };
            }
            const batteryLevelValue = this.clampBatteryLevel(Number(response === null || response === void 0 ? void 0 : response.electricQuantity));
            if (Number.isFinite(batteryLevelValue)) {
                this.batteryLevelValue = batteryLevelValue;
                this.updateBatteryCharacteristics(this.batteryLevelValue);
            }
            this.platform.log.debug(`${this.accessoryName} battery refreshed from ${source}: ${this.batteryLevelValue}%`);
            return this.batteryLevelValue;
        })().catch((error) => {
            this.platform.log.warn(`Error while getting battery level for ${this.accessoryName}: ${error}`);
            throw error;
        }).finally(() => {
            this.batteryRefreshPromise = null;
        });
        return await this.batteryRefreshPromise;
    }
    async handleLockTargetStateSet(value) {
        var _a;
        const requestedTargetValue = Number(value) === this.Characteristic.LockTargetState.UNSECURED
            ? this.Characteristic.LockTargetState.UNSECURED
            : this.Characteristic.LockTargetState.SECURED;
        const action = requestedTargetValue === this.Characteristic.LockTargetState.SECURED ? 'lock' : 'unlock';
        const previousCurrentValue = this.currentLockValue;
        const previousTargetValue = this.targetLockValue;
        try {
            const response = await this.platform.apiClient.setLockStateAsync(this.lockId, action);
            if (response.errcode !== 0) {
                throw new Error(`TTLock errcode: ${response.errcode}. ${(_a = response.errmsg) !== null && _a !== void 0 ? _a : ''}`.trim());
            }
            this.targetLockValue = requestedTargetValue;
            this.service.getCharacteristic(this.platform.Characteristic.LockTargetState).updateValue(this.targetLockValue);
            this.persistCurrentTargetValues();
            this.platform.log.info(`${this.accessoryName} ${action}ed successfully.`);
            const refreshDelayMs = this.getPostActionRefreshDelayMs();
            if (refreshDelayMs > 0) {
                await new Promise((resolve) => setTimeout(resolve, refreshDelayMs));
            }
            await this.refreshStateFromApi(`post-${action}`);
        }
        catch (error) {
            this.currentLockValue = previousCurrentValue;
            this.targetLockValue = previousTargetValue;
            this.updateLockCharacteristics(`failed ${action}`);
            this.platform.log.warn(`${this.accessoryName} ${action} failed: ${error}`);
            throw error;
        }
    }
    async handleLockTargetStateGet() {
        try {
            await this.refreshStateFromApi('onGet target/current');
        }
        catch (error) {
            this.platform.log.debug(`${this.accessoryName} target state served from last known value after refresh failure: ${error}`);
        }
        return this.targetLockValue;
    }
    async handleLockCurrentStateGet() {
        try {
            await this.refreshStateFromApi('onGet target/current');
        }
        catch (error) {
            this.platform.log.debug(`${this.accessoryName} current state served from last known value after refresh failure: ${error}`);
        }
        return this.currentLockValue;
    }
    async handleLockBatteryLevelGet() {
        try {
            await this.refreshBatteryFromApi('onGet battery');
        }
        catch (error) {
            this.platform.log.debug(`${this.accessoryName} battery level served from last known value after refresh failure: ${error}`);
        }
        return this.batteryLevelValue;
    }
    async handleLockStatusLowBatteryGet() {
        try {
            await this.refreshBatteryFromApi('onGet battery');
        }
        catch (error) {
            this.platform.log.debug(`${this.accessoryName} low battery state served from last known value after refresh failure: ${error}`);
        }
        return this.batteryLevelValue < this.getLowBatteryThreshold()
            ? this.Characteristic.StatusLowBattery.BATTERY_LEVEL_LOW
            : this.Characteristic.StatusLowBattery.BATTERY_LEVEL_NORMAL;
    }
}
exports.TTlockPlatformAccessory = TTlockPlatformAccessory;
//# sourceMappingURL=platformAccessory.js.map

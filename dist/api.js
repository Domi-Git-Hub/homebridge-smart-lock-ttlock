"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TTlockApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const qs_1 = __importDefault(require("qs"));

class TTlockApiClient {
    constructor(platform) {
        this.platform = platform;
        this.expirationDateTime = null;
        this.accessToken = null;
        this.tokenPromise = null;
        this.http = axios_1.default.create({
            timeout: this.platform.getNumberConfig('requestTimeoutMs', 7000),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
    }

    async getAccessTokenAsync() {
        const now = Date.now();
        if (this.expirationDateTime && this.expirationDateTime.getTime() <= now + (120 * 1000)) {
            this.expirationDateTime = null;
            this.accessToken = null;
        }
        if (this.accessToken) {
            return this.accessToken;
        }
        if (this.tokenPromise) {
            return this.tokenPromise;
        }
        this.platform.log.debug('Requesting TTLock access token...');
        this.tokenPromise = this.requestWithRetry({
            method: 'post',
            url: 'https://euapi.ttlock.com/oauth2/token',
            data: qs_1.default.stringify({
                client_id: this.platform.config.clientid,
                client_secret: this.platform.config.clientsecret,
                username: this.platform.config.username,
                password: this.platform.config.password,
            }),
        }, 'retrieve access token').then((response) => {
            this.accessToken = String(response.access_token);
            this.expirationDateTime = new Date(Date.now() + (Number(response.expires_in) * 1000));
            this.platform.log.debug('TTLock access token refreshed successfully.');
            return this.accessToken;
        }).catch((error) => {
            this.accessToken = null;
            this.expirationDateTime = null;
            throw error;
        }).finally(() => {
            this.tokenPromise = null;
        });
        return this.tokenPromise;
    }
    async invalidateToken() {
        this.platform.log.debug('Invalidating cached TTLock access token.');
        this.accessToken = null;
        this.expirationDateTime = null;
        this.tokenPromise = null;
    }
    async getLocksAsync() {
        return await this.authorizedPost('https://euapi.ttlock.com/v3/lock/list', {
            clientId: this.platform.config.clientid,
            pageNo: 1,
            pageSize: 100,
        }, 'fetch lock list');
    }
    async getLockStateAsync(lockId) {
        return await this.authorizedGet('https://euapi.ttlock.com/v3/lock/queryOpenState', {
            clientId: this.platform.config.clientid,
            lockId,
        }, `fetch state for lock ${lockId}`);
    }
    async getLockDetailAsync(lockId) {
        return await this.authorizedGet('https://euapi.ttlock.com/v3/lock/detail', {
            clientId: this.platform.config.clientid,
            lockId,
        }, `fetch detail for lock ${lockId}`);
    }
    async setLockStateAsync(lockId, action) {
        return await this.authorizedPost(`https://euapi.ttlock.com/v3/lock/${action}`, {
            clientId: this.platform.config.clientid,
            lockId,
        }, `${action} lock ${lockId}`);
    }
    async authorizedGet(url, params, context) {
        const accessToken = await this.getAccessTokenAsync();
        try {
            return await this.requestWithRetry({
                method: 'get',
                url,
                params: {
                    ...params,
                    accessToken,
                    date: Date.now(),
                },
            }, context);
        }
        catch (error) {
            if (this.isAuthError(error)) {
                await this.invalidateToken();
                const refreshedAccessToken = await this.getAccessTokenAsync();
                return await this.requestWithRetry({
                    method: 'get',
                    url,
                    params: {
                        ...params,
                        accessToken: refreshedAccessToken,
                        date: Date.now(),
                    },
                }, `${context} after token refresh`);
            }
            throw error;
        }
    }
    async authorizedPost(url, body, context) {
        const accessToken = await this.getAccessTokenAsync();
        try {
            return await this.requestWithRetry({
                method: 'post',
                url,
                data: qs_1.default.stringify({
                    ...body,
                    accessToken,
                    date: Date.now(),
                }),
            }, context);
        }
        catch (error) {
            if (this.isAuthError(error)) {
                await this.invalidateToken();
                const refreshedAccessToken = await this.getAccessTokenAsync();
                return await this.requestWithRetry({
                    method: 'post',
                    url,
                    data: qs_1.default.stringify({
                        ...body,
                        accessToken: refreshedAccessToken,
                        date: Date.now(),
                    }),
                }, `${context} after token refresh`);
            }
            throw error;
        }
    }
    async requestWithRetry(config, context) {
        const maximumAttempts = Math.max(1, this.platform.getNumberConfig('maximumApiRetry', 2));
        const retryDelayMs = this.platform.getNumberConfig('apiRetryIntervalMs', 500);
        let lastError;
        for (let attempt = 1; attempt <= maximumAttempts; attempt++) {
            try {
                const response = await this.http.request(config);
                return response.data;
            }
            catch (error) {
                lastError = error;
                if (attempt >= maximumAttempts || !this.shouldRetry(error)) {
                    break;
                }
                this.platform.log.debug(`Retrying TTLock request (${attempt}/${maximumAttempts}) while trying to ${context}.`);
                await this.delay(retryDelayMs);
            }
        }
        throw lastError;
    }
    shouldRetry(error) {
        var _a;
        if (!axios_1.default.isAxiosError(error)) {
            return false;
        }
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
            return true;
        }
        const status = (_a = error.response) === null || _a === void 0 ? void 0 : _a.status;
        return status !== undefined && status >= 500;
    }
    isAuthError(error) {
        var _a;
        if (!axios_1.default.isAxiosError(error)) {
            return false;
        }
        const responseData = (_a = error.response) === null || _a === void 0 ? void 0 : _a.data;
        return (responseData === null || responseData === void 0 ? void 0 : responseData.errcode) === 10004 || (responseData === null || responseData === void 0 ? void 0 : responseData.errcode) === 10005 || (responseData === null || responseData === void 0 ? void 0 : responseData.errcode) === 10006;
    }
    async delay(ms) {
        await new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.TTlockApiClient = TTlockApiClient;
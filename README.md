
<span align="center">

<p align="center">
<img src="https://open.ttlock.com/resources/developer/img/logo_ttlock.a53b544e.png" width="80">
</p>


# Homebridge Smart Lock TTLock Platform  


<p>A Homebridge <a href="https://open.ttlock.com/document/doc?urlName=userGuide%2FekeyEn.html">TTLock</a>  
plugin that allows you to access your Smart Lock TTLock Device(s) from HomeKit with
  <a href="https://homebridge.io">Homebridge</a>. 
</p>

[![GitHub release](https://img.shields.io/github/v/release/Domi-Git-Hub/homebridge-smart-lock-ttlock)](https://github.com/Domi-Git-Hub/homebridge-smart-lock-ttlock/releases) 
[![npm version](https://img.shields.io/npm/v/homebridge-smart-lock-ttlock)](https://www.npmjs.com/package/homebridge-smart-lock-ttlock) 
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-339933)](https://nodejs.org/en/download) 
[![Homebridge](https://img.shields.io/badge/homebridge-%3E%3D1.8.0-blue)](https://homebridge.io) 
[![license](https://img.shields.io/npm/l/homebridge-smart-lock-ttlock)](LICENSE)


</span>


# Requirements
1. Lock/door handle using TTLock Platform (Wifi, or Bluetooth + Gateway)
2. Smart Lock TTLock Bluetooth - Compatible Gateway (G1, G2, G3, or G4).
3. TTLock app for iOS or Android 
4. Bash access to run curl command
<br><br><br>


# Setup Instructions

## Create TTLock Developer Account
1. Go to [TTLock Platform Registration](https://open.ttlock.com/register). If you have previously used the lock with the app, you'll have to use the same account to create the app.
2. Complete the required information to create a developer account for API access.
3. Wait for the email confirming activation of your account (manual process that will be completed by TTLock).
4. Create application and wait for approval.
5. Log back into the TTLock Developer Platform and retreive your ClientId and ClientSecret.
6. You'll have to submit the password as md5 with the api(use [this site](https://www.md5online.org/md5-encrypt.html)).


```
curl --location --request POST 'https://euapi.ttlock.com/v3/user/register?clientId=[clientid]&clientSecret=[clientsecret]&username=[username]&password=[passwordasmd5]&date=CURRENTMILLIS' \
--header 'Content-Type: application/x-www-form-urlencoded' \
```

<br><br>


## Associate Lock and Gateway with New Account

1. Log into the TTLock iOS or Android app with your account.
2. Add your lock(s) to the app to accociate them with your account. 
3. If using Bluetooth, add the gateway (and ensure it is associated with the locks).

<br><br>

## Plugin Installation
**Recommended**: install via the Homebridge UI

Or install the plugin with the following command:
```
npm install -g homebridge-smart-lock-ttlock
```
<br><br>

## Configuration
```
	{
		"name": "Smart Lock TTLock Platform",
		"batteryLowLevel": 15,
		"maximumApiRetry": 2,
		"requestTimeoutMs": 7000,
		"apiRetryIntervalMs": 500,
		"postActionRefreshDelayMs": 2900,
		"username": "username",
		"password": "passwordasmd5",
		"clientid": "clientid",
		"clientsecret": "clientsecret",
		"platform": "smart-lock-ttlock",
		"_bridge": {
				"username": "0E:54:DD:3B:09:30",
				"port": 51221,
				"name": "Smart Lock TTLock Platform"
		}
	}
```

**name**: Platform name

**clientid**: TTLock Open Platform clientId.

**clientsecret**: TTLock Open Platform clientSecret.

**username**: TTLock app account username.

**password**: MD5 hash of your TTLock account password.

**batteryLowLevel**: Battery percentage at or below which HomeKit shows a low battery warning.

**maximumApiRetry**: Maximum number of attempts per TTLock API request.

**requestTimeoutMs**: HTTPS timeout for TTLock API requests.

**apiRetryIntervalMs**: Delay between TTLock network retry attempts.

**postActionRefreshDelayMs**: Delay before the second API request that re-reads the real lock state after a lock or unlock command.

<br><br>

# Usage

* On Homebridge load, plugin will get all locks from TTLock account and add them to Homebridge (if they are not already cached)
* Use Homekit to lock and unlock your locks!
* Homekit will show warning when lock has low battery (customize in plugin configuration) 

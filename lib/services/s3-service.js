"use strict";

const fs = require("fs");
const path = require("path");

class S3Service {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;
		this.logger = this.serverless.cli;
		this.provider = this.provider = this.serverless.providers.aws;
		this.config = this._loadPluginConfiguration();
	}

	async uploadAsync() {
		this.logger.log("Uploading custom files to s3...");
		try {
			await this.provider.request("S3", "headBucket", { Bucket: this.config.bucket });
		} catch (err) {
			this._throwServerlessError(`Bucket ${this.config.bucket} does not exist or you don't have permissions to access it.`);
		}

		if (this.config.items) {
			for (const item of this._getItemsObjects()) {
				await this._uploadItemAsync(item);
			}
		} else {
			this.logger.log("No items provided in the config. Nothing will be uploaded.");
		}
	}

	async cleanBucketAsync() {
		if (this.config.cleanBucket && this.config.wipeEntireBucket) {
			this._throwServerlessError("You should provide only cleanBucket or wipeEntireBucket in the plugin config.");
		}

		if (!this.config.cleanBucket && !this.config.wipeEntireBucket) {
			this.logger.log(`Bucket ${this.config.bucket} was not cleaned because the cleanBucket or wipeEntireBucket is not set to true in the plugin config.`);
			return;
		}

		let objectsToDelete = [];
		if (this.config.cleanBucket) {
			for (const item of this._getItemsObjects()) {
				const itemsToDeleteWithPrefix = await this._getObjectsFromBucketAsync(item.name);
				// Remove the unnecessary keys because the request validation will fail.
				objectsToDelete = objectsToDelete.concat(itemsToDeleteWithPrefix.map(o => ({ Key: o.Key })));
			}
		} else if (this.config.wipeEntireBucket) {
			const itemsToDelete = await this._getObjectsFromBucketAsync();
			objectsToDelete = objectsToDelete.concat(itemsToDelete.map(o => ({ Key: o.Key })));
		}

		if (!objectsToDelete.length) {
			this.logger.log("Nothing to delete.");
			return;
		}

		this.logger.log("Removing S3 items...");

		const params = {
			Bucket: this.config.bucket,
			Delete: {
				Objects: objectsToDelete
			}
		};

		await this.provider.request("S3", "deleteObjects", params);
	}

	_getItemsObjects() {
		return this.config.items
			.slice(0)
			.map((item) => {
				let result;
				if (typeof item === "string") {
					result = {
						name: item
					};
				} else {
					result = item;
				}

				this._validateItem(result);

				return result;
			});
	}

	_loadPluginConfiguration() {
		this._validateConfig();
		return this.serverless.service.custom.s3UploadConfig;
	}

	_validateConfig() {
		const config = this.serverless.service.custom.s3UploadConfig;
		if (!config) {
			this._throwServerlessError("Please provide s3UploadConfig in the custom property of your service.");
		}

		if (!config.bucket) {
			this._throwServerlessError("Please provide bucket name.");
		}
	}

	_throwServerlessError(message) {
		throw new this.serverless.classes.Error(message);
	}

	_validateItem(item) {
		if (!item || !item.name) {
			this._throwServerlessError("Item should be string or object.");
		}
	}

	async _uploadItemAsync(item) {
		const fullPath = this._getItemLocalPath(item);
		if (!fs.existsSync(fullPath)) {
			this.logger.log(`${fullPath} does not exist.`);
			return;
		}

		// TODO: Check the MD5 sum for each item.
		this.logger.log(`Uploading item ${item.name}...`);
		item.name = this._sanitizeDestination(item.name);

		await this._putObjectAsync(item, fullPath, item.name);
	}

	async _putObjectAsync(baseItem, objectPath, destination) {
		if (fs.statSync(objectPath).isDirectory()) {
			for (const item of fs.readdirSync(objectPath)) {
				const source = path.join(objectPath, item);
				await this._putObjectAsync(baseItem, source, destination + "/" + item);
			}
		} else {
			// TODO: Calculate MD5 sum.
			const params = baseItem.s3Config || {};
			params.Bucket = params.Bucket || this.config.bucket;
			params.Key = params.Key || destination;
			params.Body = params.Body || fs.readFileSync(objectPath)

			await this.provider.request("S3", "putObject", params);
		}
	}

	_sanitizeDestination(destination) {
		let result = destination;
		if (result.startsWith(".")) {
			result = result.replace(".", "");
		}

		if (result.startsWith("/")) {
			result = result.replace("/", "");
		}

		return result;
	}

	_getItemLocalPath(item) {
		const serviceDir = process.cwd();
		const localPath = path.join(serviceDir, item.name);
		return localPath;
	}

	async _getObjectsFromBucketAsync(prefix) {
		const maxObjectsCount = 1000;
		const params = {
			Bucket: this.config.bucket,
			MaxKeys: maxObjectsCount
		};

		if (prefix) {
			const sanitizedPrefix = this._sanitizeDestination(prefix);
			params.Prefix = sanitizedPrefix;
		}

		let objects = [];
		try {
			const result = await this.provider.request("S3", "listObjects", params);
			objects = result.Contents;
		} catch (err) {
			this._throwServerlessError(`Unable to list objects in bucket ${this.config.bucket}. Error: ${err.message}`);
		}

		if (!objects) {
			return [];
		} else if (!objects.length) {
			return [];
		} else if (objects.length >= maxObjectsCount) {
			return object.concat(await this._getObjectsFromBucketAsync(prefix));
		} else {
			return objects;
		}
	}
}

module.exports = S3Service;

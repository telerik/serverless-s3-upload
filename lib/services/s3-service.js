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
			for (const item of this.config.items) {
				let i;
				if (typeof item === "string") {
					i = {
						name: item
					};
				} else {
					i = item;
				}

				this._validateItem(i);
				await this._uploadItemAsync(i);
			}
		} else {
			this.logger.log("No items provided in the config. Nothing will be uploaded.");
		}
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
		const serviceDir = process.cwd();
		const fullPath = path.join(serviceDir, item.name);
		if (!fs.existsSync(fullPath)) {
			this.logger.log(`${fullPath} does not exist.`);
			return;
		}

		// TODO: Check the MD5 sum for each item.
		this.logger.log(`Uploading item ${item.name}...`);
		if (item.name.startsWith(".")) {
			item.name = item.name.replace(".", "");
		}

		if (item.name.startsWith("/")) {
			item.name = item.name.replace("/", "");
		}

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
}

module.exports = S3Service;

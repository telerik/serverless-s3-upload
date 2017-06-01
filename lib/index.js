"us strict";

const S3Service = require("./services/s3-service");

class CustomDomainPlugin {
	constructor(serverless, options) {
		this.serverless = serverless;
		this.options = options;

		this.commands = {
			"s3-upload": {
				usage: "Uploads the specified items to S3 bucket.",
				lifecycleEvents: [
					"s3-upload"
				]
			},
			"s3-remove": {
				usage: "Deletes the specified items or all the items from S3 bucket.",
				lifecycleEvents: [
					"s3-remove"
				]
			}
		};

		// TODO: Add command.
		this.hooks = {
			"after:deploy:deploy": this.uploadToS3Hook.bind(this),
			"before:remove:remove": this.cleanBucketHook.bind(this),
			"s3-upload:s3-upload": this.uploadToS3.bind(this),
			"s3-remove:s3-remove": this.cleanBucket.bind(this)
		};
	}

	async uploadToS3Hook() {
		const s3Service = new S3Service(this.serverless, this.options);
		if (s3Service.config.ignoreHooks) {
			return;
		}

		await s3Service.uploadAsync();
	}

	async uploadToS3() {
		const s3Service = new S3Service(this.serverless, this.options);
		await s3Service.uploadAsync();
	}

	async cleanBucketHook() {
		const s3Service = new S3Service(this.serverless, this.options);
		if (s3Service.config.ignoreHooks) {
			return;
		}

		await s3Service.cleanBucketAsync();
	}

	async cleanBucket() {
		const s3Service = new S3Service(this.serverless, this.options);
		await s3Service.cleanBucketAsync();
	}
}

module.exports = CustomDomainPlugin;
